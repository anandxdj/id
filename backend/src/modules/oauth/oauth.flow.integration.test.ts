/**
 * End-to-end OIDC acceptance gate: authorize → consent → token → userinfo, plus PKCE
 * and single-use-code negatives, with ID-token signature verified against the JWKS.
 * Requires Mongo + Redis; self-skips when unavailable (runs fully in CI).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import { pkceChallengeS256, randomBase64Url } from '../../common/utils/crypto.utils';
import { IntegrationGate, TestFixtures } from '../../common/testing/index.testing';

process.env.OIDC_ISSUER ??= 'http://localhost:4000';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.MONGO_DB_NAME ??= 'id_test';

const EMAIL = 'oidc-flow@tabbio.com';
const PASSWORD = 'sup3r-secret-pw';
const REDIRECT_URI = 'http://localhost:3001/cb';

let server: Server | undefined;
let base = '';
let available = false;
let clientId = '';
let clientSecret = '';
let accessCookie = '';

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('probe timeout')), ms))]);

before(async () => {
  try {
    const mongoose = (await import('mongoose')).default;
    const { getRedis } = await import('../../common/config/redis');
    const { SigningKeyService } = await import('./signing-key.service');

    await withTimeout(
      mongoose.connect(process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017', {
        dbName: process.env.MONGO_DB_NAME,
        serverSelectionTimeoutMS: 1500,
      }),
      2000,
    );
    // Codes, requests and tokens are Mongo collections since M1; Redis is here only
    // because it backs the rate-limit counters on /oauth/token.
    await withTimeout(getRedis().ping(), 2000);
    // The token-endpoint limiter is a shared 15-minute counter keyed on IP, so without
    // this a second run inside the window inherits the first run's budget.
    const { OidcHarness } = await import('../../common/testing/index.testing');
    await OidcHarness.clearRateLimitCounters();
    // Since M4 the keyring is a Mongo collection, so this must follow the connect.
    await SigningKeyService.init();

    const { User } = await import('../auth/auth.model');
    const clientService = await import('../oauth-client/oauth-client.service');
    await User.deleteMany({ email: EMAIL });
    // The model is pure schema now and hashes nothing — fixtures store a real digest.
    await User.create({
      name: 'OIDC Flow',
      email: EMAIL,
      password: await TestFixtures.passwordHash(PASSWORD),
      isVerified: true,
    });
    const created = await clientService.create({ clientName: 'Flow Test', redirectUris: [REDIRECT_URI] });
    clientId = created.clientId;
    clientSecret = created.clientSecret!;

    const { createApp } = await import('../../app');
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server!.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        base = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Log in to obtain an access token, used as the session cookie for /authorize.
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const body = (await login.json()) as { data: { accessToken: string } };
    accessCookie = `accessToken=${body.data.accessToken}`;
    available = true;
  } catch (cause) {
    available = false;
    try {
      const mongoose = (await import('mongoose')).default;
      await mongoose.disconnect();
    } catch { /* ignore */ }
    try {
      const { disconnectRedis } = await import('../../common/config/redis');
      await disconnectRedis();
    } catch { /* ignore */ }
    IntegrationGate.reportUnavailable('oauth.flow', cause);
  }
});

after(async () => {
  server?.close();
  if (available) {
    const mongoose = (await import('mongoose')).default;
    const { disconnectRedis } = await import('../../common/config/redis');
    const { User } = await import('../auth/auth.model');
    const { OAuthClient } = await import('../oauth-client/oauth-client.model');
    const Consent = (await import('./consent.model')).default;
    const { Session } = await import('../auth/session.model');
    const { OAuthAuthCode } = await import('./oauth-auth-code.model');
    const { OAuthAuthRequest } = await import('./oauth-auth-request.model');
    const { OAuthAccessToken } = await import('./oauth-access-token.model');
    const user = await User.findOne({ email: EMAIL });
    if (user) {
      await Session.deleteMany({ userId: user._id });
      await OAuthAuthRequest.deleteMany({ userId: user._id });
    }
    await User.deleteMany({ email: EMAIL });
    await OAuthClient.deleteMany({ clientId });
    await Consent.deleteMany({ clientId });
    await OAuthAuthCode.deleteMany({ clientId });
    await OAuthAccessToken.deleteMany({ clientId });
    await mongoose.disconnect();
    await disconnectRedis();
  }
});

