/**
 * Discovery, JWKS, and authorize-parameter validation. None of these paths reach
 * Mongo/Redis (validation throws before any client lookup; anonymous authorize never
 * touches the session store), so the whole file runs without external services.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';

process.env.OIDC_ISSUER ??= 'http://localhost:4000';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';

let server: Server;
let base = '';

before(async () => {
  const { initOidcKeys } = await import('../../common/utils/keys.utils');
  await initOidcKeys();
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

after(() => server?.close());

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

test('JWKS endpoint serves the public signing key', async () => {
  const res = await fetch(`${base}/oauth/jwks`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { keys: Array<Record<string, unknown>> };
  assert.equal(body.keys.length, 1);
  assert.ok(body.keys[0]!.kid);
  assert.equal(body.keys[0]!.d, undefined);
});

const authorizeUrl = (params: Record<string, string>) =>
  `${base}/oauth/authorize?${new URLSearchParams(params).toString()}`;

const valid = {
  client_id: 'cl_x',
  redirect_uri: 'http://localhost:3001/cb',
  response_type: 'code',
  scope: 'openid email',
  state: 'st',
  code_challenge: 'abc',
  code_challenge_method: 'S256',
};

test('authorize rejects response_type != code', async () => {
  const res = await fetch(authorizeUrl({ ...valid, response_type: 'token' }), { redirect: 'manual' });
  assert.equal(res.status, 400);
});

test('authorize rejects missing code_challenge', async () => {
  const { code_challenge, ...rest } = valid;
  const res = await fetch(authorizeUrl(rest), { redirect: 'manual' });
  assert.equal(res.status, 400);
});

test('authorize rejects scope without openid', async () => {
  const res = await fetch(authorizeUrl({ ...valid, scope: 'email profile' }), { redirect: 'manual' });
  assert.equal(res.status, 400);
});

test('authorize rejects non-S256 challenge method', async () => {
  const res = await fetch(authorizeUrl({ ...valid, code_challenge_method: 'plain' }), { redirect: 'manual' });
  assert.equal(res.status, 400);
});
