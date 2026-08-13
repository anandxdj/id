/**
 * Discovery and JWKS — the two endpoints that answer before any client is resolved, so
 * the whole file runs without a database.
 *
 * The authorize-parameter cases that used to live here moved to
 * `oauth.authorize.integration.test.ts`. That is a direct consequence of the M4 rule
 * that a bad `scope` or `response_type` must come back as a *redirect* rather than
 * JSON: deciding that requires resolving the `client_id` and confirming the
 * `redirect_uri` against its registration first, which means a database.
 *
 * It does pass through the Redis-backed rate limiter, which fails open when Redis is
 * absent — so no service is required, but the client it creates has to be closed or its
 * reconnect timer keeps the event loop alive and the run never exits.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { disconnectRedis } from '../../common/config/redis';

process.env.OIDC_ISSUER ??= 'http://localhost:4000';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';

let server: Server;
let base = '';

before(async () => {
  const { SigningKeyService } = await import('./signing-key.service');
  // No Mongo here, so the keyring falls back to a process-local key. That fallback is
  // itself worth exercising: JWKS and discovery must serve correctly on an instance
  // that has not yet reached its database.
  await SigningKeyService.init();
  const { createApp } = await import('../../app');
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      base = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  server?.close();
  await disconnectRedis();
});

test('discovery document advertises the correct endpoints and capabilities', async () => {
  const res = await fetch(`${base}/.well-known/openid-configuration`);
  assert.equal(res.status, 200);
  const d = (await res.json()) as Record<string, unknown>;
  assert.equal(d.issuer, 'http://localhost:4000');
  assert.equal(d.authorization_endpoint, 'http://localhost:4000/oauth/authorize');
  assert.equal(d.token_endpoint, 'http://localhost:4000/oauth/token');
  assert.equal(d.userinfo_endpoint, 'http://localhost:4000/oauth/userinfo');
  assert.equal(d.jwks_uri, 'http://localhost:4000/oauth/jwks');
  assert.deepEqual(d.response_types_supported, ['code']);
  assert.deepEqual(d.code_challenge_methods_supported, ['S256']);
  assert.deepEqual(d.id_token_signing_alg_values_supported, ['RS256']);
});

test('discovery no longer advertises implicit, and names every M4 endpoint', async () => {
  const d = (await (await fetch(`${base}/.well-known/openid-configuration`)).json()) as Record<
    string,
    unknown
  >;

  // RFC 8414 §2: omitting `grant_types_supported` means the default,
  // ["authorization_code", "implicit"] — so the previous document was advertising a
  // flow this server does not implement and must not appear to.
  assert.deepEqual(d.grant_types_supported, ['authorization_code']);
  assert.ok(
    !JSON.stringify(d.grant_types_supported).includes('implicit'),
    'implicit must not appear anywhere in the advertised grant types',
  );

  assert.equal(d.revocation_endpoint, 'http://localhost:4000/oauth/revoke');
  assert.equal(d.introspection_endpoint, 'http://localhost:4000/oauth/introspect');
  assert.equal(d.end_session_endpoint, 'http://localhost:4000/oauth/logout');

  // Public clients are supported, and a client has no way to discover that unless the
  // document says so.
  assert.ok((d.token_endpoint_auth_methods_supported as string[]).includes('none'));
  // ...but introspection deliberately does not accept them (RFC 7662 §4).
  assert.ok(!(d.introspection_endpoint_auth_methods_supported as string[]).includes('none'));

  assert.ok((d.claims_supported as string[]).includes('auth_time'));
  assert.deepEqual(d.prompt_values_supported, ['none', 'login', 'consent']);
});

test('JWKS endpoint serves the public signing key', async () => {
  const res = await fetch(`${base}/oauth/jwks`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { keys: Array<Record<string, unknown>> };
  assert.equal(body.keys.length, 1);
  assert.ok(body.keys[0]!.kid);
  assert.equal(body.keys[0]!.d, undefined);
});

test('the published kid is the RFC 7638 thumbprint of the key it identifies', async () => {
  const { KeyringUtil } = await import('../../common/utils/keyring.utils');
  const body = (await (await fetch(`${base}/oauth/jwks`)).json()) as {
    keys: Array<Record<string, string>>;
  };
  const jwk = body.keys[0]!;

  // Derived, not configured. The reference publishes the literal string "default",
  // which is why a second key can never be introduced there.
  assert.equal(
    jwk.kid,
    KeyringUtil.thumbprint({ e: jwk.e!, kty: jwk.kty!, n: jwk.n! }),
    'kid is the thumbprint of the key it names',
  );
  assert.equal(jwk.use, 'sig');
  assert.equal(jwk.alg, 'RS256');
  assert.equal(jwk.kty, 'RSA');
  for (const privateMember of ['d', 'p', 'q', 'dp', 'dq', 'qi']) {
    assert.equal(jwk[privateMember], undefined, `${privateMember} must never be published`);
  }
});

test('authorize renders rather than redirects when the client_id is unknown', async () => {
  // No database here, so this exercises the one branch that decides before any client
  // lookup: a request with no client_id at all cannot be attributed to a redirect_uri,
  // and redirecting it would make the endpoint an open redirector.
  const res = await fetch(`${base}/oauth/authorize?response_type=code&scope=openid`, {
    redirect: 'manual',
  });
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, 'invalid_request');
});