test('authorize → consent → token → userinfo, with PKCE + single-use code', async (t) => {
  if (!available) {
    t.skip('Mongo/Redis not reachable');
    return;
  }

  const verifier = randomBase64Url(32);
  const challenge = pkceChallengeS256(verifier);
  const state = 'state-123';
  const nonce = 'nonce-abc';

  const authParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    nonce,
  });

  // First authorize → no consent yet → 302 to /consent?transaction_id=…
  const authRes = await fetch(`${base}/oauth/authorize?${authParams}`, {
    headers: { cookie: accessCookie },
    redirect: 'manual',
  });
  assert.equal(authRes.status, 302);
  const consentLoc = new URL(authRes.headers.get('location')!);
  assert.match(consentLoc.pathname, /\/consent$/);
  const transactionId = consentLoc.searchParams.get('transaction_id');
  assert.ok(transactionId);

  // Bearer token for the first-party consent API.
  const bearer = accessCookie.replace('accessToken=', '');

  // Consent context reflects the request.
  const ctx = await fetch(`${base}/api/oauth/consent/context?transaction_id=${transactionId}`, {
    headers: { authorization: `Bearer ${bearer}` },
  });
  assert.equal(ctx.status, 200);
  const ctxBody = (await ctx.json()) as { data: { client_id: string; scope: string } };
  assert.equal(ctxBody.data.client_id, clientId);
  assert.equal(ctxBody.data.scope, 'openid email profile');

  // Allow → redirect_url carries code + state.
  const allow = await fetch(`${base}/api/oauth/consent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ transaction_id: transactionId, decision: 'allow' }),
  });
  assert.equal(allow.status, 200);
  const allowBody = (await allow.json()) as { data: { redirect_url: string } };
  const cbUrl = new URL(allowBody.data.redirect_url);
  assert.equal(cbUrl.searchParams.get('state'), state);
  const code = cbUrl.searchParams.get('code');
  assert.ok(code);

  // Token exchange (client_secret_post).
  const tokenRes = await fetch(`${base}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code!,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  assert.equal(tokenRes.status, 200);
  const tokens = (await tokenRes.json()) as {
    access_token: string;
    id_token: string;
    token_type: string;
    expires_in: number;
  };
  assert.equal(tokens.token_type, 'Bearer');
  assert.equal(tokens.expires_in, 900);

  // Verify the ID token signature against the published JWKS + check claims. The key is
  // selected by the token's own `kid` rather than by position: JWKS holds every key that
  // may still verify, so "the first one" stops being the right one the moment a
  // rotation leaves a retired key published alongside the active one.
  const { SigningKeyService } = await import('./signing-key.service');
  const [h, p, s] = tokens.id_token.split('.');
  const kid = JSON.parse(Buffer.from(h!, 'base64url').toString('utf8')).kid as string;
  const jwk = SigningKeyService.jwks().keys.find(
    (key) => (key as { kid: string }).kid === kid,
  ) as crypto.JsonWebKey;
  assert.ok(jwk, 'the signing key is published in JWKS under the kid the token names');
  const pubKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const v = crypto.createVerify('RSA-SHA256');
  v.update(`${h}.${p}`);
  assert.equal(v.verify(pubKey, Buffer.from(s!, 'base64url')), true);
  const claims = JSON.parse(Buffer.from(p!, 'base64url').toString('utf8'));
  assert.equal(claims.iss, 'http://localhost:4000');
  assert.equal(claims.aud, clientId);
  assert.equal(claims.nonce, nonce);
  assert.equal(claims.email, EMAIL);
  assert.equal(claims.name, 'OIDC Flow');
  assert.ok(claims.sub);

  // Userinfo with the opaque access token.
  const userinfo = await fetch(`${base}/oauth/userinfo`, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  assert.equal(userinfo.status, 200);
  const ui = (await userinfo.json()) as { sub: string; email: string; name: string };
  assert.equal(ui.email, EMAIL);
  assert.equal(ui.sub, claims.sub);

  // Single-use code: replaying the same code now fails.
  const replay = await fetch(`${base}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code!,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  assert.equal(replay.status, 400);
  const replayBody = (await replay.json()) as { error: string };
  assert.equal(replayBody.error, 'invalid_grant');
});

/** Obtain a fresh authorization code. Consent is already granted by the first test, so
 *  /authorize hands one back without a consent round-trip. */
const freshCode = async (verifier: string, state = 'state-reuse'): Promise<string> => {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid',
    state,
    code_challenge: pkceChallengeS256(verifier),
    code_challenge_method: 'S256',
  });
  const res = await fetch(`${base}/oauth/authorize?${params}`, {
    headers: { cookie: accessCookie },
    redirect: 'manual',
  });
  return new URL(res.headers.get('location')!).searchParams.get('code')!;
};

const redeem = (code: string, verifier: string) =>
  fetch(`${base}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

/** Events are recorded fire-and-forget, so give the write a moment to land. */
const eventuallyCount = async (type: string, atLeast: number): Promise<number> => {
  const { AuthEvent } = await import('../events/event.model');
  const deadline = Date.now() + 2000;
  let count = 0;
  do {
    count = await AuthEvent.countDocuments({ type });
    if (count >= atLeast) return count;
    await new Promise((r) => setTimeout(r, 50));
  } while (Date.now() < deadline);
  return count;
};

test('a replayed valid code is distinguishable from an unknown one, and revokes what it issued', async (t) => {
  if (!available) {
    t.skip('Mongo/Redis not reachable');
    return;
  }
  const { OAuthAuthCode } = await import('./oauth-auth-code.model');
  const { OAuthAccessToken } = await import('./oauth-access-token.model');
  const { hashToken } = await import('../../common/utils/crypto.utils');

  const verifier = randomBase64Url(32);
  const code = await freshCode(verifier);
  const codeHash = hashToken(code);

  const first = await redeem(code, verifier);
  assert.equal(first.status, 200);
  const issued = (await first.json()) as { access_token: string };

  // The redemption is a compare-and-set that keeps the row: consumed, not deleted, and
  // pointing at what it issued.
  const consumed = (await OAuthAuthCode.findOne({ codeHash }).lean())!;
  assert.ok(consumed.consumedAt instanceof Date, 'code is marked consumed');
  assert.equal(consumed.issuedAccessTokenHash, hashToken(issued.access_token));
  assert.equal((await OAuthAccessToken.findOne({ tokenHash: consumed.issuedAccessTokenHash }).lean())!.revokedAt, null);

  const replaysBefore = await eventuallyCount('oauth.code.replayed', 0);

  // Replay of a genuine code: same 400 to the client, but a security event for us.
  const replay = await redeem(code, verifier);
  assert.equal(replay.status, 400);
  assert.equal(((await replay.json()) as { error: string }).error, 'invalid_grant');

  assert.equal(
    await eventuallyCount('oauth.code.replayed', replaysBefore + 1),
    replaysBefore + 1,
    'the replay was recorded as a security event',
  );
  const revoked = (await OAuthAccessToken.findOne({ tokenHash: consumed.issuedAccessTokenHash }).lean())!;
  assert.ok(revoked.revokedAt instanceof Date, 'the token issued from the code was revoked');

  // ...and the revoked token no longer works at a resource endpoint.
  const userinfo = await fetch(`${base}/oauth/userinfo`, {
    headers: { authorization: `Bearer ${issued.access_token}` },
  });
  assert.equal(userinfo.status, 401);

  // An unknown code looks the same to the client but records nothing: losing that
  // distinction is exactly what a findOneAndDelete-based redemption would cost us.
  const unknown = await redeem(randomBase64Url(32), verifier);
  assert.equal(unknown.status, 400);
  assert.equal(((await unknown.json()) as { error: string }).error, 'invalid_grant');
  assert.equal(
    await eventuallyCount('oauth.code.replayed', replaysBefore + 2),
    replaysBefore + 1,
    'an unknown code is not treated as a replay',
  );
});

test('an expired code is refused before the TTL reaper removes it', async (t) => {
  if (!available) {
    t.skip('Mongo/Redis not reachable');
    return;
  }
  const { OAuthAuthCode } = await import('./oauth-auth-code.model');
  const { hashToken } = await import('../../common/utils/crypto.utils');

  const verifier = randomBase64Url(32);
  const code = await freshCode(verifier, 'state-expired');
  const codeHash = hashToken(code);

  // Mongo's TTL monitor runs on a ~60 s cycle, so this is the real state of an expired
  // code for up to a minute: still present, and must not be spendable.
  await OAuthAuthCode.updateOne({ codeHash }, { $set: { expiresAt: new Date(Date.now() - 60_000) } });
  assert.ok(await OAuthAuthCode.findOne({ codeHash }).lean(), 'document is still present');

  const res = await redeem(code, verifier);
  assert.equal(res.status, 400);
  assert.equal(((await res.json()) as { error: string }).error, 'invalid_grant');
  assert.equal(
    (await OAuthAuthCode.findOne({ codeHash }).lean())!.consumedAt,
    null,
    'an expired code is never claimed, so it cannot be confused with a replay',
  );
});

test('a consent transaction can be claimed once, and only by its owner', async (t) => {
  if (!available) {
    t.skip('Mongo/Redis not reachable');
    return;
  }
  const mongoose = (await import('mongoose')).default;
  const { AuthRequestStore } = await import('./auth-request.store');
  const { OAuthAuthRequest } = await import('./oauth-auth-request.model');

  const owner = new mongoose.Types.ObjectId().toString();
  const stranger = new mongoose.Types.ObjectId().toString();
  const transactionId = `txn_cas_${Date.now()}`;
  await AuthRequestStore.create({
    transactionId,
    userId: owner,
    clientId,
    redirectUri: REDIRECT_URI,
    scope: 'openid',
    state: 'st',
    codeChallenge: 'x'.repeat(43),
    codeChallengeMethod: 'S256',
  });

  assert.equal(await AuthRequestStore.consume(transactionId, stranger), null, 'scoped to its owner');
  assert.ok(await AuthRequestStore.findPending(transactionId, owner), 'reading does not consume');
  assert.ok(await AuthRequestStore.consume(transactionId, owner), 'the owner claims it');
  assert.equal(
    await AuthRequestStore.consume(transactionId, owner),
    null,
    'a second decision cannot mint a second code',
  );

  await OAuthAuthRequest.deleteOne({ transactionId });
});

test('token endpoint rejects a bad PKCE verifier', async (t) => {
  if (!available) {
    t.skip('Mongo/Redis not reachable');
    return;
  }

  const verifier = randomBase64Url(32);
  const challenge = pkceChallengeS256(verifier);
  const authParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid',
    state: 's2',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  // Consent already granted from the prior test → authorize returns a code directly.
  const authRes = await fetch(`${base}/oauth/authorize?${authParams}`, {
    headers: { cookie: accessCookie },
    redirect: 'manual',
  });
  assert.equal(authRes.status, 302);
  const code = new URL(authRes.headers.get('location')!).searchParams.get('code');
  assert.ok(code, 'returning user with consent gets a code without a consent round-trip');

  const tokenRes = await fetch(`${base}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code!,
      redirect_uri: REDIRECT_URI,
      code_verifier: 'wrong-verifier-entirely',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  assert.equal(tokenRes.status, 400);
  assert.equal(((await tokenRes.json()) as { error: string }).error, 'invalid_grant');
});
