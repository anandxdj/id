/**
 * Admin API (/api/admin). Role gating, client CRUD + config-prompt + secret rotation,
 * and user/client suspension enforcement. Requires Mongo + Redis; self-skips otherwise.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';

process.env.OIDC_ISSUER ??= 'http://localhost:4000';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.MONGO_DB_NAME ??= 'id_test';

const ADMIN = { email: 'admin-api@tabbio.com', password: 'sup3r-secret-pw' };
const USER = { email: 'plain-api@tabbio.com', password: 'sup3r-secret-pw' };
const VICTIM = { email: 'victim-api@tabbio.com', password: 'sup3r-secret-pw' };
const REDIRECT = 'http://localhost:3009/cb';

let server: Server | undefined;
let base = '';
let adminToken = '';
let userToken = '';
let available = false;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('probe timeout')), ms))]);

const jsonOf = async <T>(res: Response): Promise<T> => (await res.json()) as T;

const as = (token: string) => (path: string, init: RequestInit = {}) =>
  fetch(`${base}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });

const loginToken = async (creds: { email: string; password: string }): Promise<string> => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(creds),
  });
  return (await jsonOf<{ data?: { accessToken: string } }>(res)).data?.accessToken ?? '';
};

before(async () => {
  try {
    const mongoose = (await import('mongoose')).default;
    const { redis } = await import('../../common/config/redis');
    await withTimeout(
      mongoose.connect(process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017', {
        dbName: process.env.MONGO_DB_NAME,
        serverSelectionTimeoutMS: 1500,
      }),
      2000,
    );
    await withTimeout(redis.ping(), 2000);

    const { User } = await import('../auth/auth.model');
    await User.deleteMany({ email: { $in: [ADMIN.email, USER.email, VICTIM.email] } });
    await User.create({ name: 'Admin', email: ADMIN.email, password: ADMIN.password, role: 'admin', isVerified: true });
    await User.create({ name: 'Plain', email: USER.email, password: USER.password, isVerified: true });
    await User.create({ name: 'Victim', email: VICTIM.email, password: VICTIM.password, isVerified: true });

    const { createApp } = await import('../../app');
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server!.address();
        base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
        resolve();
      });
    });
    adminToken = await loginToken(ADMIN);
    userToken = await loginToken(USER);
    available = true;
  } catch {
    available = false;
  }
});

after(async () => {
  server?.close();
  if (available) {
    const mongoose = (await import('mongoose')).default;
    const { redis } = await import('../../common/config/redis');
    const { User } = await import('../auth/auth.model');
    const { OAuthClient } = await import('../oauth-client/oauth-client.model');
    await User.deleteMany({ email: { $in: [ADMIN.email, USER.email, VICTIM.email] } });
    await OAuthClient.deleteMany({ clientName: { $in: ['Admin Made', 'Rotate Me', 'Suspend Me'] } });
    await mongoose.disconnect();
    redis.disconnect();
  }
});

test('non-admin is rejected from every admin route', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  assert.equal((await as(userToken)('/api/admin/users')).status, 403);
  assert.equal((await as(userToken)('/api/admin/metrics')).status, 403);
  assert.equal((await as('')('/api/admin/users')).status, 401);
  assert.equal((await as(adminToken)('/api/admin/users')).status, 200);
});

test('create client returns a one-time secret + a placeholder-only config-prompt', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const res = await as(adminToken)('/api/admin/clients', {
    method: 'POST',
    body: JSON.stringify({ clientName: 'Admin Made', redirectUris: [REDIRECT], stack: 'nextjs' }),
  });
  assert.equal(res.status, 201);
  const { data } = await jsonOf<{ data: { clientId: string; clientSecret: string; configPrompt: string } }>(res);
  assert.ok(data.clientId.startsWith('cl_'));
  assert.ok(data.clientSecret.length > 20);
  assert.ok(data.configPrompt.includes('{{CLIENT_SECRET}}'), 'prompt uses a placeholder');
  assert.ok(data.configPrompt.includes(data.clientId), 'prompt embeds the client id');
  assert.ok(!data.configPrompt.includes(data.clientSecret), 'prompt must NOT contain the real secret');
});

test('config-prompt endpoint tailors to the requested stack', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const created = await jsonOf<{ data: { clientId: string } }>(
    await as(adminToken)('/api/admin/clients', {
      method: 'POST',
      body: JSON.stringify({ clientName: 'Admin Made', redirectUris: [REDIRECT] }),
    }),
  );
  const id = created.data.clientId;
  const exp = await jsonOf<{ data: { prompt: string } }>(
    await as(adminToken)(`/api/admin/clients/${id}/config-prompt?stack=express`),
  );
  assert.match(exp.data.prompt, /Express/);
});

test('rotate-secret invalidates the old secret at the token endpoint', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const created = await jsonOf<{ data: { clientId: string; clientSecret: string } }>(
    await as(adminToken)('/api/admin/clients', {
      method: 'POST',
      body: JSON.stringify({ clientName: 'Rotate Me', redirectUris: [REDIRECT] }),
    }),
  );
  const { clientId, clientSecret: oldSecret } = created.data;

  const rotated = await jsonOf<{ data: { clientSecret: string } }>(
    await as(adminToken)(`/api/admin/clients/${clientId}/rotate-secret`, { method: 'POST' }),
  );
  const newSecret = rotated.data.clientSecret;
  assert.notEqual(newSecret, oldSecret);

  const tokenWith = (secret: string) =>
    fetch(`${base}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: 'bogus',
        redirect_uri: REDIRECT,
        code_verifier: 'bogus',
        client_id: clientId,
        client_secret: secret,
      }),
    });

  const oldRes = await tokenWith(oldSecret);
  assert.equal(oldRes.status, 401, 'old secret rejected as invalid_client');
  assert.equal((await jsonOf<{ error: string }>(oldRes)).error, 'invalid_client');

  const newRes = await tokenWith(newSecret);
  // New secret authenticates; failure now comes from the bogus code, not the secret.
  assert.equal(newRes.status, 400);
  assert.equal((await jsonOf<{ error: string }>(newRes)).error, 'invalid_grant');
});

test('a suspended client is rejected at /oauth/authorize', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const created = await jsonOf<{ data: { clientId: string } }>(
    await as(adminToken)('/api/admin/clients', {
      method: 'POST',
      body: JSON.stringify({ clientName: 'Suspend Me', redirectUris: [REDIRECT] }),
    }),
  );
  const id = created.data.clientId;
  assert.equal(
    (await as(adminToken)(`/api/admin/clients/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason: 'test' }) })).status,
    200,
  );

  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: 'openid',
    state: 's1',
    code_challenge: 'x'.repeat(43),
    code_challenge_method: 'S256',
  });
  const res = await fetch(`${base}/oauth/authorize?${params}`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location') ?? '', /error=access_denied/);
});

test('suspending a user disables login and live sessions', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const victimToken = await loginToken(VICTIM);
  assert.ok(victimToken, 'victim logged in before suspension');

  const { User } = await import('../auth/auth.model');
  const victim = (await User.findOne({ email: VICTIM.email }))!;
  const suspend = await as(adminToken)(`/api/admin/users/${victim._id}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'policy' }),
  });
  assert.equal(suspend.status, 200);

  // Existing token now rejected (session revoked + account disabled).
  assert.equal((await as(victimToken)('/api/me/profile')).status >= 401, true);
  // Fresh login blocked.
  const relog = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(VICTIM),
  });
  assert.equal(relog.status, 403);

  // Reinstate so the fixture is clean.
  await as(adminToken)(`/api/admin/users/${victim._id}/unsuspend`, { method: 'POST' });
});

test('getUser returns sessions, apps, and activity; metrics report totals', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { User } = await import('../auth/auth.model');
  const admin = (await User.findOne({ email: ADMIN.email }))!;
  const detail = await jsonOf<{ data: { user: unknown; sessions: unknown[]; apps: unknown[]; activity: unknown[] } }>(
    await as(adminToken)(`/api/admin/users/${admin._id}`),
  );
  assert.ok(detail.data.user);
  assert.ok(Array.isArray(detail.data.sessions));
  assert.ok(Array.isArray(detail.data.apps));
  assert.ok(Array.isArray(detail.data.activity));

  const metrics = await jsonOf<{ data: { totalUsers: number; totalClients: number } }>(
    await as(adminToken)('/api/admin/metrics'),
  );
  assert.ok(metrics.data.totalUsers >= 3);
  assert.ok(typeof metrics.data.totalClients === 'number');
});
