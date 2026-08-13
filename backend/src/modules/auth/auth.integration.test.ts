/**
 * Auth integration: register → login → me → logout, plus session-revocation rejection.
 * Requires a reachable MongoDB + Redis. Self-skips when they are unavailable (e.g. local
 * dev without `pnpm db:up`); runs fully in CI where the services are provisioned.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { IntegrationGate } from '../../common/testing/index.testing';

process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.MONGO_DB_NAME ??= 'id_test';

let server: Server | undefined;
let base = '';
let available = false;

const extractCookie = (res: Response, name: string): string | undefined => {
  const raw = res.headers.get('set-cookie');
  if (!raw) return undefined;
  const match = raw.split(/,(?=[^;]+=)/).find((c) => c.trim().startsWith(`${name}=`));
  return match?.split(';')[0];
};

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('probe timeout')), ms)),
  ]);

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
    // Redis no longer stores sessions, but it does back the rate-limit counters every
    // request here passes through.
    await withTimeout(getRedis().ping(), 2000);
    const { User } = await import('./auth.model');
    await User.deleteMany({ email: 'itest@tabbio.com' });

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
    available = true;
  } catch (cause) {
    available = false;
    // Release any half-open handles so node:test can exit cleanly.
    try {
      const mongoose = (await import('mongoose')).default;
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
    try {
      const { disconnectRedis } = await import('../../common/config/redis');
      await disconnectRedis();
    } catch {
      /* ignore */
    }
    IntegrationGate.reportUnavailable('auth.integration', cause);
  }
});

after(async () => {
  server?.close();
  if (available) {
    const mongoose = (await import('mongoose')).default;
    const { disconnectRedis } = await import('../../common/config/redis');
    const { User } = await import('./auth.model');
    const { Session } = await import('./session.model');
    const user = await User.findOne({ email: 'itest@tabbio.com' });
    if (user) await Session.deleteMany({ userId: user._id });
    await User.deleteMany({ email: 'itest@tabbio.com' });
    await mongoose.disconnect();
    await disconnectRedis();
  }
});

test('register → login → me → logout, and revoked session is rejected', async (t) => {
  if (!available) {
    t.skip('Mongo/Redis not reachable');
    return;
  }

  const creds = { email: 'itest@tabbio.com', password: 'sup3r-secret-pw' };

  // register
  const reg = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Integration Test', ...creds }),
  });
  assert.equal(reg.status, 201);

  // Registering the same address again is answered identically — a 409 here, which is what
  // this endpoint used to return, is a working account-existence oracle. The byte-for-byte
  // comparison lives in `identity.integration.test.ts`; this only pins the status.
  const dup = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Integration Test', ...creds }),
  });
  assert.equal(dup.status, 201);

  // wrong password → 401
  const badLogin = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: creds.email, password: 'wrong' }),
  });
  assert.equal(badLogin.status, 401);

  // login
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(creds),
  });
  assert.equal(login.status, 200);
  const loginBody = (await login.json()) as { data: { accessToken: string; user: { email: string } } };
  const accessToken = loginBody.data.accessToken;
  assert.equal(loginBody.data.user.email, creds.email);
  const refreshCookie = extractCookie(login, 'refreshToken');
  assert.ok(refreshCookie, 'login sets a refreshToken cookie');

  // me with bearer
  const me = await fetch(`${base}/api/auth/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  assert.equal(me.status, 200);

  // me without token → 401
  const meAnon = await fetch(`${base}/api/auth/me`);
  assert.equal(meAnon.status, 401);

  // logout (revokes session)
  const logout = await fetch(`${base}/api/auth/logout`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, cookie: refreshCookie! },
  });
  assert.equal(logout.status, 200);

  // after logout the session is revoked → me now 401 even with the same token
  const meAfter = await fetch(`${base}/api/auth/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  assert.equal(meAfter.status, 401);
});
