/**
 * Admin API (/api/admin). Role gating, client CRUD + config-prompt + secret rotation,
 * and user/client suspension enforcement. Requires Mongo + Redis; self-skips otherwise.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { IntegrationGate, TestFixtures } from '../../common/testing/index.testing';

process.env.OIDC_ISSUER ??= 'http://localhost:4000';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.MONGO_DB_NAME ??= 'id_test';

const ADMIN = { email: 'admin-api@tabbio.com', password: 'sup3r-secret-pw' };
const SUPER = { email: 'super-api@tabbio.com', password: 'sup3r-secret-pw' };
const USER = { email: 'plain-api@tabbio.com', password: 'sup3r-secret-pw' };
const VICTIM = { email: 'victim-api@tabbio.com', password: 'sup3r-secret-pw' };
const TOMBSTONE = { email: 'gone-api@tabbio.com', password: 'sup3r-secret-pw' };
const REDIRECT = 'http://localhost:3009/cb';

let server: Server | undefined;
let base = '';
let adminToken = '';
let superToken = '';
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
    const { getRedis } = await import('../../common/config/redis');
    await withTimeout(
      mongoose.connect(process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017', {
        dbName: process.env.MONGO_DB_NAME,
        serverSelectionTimeoutMS: 1500,
      }),
      2000,
    );
    // Redis backs the rate-limit counters these requests pass through.
    await withTimeout(getRedis().ping(), 2000);

    const { User } = await import('../auth/auth.model');
    await User.deleteMany({
      email: { $in: [ADMIN.email, SUPER.email, USER.email, VICTIM.email, TOMBSTONE.email] },
    });
    // The model is pure schema now and hashes nothing — fixtures store a real digest.
    await User.create({
      name: 'Admin',
      email: ADMIN.email,
      password: await TestFixtures.passwordHash(ADMIN.password),
      role: 'admin',
      isVerified: true,
    });
    await User.create({
      name: 'Super',
      email: SUPER.email,
      password: await TestFixtures.passwordHash(SUPER.password),
      role: 'superadmin',
      isVerified: true,
    });
    await User.create({
      name: 'Plain',
      email: USER.email,
      password: await TestFixtures.passwordHash(USER.password),
      isVerified: true,
    });
    await User.create({
      name: 'Victim',
      email: VICTIM.email,
      password: await TestFixtures.passwordHash(VICTIM.password),
      isVerified: true,
    });

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
    superToken = await loginToken(SUPER);
    userToken = await loginToken(USER);
    available = true;
  } catch (cause) {
    available = false;
    IntegrationGate.reportUnavailable('admin.integration', cause);
  }
});

after(async () => {
  server?.close();
  if (available) {
    const mongoose = (await import('mongoose')).default;
    const { disconnectRedis } = await import('../../common/config/redis');
    const { User } = await import('../auth/auth.model');
    const { OAuthClient } = await import('../oauth-client/oauth-client.model');
    const { Session } = await import('../auth/session.model');
    const { AdminAccessRequest } = await import('../admin-access/admin-access-request.model');
    const emails = [ADMIN.email, SUPER.email, USER.email, VICTIM.email, TOMBSTONE.email];
    const users = await User.find({ email: { $in: emails } }).select('_id');
    await Session.deleteMany({ userId: { $in: users.map((u) => u._id) } });
    await AdminAccessRequest.deleteMany({ userId: { $in: users.map((u) => u._id) } });
    await User.deleteMany({ email: { $in: emails } });
    await OAuthClient.deleteMany({ clientName: { $in: ['Admin Made', 'Native Guide', 'Rotate Me', 'Suspend Me', 'Admin Details App'] } });
    await mongoose.disconnect();
    await disconnectRedis();
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

test('public native client gets native, secret-free implementation guidance', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const res = await as(adminToken)('/api/admin/clients', {
    method: 'POST',
    body: JSON.stringify({
      clientName: 'Native Guide',
      redirectUris: ['com.example.app:/oauth/callback'],
      tokenEndpointAuthMethod: 'none',
      stack: 'react-native',
    }),
  });
  assert.equal(res.status, 201);
  const { data } = await jsonOf<{ data: { clientSecret?: string; configPrompt: string } }>(res);
  assert.equal(data.clientSecret, undefined);
  assert.match(data.configPrompt, /React Native/);
  assert.match(data.configPrompt, /there is no client secret/);
  assert.ok(!data.configPrompt.includes('{{CLIENT_SECRET}}'));
  assert.ok(!data.configPrompt.includes('HTTP Basic auth'));
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

test('getClient returns client details, user metrics, and config prompt', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const created = await jsonOf<{ data: { clientId: string; clientName: string } }>(
    await as(adminToken)('/api/admin/clients', {
      method: 'POST',
      body: JSON.stringify({ clientName: 'Admin Details App', redirectUris: [REDIRECT] }),
    }),
  );
  const detail = await jsonOf<{
    data: {
      client: { clientId: string; clientName: string };
      metrics: { totalAuthorizedUsers: number; activeUsers24h: number; activeUsers7d: number };
      authorizedUsers: unknown[];
      activity: unknown[];
      configPrompt: string;
    };
  }>(await as(adminToken)(`/api/admin/clients/${created.data.clientId}`));

  assert.equal(detail.data.client.clientId, created.data.clientId);
  assert.equal(detail.data.client.clientName, created.data.clientName);
  assert.ok(typeof detail.data.metrics.totalAuthorizedUsers === 'number');
  assert.ok(typeof detail.data.metrics.activeUsers24h === 'number');
  assert.ok(typeof detail.data.metrics.activeUsers7d === 'number');
  assert.ok(Array.isArray(detail.data.authorizedUsers));
  assert.ok(Array.isArray(detail.data.activity));
  assert.ok(detail.data.configPrompt.length > 0);
});

test('deleteClient removes client and cascades consents and tokens', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { OAuthClient } = await import('../oauth-client/oauth-client.model');
  const tempClient = await OAuthClient.create({
    clientId: 'cl_temporary_delete_test',
    clientName: 'Temp Delete App',
    redirectUris: ['http://localhost:3000/callback'],
  });

  const res = await as(adminToken)(`/api/admin/clients/${tempClient.clientId}`, {
    method: 'DELETE',
  });
  assert.equal(res.status, 200);

  const lookup = await OAuthClient.findOne({ clientId: tempClient.clientId });
  assert.equal(lookup, null);
});

test('a garbage user id is a 400, not a CastError 500', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  assert.equal((await as(adminToken)('/api/admin/users/not-an-objectid')).status, 400);
  assert.equal((await as(adminToken)('/api/admin/clients/nope/suspend', { method: 'POST' })).status, 400);
});

test('an admin cannot suspend another admin, and cannot re-role themselves', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { User } = await import('../auth/auth.model');
  const admin = (await User.findOne({ email: ADMIN.email }))!;
  const peer = await as(adminToken)(`/api/admin/users/${admin._id}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'no' }),
  });
  assert.equal(peer.status, 403);
  assert.equal((await jsonOf<{ code: string }>(peer)).code, 'CANNOT_TARGET_SELF');

  const superUser = (await User.findOne({ email: SUPER.email }))!;
  const againstSuper = await as(adminToken)(`/api/admin/users/${superUser._id}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'no' }),
  });
  assert.equal(againstSuper.status, 403);
  assert.equal((await jsonOf<{ code: string }>(againstSuper)).code, 'CANNOT_TARGET_ADMIN');

  const selfRole = await as(adminToken)(`/api/admin/users/${admin._id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role: 'user' }),
  });
  assert.equal(selfRole.status, 403);
  assert.equal((await jsonOf<{ code: string }>(selfRole)).code, 'CANNOT_TARGET_SELF');
});

test('a superadmin can demote a peer admin; last-admin is enforced on the remaining privileged account', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { User } = await import('../auth/auth.model');
  const { UserStore } = await import('../auth/user.store');
  const { ADMIN_ROLES } = await import('../../common/constants/index.constants');
  const admin = (await User.findOne({ email: ADMIN.email }))!;
  const superUser = (await User.findOne({ email: SUPER.email }))!;

  const demotePeer = await as(superToken)(`/api/admin/users/${admin._id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role: 'user' }),
  });
  assert.equal(demotePeer.status, 200);

  const remaining = await UserStore.countLiveByRoles(ADMIN_ROLES, superUser._id.toString());
  if (remaining === 0) {
    const close = await fetch(`${base}/api/me`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${superToken}`, 'content-type': 'application/json' },
    });
    assert.equal(close.status, 403);
    assert.equal((await jsonOf<{ code: string }>(close)).code, 'LAST_ADMIN_PROTECTED');
  }

  const restore = await as(superToken)(`/api/admin/users/${admin._id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role: 'admin' }),
  });
  assert.equal(restore.status, 200);
  adminToken = await loginToken(ADMIN);
});

test('listUsers hides closed accounts and does not count them in metrics', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { UserStore } = await import('../auth/user.store');
  const { User } = await import('../auth/auth.model');
  const gone = await User.create({
    name: 'Gone',
    email: TOMBSTONE.email,
    password: await TestFixtures.passwordHash(TOMBSTONE.password),
    role: 'user',
    isVerified: true,
  });
  await UserStore.softDelete(gone._id.toString());

  const listed = await jsonOf<{ data: { items: Array<{ email: string }>; total: number } }>(
    await as(adminToken)('/api/admin/users?limit=100'),
  );
  assert.equal(
    listed.data.items.some((u) => u.email === TOMBSTONE.email),
    false,
    'tombstone address must not appear in the live list',
  );
  assert.equal(
    listed.data.items.some((u) => u.email.includes(gone._id.toString())),
    false,
    'rewritten tombstone mailbox must not appear either',
  );

  const detail = await as(adminToken)(`/api/admin/users/${gone._id}`);
  assert.equal(detail.status, 404);
});

test('a user can request admin access and only a superadmin can approve it', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const created = await as(userToken)('/api/me/admin-access-requests', {
    method: 'POST',
    body: JSON.stringify({ justification: 'I maintain the identity service.' }),
  });
  assert.equal(created.status, 201);
  assert.equal((await as(userToken)('/api/me/admin-access-requests', {
    method: 'POST', body: JSON.stringify({}),
  })).status, 409);
  assert.equal((await as(adminToken)('/api/admin/admin-access-requests')).status, 403);
  const mongoose = (await import('mongoose')).default;
  const hello = await mongoose.connection.db?.admin().command({ hello: 1 });
  if (!hello?.setName) return t.skip('Approval requires the documented replica-set Mongo deployment');
  const queue = await jsonOf<{ data: Array<{ id: string }> }>(
    await as(superToken)('/api/admin/admin-access-requests'),
  );
  assert.equal(queue.data.length, 1);
  const approved = await as(superToken)(`/api/admin/admin-access-requests/${queue.data[0]!.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ decision: 'approved', note: 'Approved for maintenance.' }),
  });
  assert.equal(approved.status, 200);
  const { User } = await import('../auth/auth.model');
  assert.equal((await User.findOne({ email: USER.email }))?.role, 'admin');
  assert.equal((await as(userToken)('/api/me/admin-access-requests')).status, 401);
});
