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
    const { redis } = await import('../../common/config/redis');
    const { initOidcKeys } = await import('../../common/utils/keys.utils');

    await withTimeout(
      mongoose.connect(process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017', {
        dbName: process.env.MONGO_DB_NAME,
        serverSelectionTimeoutMS: 1500,
      }),
      2000,
    );
    await withTimeout(redis.ping(), 2000);
    await initOidcKeys();

    const { User } = await import('../auth/auth.model');
    const clientService = await import('../oauth-client/oauth-client.service');
    await User.deleteMany({ email: EMAIL });
    await User.create({ name: 'OIDC Flow', email: EMAIL, password: PASSWORD, isVerified: true });
    const created = await clientService.create({ clientName: 'Flow Test', redirectUris: [REDIRECT_URI] });
    clientId = created.clientId;
    clientSecret = created.clientSecret;

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
  } catch {
    available = false;
    try {
      const mongoose = (await import('mongoose')).default;
      await mongoose.disconnect();
    } catch { /* ignore */ }
    try {
      const { redis } = await import('../../common/config/redis');
      redis.disconnect();
    } catch { /* ignore */ }
    console.log('[oauth.flow] Mongo/Redis unavailable — skipping integration tests');
  }
});

after(async () => {
  server?.close();
  if (available) {
    const mongoose = (await import('mongoose')).default;
    const { redis } = await import('../../common/config/redis');
    const { User } = await import('../auth/auth.model');
    const { OAuthClient } = await import('../oauth-client/oauth-client.model');
    const Consent = (await import('./consent.model')).default;
    await User.deleteMany({ email: EMAIL });
    await OAuthClient.deleteMany({ clientId });
    await Consent.deleteMany({ clientId });
    await mongoose.disconnect();
    redis.disconnect();
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

  // Verify the ID token signature against the published JWKS + check claims.
  const { getJwksDocument } = await import('../../common/utils/keys.utils');
  const jwk = getJwksDocument().keys[0] as crypto.JsonWebKey;
  const pubKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const [h, p, s] = tokens.id_token.split('.');
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
