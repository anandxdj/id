/**
 * Session enrichment + revocation (M2). Requires Mongo (for the session.* events) +
 * Redis (the session store); self-skips when unavailable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { redis } from '../../common/config/redis';
import { IntegrationGate } from '../../common/testing/index.testing';
import * as authService from './auth.service';
import type { IUser } from './auth.model';

process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.MONGO_DB_NAME ??= 'id_test';

const USER_ID = new mongoose.Types.ObjectId().toString();
const fakeUser = { _id: { toString: () => USER_ID }, role: 'user' } as unknown as IUser;
let available = false;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('probe timeout')), ms))]);

const sidOf = (refreshToken: string): string => {
  const [, payload] = refreshToken.split('.');
  return JSON.parse(Buffer.from(payload!, 'base64url').toString()).sid as string;
};

before(async () => {
  try {
    await withTimeout(
      mongoose.connect(process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017', {
        dbName: process.env.MONGO_DB_NAME,
        serverSelectionTimeoutMS: 1500,
      }),
      2000,
    );
    await withTimeout(redis.ping(), 2000);
    available = true;
  } catch (error) {
    available = false;
    IntegrationGate.reportUnavailable('session', error);
  }
});

after(async () => {
  if (available) {
    const keys = await redis.keys(`session:${USER_ID}:*`);
    if (keys.length) await redis.del(...keys);
    await mongoose.disconnect();
    redis.disconnect();
  }
});

test('createSession stores a metadata blob (ua/ip/createdAt/lastSeenAt)', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { refreshToken } = await authService.createSession(fakeUser, { ua: 'jest-UA', ip: '5.6.7.8' });
  const sid = sidOf(refreshToken);
  const raw = await redis.get(`session:${USER_ID}:${sid}`);
  const rec = JSON.parse(raw!);
  assert.equal(rec.ua, 'jest-UA');
  assert.equal(rec.ip, '5.6.7.8');
  assert.ok(rec.createdAt > 0 && rec.lastSeenAt > 0);
});

test('listSessions returns all sessions and flags the current one', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const a = await authService.createSession(fakeUser, { ua: 'device-A' });
  const b = await authService.createSession(fakeUser, { ua: 'device-B' });
  const sidA = sidOf(a.refreshToken);
  const sidB = sidOf(b.refreshToken);

  const list = await authService.listSessions(USER_ID, sidB);
  const found = list.filter((s) => s.sid === sidA || s.sid === sidB);
  assert.ok(found.length >= 2);
  assert.equal(list.find((s) => s.sid === sidB)?.current, true);
  assert.equal(list.find((s) => s.sid === sidA)?.current, false);
  assert.ok(list[0]!.expiresInSeconds > 0);
});

test('touchSession advances lastSeenAt past the throttle window', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { refreshToken } = await authService.createSession(fakeUser, { ua: 'touch-me' });
  const sid = sidOf(refreshToken);
  const key = `session:${USER_ID}:${sid}`;

  // Backdate lastSeenAt beyond the throttle so touch actually writes.
  const rec = JSON.parse((await redis.get(key))!);
  rec.lastSeenAt = Date.now() - 120_000;
  await redis.set(key, JSON.stringify(rec), 'KEEPTTL');

  await authService.touchSession(USER_ID, sid);
  const after = JSON.parse((await redis.get(key))!);
  assert.ok(after.lastSeenAt > rec.lastSeenAt, 'lastSeenAt advanced');
  assert.ok((await redis.ttl(key)) > 0, 'TTL preserved');
});

test('revokeSession removes exactly one session', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const a = await authService.createSession(fakeUser, { ua: 'keep' });
  const b = await authService.createSession(fakeUser, { ua: 'kill' });
  const sidB = sidOf(b.refreshToken);

  const ok = await authService.revokeSession(USER_ID, sidB);
  assert.equal(ok, true);
  assert.equal(await redis.get(`session:${USER_ID}:${sidB}`), null);
  assert.ok(await redis.get(`session:${USER_ID}:${sidOf(a.refreshToken)}`), 'other session survives');
});

test('revokeAllSessions(except) keeps only the caller session', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  // clear any prior sessions for a clean count
  const pre = await redis.keys(`session:${USER_ID}:*`);
  if (pre.length) await redis.del(...pre);

  const keep = await authService.createSession(fakeUser, { ua: 'current' });
  await authService.createSession(fakeUser, { ua: 'other-1' });
  await authService.createSession(fakeUser, { ua: 'other-2' });
  const keepSid = sidOf(keep.refreshToken);

  const revoked = await authService.revokeAllSessions(USER_ID, keepSid);
  assert.equal(revoked, 2);
  const remaining = await redis.keys(`session:${USER_ID}:*`);
  assert.deepEqual(remaining, [`session:${USER_ID}:${keepSid}`]);
});
