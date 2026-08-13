/**
 * M4 protocol endpoints: RFC 7009 revocation, RFC 7662 introspection, RP-initiated
 * logout, `Cache-Control: no-store`, and token type confusion in both directions.
 *
 * Requires Mongo + Redis; self-skips when unavailable, fails hard under
 * REQUIRE_INTEGRATION.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pkceChallengeS256, randomBase64Url } from '../../common/utils/crypto.utils';
import { IntegrationGate, OidcHarness } from '../../common/testing/index.testing';
import type { HarnessContext } from '../../common/testing/index.testing';

process.env.OIDC_ISSUER ??= 'http://localhost:4000';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.MONGO_DB_NAME ??= 'id_test';

const EMAIL = 'oidc-protocol@tabbio.com';
const PASSWORD = 'sup3r-secret-pw';
const REDIRECT_URI = 'http://localhost:3001/cb';
const POST_LOGOUT_URI = 'http://localhost:3001/signed-out';

let ctx: HarnessContext | undefined;
let available = false;

const primary = { id: '', secret: '' };
const other = { id: '', secret: '' };
const publicSpa = { id: '' };

const clientIds = (): string[] => [primary.id, other.id, publicSpa.id].filter(Boolean);

before(async () => {
  try {
    ctx = await OidcHarness.start({ email: EMAIL, password: PASSWORD, name: 'Protocol Subject' });
    const clientService = await import('../oauth-client/oauth-client.service');

    const created = await clientService.create({
      clientName: 'Protocol Primary',
      redirectUris: [REDIRECT_URI],
      postLogoutRedirectUris: [POST_LOGOUT_URI],
    });
    primary.id = created.clientId;
    primary.secret = created.clientSecret!;

    const second = await clientService.create({
      clientName: 'Protocol Other',
      redirectUris: [REDIRECT_URI],
    });
    other.id = second.clientId;
    other.secret = second.clientSecret!;

    const spa = await clientService.create({
      clientName: 'Protocol Public',
      redirectUris: [REDIRECT_URI],
      tokenEndpointAuthMethod: 'none',
    });
    publicSpa.id = spa.clientId;

    available = true;
  } catch (cause) {
    available = false;
    await OidcHarness.abandon();
    IntegrationGate.reportUnavailable('oauth.protocol', cause);
  }
});

after(async () => {
  if (available) await OidcHarness.stop(ctx, { email: EMAIL, clientIds: clientIds() });
  else ctx?.server.close();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

interface IssuedTokens {
  access_token: string;
  id_token: string;
  scope: string;
}

/** Full authorize → consent → token round-trip, returning the issued tokens. */
const issueTokens = async (client: { id: string; secret?: string }): Promise<IssuedTokens> => {
  const verifier = randomBase64Url(32);
  const params = new URLSearchParams({
    client_id: client.id,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email',
    state: 'st',
    code_challenge: pkceChallengeS256(verifier),
    code_challenge_method: 'S256',
  });
  const authRes = await fetch(`${ctx!.base}/oauth/authorize?${params}`, {
    headers: { cookie: ctx!.cookie },
    redirect: 'manual',
  });
  const location = new URL(authRes.headers.get('location')!);

  let code = location.searchParams.get('code');
  if (!code) {
    const transactionId = location.searchParams.get('transaction_id')!;
    const decision = await fetch(`${ctx!.base}/api/oauth/consent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${ctx!.sessionToken}`,
      },
      body: JSON.stringify({ transaction_id: transactionId, decision: 'allow' }),
    });
    const body = (await decision.json()) as { data: { redirect_url: string } };
    code = new URL(body.data.redirect_url).searchParams.get('code');
  }

  const body: Record<string, string> = {
    grant_type: 'authorization_code',
    code: code!,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
    client_id: client.id,
  };
  if (client.secret) body.client_secret = client.secret;

  const res = await fetch(`${ctx!.base}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  assert.equal(res.status, 200, 'token exchange succeeded');
  return (await res.json()) as IssuedTokens;
};

const form = (
  path: string,
  fields: Record<string, string>,
  credentials?: { id: string; secret?: string },
): Promise<Response> => {
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
  };
  const body = { ...fields };
  if (credentials) {
    body.client_id = credentials.id;
    if (credentials.secret) body.client_secret = credentials.secret;
  }
  return fetch(`${ctx!.base}${path}`, { method: 'POST', headers, body: new URLSearchParams(body) });
};

const userinfoWith = (token: string): Promise<Response> =>
  fetch(`${ctx!.base}/oauth/userinfo`, { headers: { authorization: `Bearer ${token}` } });

// ── Cache directives ─────────────────────────────────────────────────────────

test('token and introspection responses forbid caching', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  // A cached token response is a token handed to whoever asks the cache next.
  const tokenRes = await form(
    '/oauth/token',
    { grant_type: 'authorization_code', code: 'bogus', redirect_uri: REDIRECT_URI, code_verifier: 'x' },
    primary,
  );
  assert.equal(tokenRes.headers.get('cache-control'), 'no-store');
  assert.equal(tokenRes.headers.get('pragma'), 'no-cache');

  const introspectRes = await form('/oauth/introspect', { token: 'bogus' }, primary);
  assert.equal(introspectRes.headers.get('cache-control'), 'no-store');
  assert.equal(introspectRes.headers.get('pragma'), 'no-cache');
});

// ── Token type confusion (plan §2.3-1) ───────────────────────────────────────

test('a first-party session token is not an OIDC access token', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  // The same string that authenticates the account API is worthless at the OIDC
  // resource endpoint: it is HS256 against a server-only secret, so it has no `kid`,
  // no `at+jwt`, and no signature this endpoint could ever verify.
  const asOidc = await userinfoWith(ctx!.sessionToken);
  assert.equal(asOidc.status, 401);
  assert.equal(((await asOidc.json()) as { error: string }).error, 'invalid_token');

  // ...while it still works where it belongs, proving the token itself is valid and the
  // rejection above is about type, not expiry.
  const asFirstParty = await fetch(`${ctx!.base}/api/me/profile`, {
    headers: { authorization: `Bearer ${ctx!.sessionToken}` },
  });
  assert.equal(asFirstParty.status, 200);
});

test('an OIDC access token cannot drive the first-party API', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const tokens = await issueTokens(primary);

  // The reference's worst bug, in one request: there, a relying party's access token
  // passes the first-party middleware and can manage clients or revoke consents.
  const asFirstParty = await fetch(`${ctx!.base}/api/me/profile`, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  assert.equal(asFirstParty.status, 401);

  // And it does work at the endpoint it was minted for.
  assert.equal((await userinfoWith(tokens.access_token)).status, 200);
});

test('an ID token is not an access token, however validly it is signed', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const tokens = await issueTokens(primary);

  // Same keyring, same algorithm, same issuer — separated by `typ` and `aud` alone,
  // which is exactly the confusion RFC 9068 exists to prevent.
  const res = await userinfoWith(tokens.id_token);
  assert.equal(res.status, 401);

  const introspected = await form('/oauth/introspect', { token: tokens.id_token }, primary);
  assert.equal(((await introspected.json()) as { active: boolean }).active, false);
});

test('the access token carries iss, aud, kid and typ=at+jwt', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const tokens = await issueTokens(primary);
  const [rawHeader, rawClaims] = tokens.access_token.split('.');
  const header = JSON.parse(Buffer.from(rawHeader!, 'base64url').toString('utf8'));
  const claims = JSON.parse(Buffer.from(rawClaims!, 'base64url').toString('utf8'));

  assert.equal(header.typ, 'at+jwt', 'RFC 9068 media type');
  assert.equal(header.alg, 'RS256');
  assert.ok(header.kid, 'a kid, so a second signing key does not break verification');

  assert.equal(claims.iss, 'http://localhost:4000');
  // Audienced at the resource server, not the client — that is what keeps it distinct
  // from the ID token, whose `aud` is the client.
  assert.equal(claims.aud, 'http://localhost:4000');
  assert.equal(claims.client_id, primary.id);
  assert.equal(claims.scope, 'openid email');
  assert.ok(claims.jti);
});

test('an expired access token is refused before the TTL reaper removes it', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { OAuthAccessToken } = await import('./oauth-access-token.model');
  const { hashToken } = await import('../../common/utils/crypto.utils');

  const tokens = await issueTokens(primary);
  const tokenHash = hashToken(tokens.access_token);
  assert.equal((await userinfoWith(tokens.access_token)).status, 200);

  /*
   * Mongo's TTL monitor runs on a ~60 s cycle, so this is the real state of an expired
   * token for up to a minute: physically present and perfectly readable. The signed
   * `exp` claim is not the whole story either — a token can be revoked long before it
   * expires — so the store's explicit `expiresAt` predicate is what has to refuse it.
   */
  await OAuthAccessToken.updateOne(
    { tokenHash },
    { $set: { expiresAt: new Date(Date.now() - 60_000) } },
  );
  assert.ok(
    await OAuthAccessToken.findOne({ tokenHash }).lean(),
    'the document is still physically present',
  );

  assert.equal(
    (await userinfoWith(tokens.access_token)).status,
    401,
    'the read path refuses it without waiting for the reaper',
  );

  const introspected = await form('/oauth/introspect', { token: tokens.access_token }, primary);
  assert.deepEqual(await introspected.json(), { active: false });
});

// ── RFC 7009 revocation ──────────────────────────────────────────────────────

test('revocation requires client authentication', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const tokens = await issueTokens(primary);

  const res = await form('/oauth/revoke', { token: tokens.access_token });
  assert.equal(res.status, 401);
  assert.equal(((await res.json()) as { error: string }).error, 'invalid_client');

  // The token survives the unauthenticated attempt.
  assert.equal((await userinfoWith(tokens.access_token)).status, 200);
});

test('revoking a token kills it immediately and cascades across its grant', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { OAuthAccessToken } = await import('./oauth-access-token.model');
  const { AccessTokenStore } = await import('./access-token.store');

  const tokens = await issueTokens(primary);
  const { hashToken } = await import('../../common/utils/crypto.utils');
  const record = (await OAuthAccessToken.findOne({
    tokenHash: hashToken(tokens.access_token),
  }).lean())!;
  assert.ok(record.grantId, 'every token records the grant it was minted under');

  /*
   * A second token sharing the grant. Today only one token per code exists, so this
   * stands in for what M3's refresh rotation will produce — and it is the case RFC 7009
   * §2.1 is actually about: revoking one credential must invalidate everything else
   * issued under the same authorization grant, not just the string that was submitted.
   */
  const sibling = randomBase64Url(32);
  await AccessTokenStore.create({
    token: sibling,
    userId: ctx!.userId,
    clientId: primary.id,
    scope: record.scope,
    grantId: record.grantId,
  });
  assert.ok(await AccessTokenStore.findLive(sibling), 'the sibling starts out live');

  const res = await form('/oauth/revoke', { token: tokens.access_token }, primary);
  // §2.2: the response body is empty and the status is 200 regardless of outcome.
  assert.equal(res.status, 200);
  assert.equal((await res.text()).length, 0);

  assert.equal((await userinfoWith(tokens.access_token)).status, 401, 'revocation is immediate');
  assert.equal(
    await AccessTokenStore.findLive(sibling),
    null,
    'and it took the rest of the grant with it',
  );
});

test('revocation is not an oracle: unknown tokens and other clients both get a silent 200', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  // §2.2: "the authorization server responds with HTTP status code 200 if ... the
  // client submitted an invalid token". A 400 here would let a caller enumerate.
  const unknown = await form('/oauth/revoke', { token: randomBase64Url(32) }, primary);
  assert.equal(unknown.status, 200);

  // Another client's live token: same 200, and it must still be alive afterwards.
  const victim = await issueTokens(other);
  const crossClient = await form('/oauth/revoke', { token: victim.access_token }, primary);
  assert.equal(crossClient.status, 200);
  assert.equal(
    (await userinfoWith(victim.access_token)).status,
    200,
    'a client cannot revoke a token it was not issued',
  );

  const badHint = await form(
    '/oauth/revoke',
    { token: victim.access_token, token_type_hint: 'nonsense' },
    primary,
  );
  assert.equal(badHint.status, 400);
  assert.equal(((await badHint.json()) as { error: string }).error, 'unsupported_token_type');
});

// ── RFC 7662 introspection ───────────────────────────────────────────────────

test('introspection refuses unauthenticated callers rather than becoming an oracle', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const tokens = await issueTokens(primary);

  const anonymous = await form('/oauth/introspect', { token: tokens.access_token });
  assert.equal(anonymous.status, 401);
  const body = (await anonymous.json()) as Record<string, unknown>;
  assert.equal(body.error, 'invalid_client');
  // Critically, no `active` field at all: an unauthenticated caller learns nothing
  // about the token, not even that it is inactive.
  assert.equal(body.active, undefined);

  const wrongSecret = await form('/oauth/introspect', { token: tokens.access_token }, {
    id: primary.id,
    secret: 'not-the-secret',
  });
  assert.equal(wrongSecret.status, 401);

  // A public client authenticates with `none`, so honouring it here would mean
  // honouring anyone who can read a client_id out of a browser URL (RFC 7662 §4).
  const asPublicClient = await form('/oauth/introspect', { token: tokens.access_token }, publicSpa);
  assert.equal(asPublicClient.status, 401);
  assert.equal(((await asPublicClient.json()) as { error: string }).error, 'invalid_client');
});

test('introspection describes a live token to the client that owns it', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const tokens = await issueTokens(primary);

  const res = await form('/oauth/introspect', { token: tokens.access_token }, primary);
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.active, true);
  assert.equal(body.scope, 'openid email');
  assert.equal(body.client_id, primary.id);
  assert.equal(body.sub, ctx!.userId);
  assert.equal(body.token_type, 'Bearer');
  assert.equal(body.iss, 'http://localhost:4000');
  assert.equal(body.aud, 'http://localhost:4000');
  assert.ok(typeof body.exp === 'number' && body.exp > Math.floor(Date.now() / 1000));
  assert.ok(body.jti);
});

test('introspection answers "inactive" for anything the caller has no claim to', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const tokens = await issueTokens(primary);

  // Another client's live token — indistinguishable from a string that never existed.
  const asOther = await form('/oauth/introspect', { token: tokens.access_token }, other);
  assert.deepEqual(await asOther.json(), { active: false });

  const garbage = await form('/oauth/introspect', { token: 'not-even-a-jwt' }, primary);
  assert.deepEqual(await garbage.json(), { active: false });

  // A revoked token, which the record still remembers, reads as inactive rather than
  // as "revoked" — the distinction is ours to audit, not the caller's to learn.
  await form('/oauth/revoke', { token: tokens.access_token }, primary);
  const revoked = await form('/oauth/introspect', { token: tokens.access_token }, primary);
  assert.deepEqual(await revoked.json(), { active: false });
});

// ── RP-initiated logout ──────────────────────────────────────────────────────
// These run last: the successful case deliberately terminates the harness session.

test('end_session refuses a post_logout_redirect_uri the client has not registered', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  const params = new URLSearchParams({
    client_id: primary.id,
    post_logout_redirect_uri: 'http://evil.example/landing',
    state: 'xyz',
  });
  const res = await fetch(`${ctx!.base}/oauth/logout?${params}`, {
    headers: { cookie: ctx!.cookie },
    redirect: 'manual',
  });

  // Rendered, never redirected. An unvalidated redirect here is an open redirector on
  // an endpoint that is by definition reached in a half-authenticated state.
  assert.equal(res.status, 400);
  assert.equal(((await res.json()) as { error: string }).error, 'invalid_request');

  // The refusal has no side effect: the session is still live.
  const stillIn = await fetch(`${ctx!.base}/api/me/profile`, {
    headers: { authorization: `Bearer ${ctx!.sessionToken}` },
  });
  assert.equal(stillIn.status, 200);
});

test('end_session identifies the client from a signed id_token_hint', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const tokens = await issueTokens(primary);

  // `other` has no registered post-logout URI, so if the hint were ignored — or trusted
  // without checking its signature — this would redirect instead of refusing.
  const viaHint = new URLSearchParams({
    id_token_hint: tokens.id_token,
    post_logout_redirect_uri: POST_LOGOUT_URI,
  });
  const res = await fetch(`${ctx!.base}/oauth/logout?${viaHint}`, { redirect: 'manual' });
  assert.equal(res.status, 302, 'the hint resolved to the client that registered this URI');
  assert.equal(new URL(res.headers.get('location')!).origin + new URL(res.headers.get('location')!).pathname, POST_LOGOUT_URI);

  const forged = new URLSearchParams({
    id_token_hint: `${tokens.id_token.split('.').slice(0, 2).join('.')}.YmFkLXNpZ25hdHVyZQ`,
    post_logout_redirect_uri: POST_LOGOUT_URI,
  });
  const rejected = await fetch(`${ctx!.base}/oauth/logout?${forged}`, { redirect: 'manual' });
  assert.equal(rejected.status, 400, 'an unsigned hint identifies nothing');
});

test('end_session terminates the session, revokes the client\'s tokens, and echoes state', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const tokens = await issueTokens(primary);

  const params = new URLSearchParams({
    client_id: primary.id,
    post_logout_redirect_uri: POST_LOGOUT_URI,
    state: 'rp-state-123',
  });
  const res = await fetch(`${ctx!.base}/oauth/logout?${params}`, {
    headers: { cookie: ctx!.cookie },
    redirect: 'manual',
  });
  assert.equal(res.status, 302);
  const target = new URL(res.headers.get('location')!);
  assert.equal(target.origin + target.pathname, POST_LOGOUT_URI);
  assert.equal(target.searchParams.get('state'), 'rp-state-123');

  // The OP session is gone...
  const afterLogout = await fetch(`${ctx!.base}/api/me/profile`, {
    headers: { authorization: `Bearer ${ctx!.sessionToken}` },
  });
  assert.equal(afterLogout.status, 401);

  // ...and so is the access token the relying party was holding, which is what makes
  // "log out" mean anything to the application the user is logging out of.
  assert.equal((await userinfoWith(tokens.access_token)).status, 401);
});
