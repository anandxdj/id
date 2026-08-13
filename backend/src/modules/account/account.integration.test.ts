/**
 * User self-service API (/api/me). Drives apps/sessions/profile over HTTP.
 *
 * Since M1 the access tokens and sessions this exercises live in Mongo, so the seeding
 * and the assertions go there. Redis is still probed because it backs the shared
 * rate-limit counters every one of these requests passes through.
 *
 * Requires Mongo + Redis; self-skips when unavailable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { IntegrationGate, TestFixtures } from '../../common/testing/index.testing';

process.env.OIDC_ISSUER ??= 'http://localhost:4000';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.MONGO_DB_NAME ??= 'id_test';

const EMAIL = 'me-api@tabbio.com';
const PASSWORD = 'sup3r-secret-pw';
const CLIENT_ID = 'cl_me_test';

let server: Server | undefined;
let base = '';
let token = '';
let userId = '';
let available = false;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('probe timeout')), ms))]);

const api = (path: string, init: RequestInit = {}) =>
  fetch(`${base}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });

const jsonOf = async <T>(res: Response): Promise<T> => (await res.json()) as T;

before(async () => {
  try {
    const mongoose = (await import('mongoose')).default;
    const { getRedis } = await import('../../common/config/redis');
    await withTimeout(
      mongoose.connect(process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017', {
        dbName: process.env.MONGO_DB_NAME,
        serverSelectionTimeoutMS: 1500,
      }),
      2000,
    );
    await withTimeout(getRedis().ping(), 2000);

    const { User } = await import('../auth/auth.model');
    await User.deleteMany({ email: EMAIL });
    const user = await User.create({
      name: 'Me Api',
      email: EMAIL,
      // The model is pure schema now and hashes nothing — fixtures store a real digest.
      password: await TestFixtures.passwordHash(PASSWORD),
      isVerified: true,
      jobTitle: 'Engineer',
    });
    userId = user._id.toString();

    const { createApp } = await import('../../app');
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server!.address();
        base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
        resolve();
      });
    });

    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    token = ((await login.json()) as { data: { accessToken: string } }).data.accessToken;
    available = true;
  } catch (cause) {
    available = false;
    IntegrationGate.reportUnavailable('account.integration', cause);
  }
});

after(async () => {
  server?.close();
  if (available) {
    const mongoose = (await import('mongoose')).default;
    const { disconnectRedis } = await import('../../common/config/redis');
    const { User } = await import('../auth/auth.model');
    const Consent = (await import('../oauth/consent.model')).default;
    const { Session } = await import('../auth/session.model');
    const { OAuthAccessToken } = await import('../oauth/oauth-access-token.model');
    await User.deleteMany({ email: EMAIL });
    await Consent.deleteMany({ clientId: CLIENT_ID });
    await Session.deleteMany({ userId });
    await OAuthAccessToken.deleteMany({ userId });
    await mongoose.disconnect();
    await disconnectRedis();
  }
});

test('/api/me/* requires authentication', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const res = await fetch(`${base}/api/me/apps`);
  assert.equal(res.status, 401);
});

test('apps: lists a consent then revokes it, killing the access token', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const Consent = (await import('../oauth/consent.model')).default;
  const { AccessTokenStore } = await import('../oauth/access-token.store');
  const { OAuthAccessToken } = await import('../oauth/oauth-access-token.model');

  // Seed a consent + a live access token. No index set to seed alongside it: the
  // `{ userId, clientId }` index is what the Redis set used to stand in for.
  await Consent.create({ userId, clientId: CLIENT_ID, scope: 'openid email' });
  const { tokenHash } = await AccessTokenStore.create({
    token: 'fake-access-token',
    userId,
    clientId: CLIENT_ID,
    scope: 'openid email',
  });

  const listed = await jsonOf<{ data: Array<{ clientId: string }> }>(await api('/api/me/apps'));
  assert.ok(listed.data.some((a) => a.clientId === CLIENT_ID), 'app is listed');

  const revoke = await api(`/api/me/apps/${CLIENT_ID}`, { method: 'DELETE' });
  const revokeBody = await jsonOf<{ data: { revokedTokens: number } }>(revoke);
  assert.equal(revoke.status, 200);
  assert.ok(revokeBody.data.revokedTokens >= 1, 'at least one token revoked');

  // Revoked, not deleted — the row survives as evidence with a reason recorded.
  const stored = (await OAuthAccessToken.findOne({ tokenHash }).lean())!;
  assert.ok(stored.revokedAt instanceof Date, 'access token is revoked');
  assert.ok(stored.revokedReason);
  assert.equal(await AccessTokenStore.findLive('fake-access-token'), null, 'and no longer resolves');
  assert.equal(await Consent.findOne({ userId, clientId: CLIENT_ID }), null, 'consent gone');
});

test('apps: an expired access token is refused before the TTL reaper removes it', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { AccessTokenStore } = await import('../oauth/access-token.store');
  const { OAuthAccessToken } = await import('../oauth/oauth-access-token.model');

  const { tokenHash } = await AccessTokenStore.create({
    token: 'stale-access-token',
    userId,
    clientId: CLIENT_ID,
    scope: 'openid',
  });
  await OAuthAccessToken.updateOne(
    { tokenHash },
    { $set: { expiresAt: new Date(Date.now() - 60_000) } },
  );

  assert.ok(await OAuthAccessToken.findOne({ tokenHash }).lean(), 'document is still present');
  assert.equal(
    await AccessTokenStore.findLive('stale-access-token'),
    null,
    'the read path enforces expiry itself rather than trusting the TTL index',
  );

  const userinfo = await fetch(`${base}/oauth/userinfo`, {
    headers: { authorization: 'Bearer stale-access-token' },
  });
  assert.equal(userinfo.status, 401);
});

test('apps: revoking an app the user never authorized is 404', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const res = await api('/api/me/apps/cl_never', { method: 'DELETE' });
  assert.equal(res.status, 404);
});

test('sessions: lists the current session and can revoke another', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const authService = await import('../auth/auth.service');
  const { SessionStore } = await import('../auth/session.store');
  const { User } = await import('../auth/auth.model');
  const user = (await User.findById(userId))!;
  const other = await authService.createSession(user, { ua: 'second-device' });
  const otherSid = JSON.parse(Buffer.from(other.refreshToken.split('.')[1]!, 'base64url').toString()).sid;
  // The API addresses sessions by handle, because the raw sid is a credential and is
  // never persisted or published.
  const otherHandle = SessionStore.handleOf(otherSid);

  const list = (await jsonOf<{ data: Array<{ sid: string; current: boolean }> }>(await api('/api/me/sessions'))).data;
  assert.ok(list.length >= 2);
  assert.equal(list.some((s) => s.current), true, 'one session is flagged current');
  assert.equal(list.some((s) => s.sid === otherHandle), true, 'the second device is listed');

  const del = await api(`/api/me/sessions/${otherHandle}`, { method: 'DELETE' });
  assert.equal(del.status, 200);
  const after = (await jsonOf<{ data: Array<{ sid: string }> }>(await api('/api/me/sessions'))).data;
  assert.equal(after.some((s) => s.sid === otherHandle), false, 'revoked session is gone');
});

test('profile: updates allowed fields and ignores role escalation', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const res = await api('/api/me/profile', {
    method: 'PATCH',
    body: JSON.stringify({ name: 'Renamed', company: 'Tabbio', role: 'admin' }),
  });
  const body = await jsonOf<{ data: { name: string; company: string; role: string } }>(res);
  assert.equal(res.status, 200);
  assert.equal(body.data.name, 'Renamed');
  assert.equal(body.data.company, 'Tabbio');
  assert.equal(body.data.role, 'user', 'role was not escalated');
});
