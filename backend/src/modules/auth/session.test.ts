/**
 * Sessions, now a TTL-indexed Mongo collection rather than a Redis keyspace (M1).
 *
 * The assertions deliberately go against `sessions` documents, and two of them exist
 * purely to pin down properties a Redis TTL gave us for free and a Mongo TTL does not:
 * an expired document stays readable until the reaper gets to it, and a query without a
 * `userId` predicate would happily return somebody else's sessions.
 *
 * Requires Mongo; self-skips when unavailable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { IntegrationGate } from '../../common/testing/index.testing';
import { hashToken } from '../../common/utils/crypto.utils';
import * as authService from './auth.service';
import { SessionStore } from './session.store';
import { Session } from './session.model';
import type { IUser } from './auth.model';

process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.MONGO_DB_NAME ??= 'id_test';

const USER_ID = new mongoose.Types.ObjectId().toString();
const OTHER_USER_ID = new mongoose.Types.ObjectId().toString();
const userFor = (id: string) =>
  ({ _id: { toString: () => id }, role: 'user' }) as unknown as IUser;
const fakeUser = userFor(USER_ID);
let available = false;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('probe timeout')), ms))]);

/** The sid lives in the refresh token; the store keys documents by its hash. */
const sidOf = (refreshToken: string): string => {
  const [, payload] = refreshToken.split('.');
  return JSON.parse(Buffer.from(payload!, 'base64url').toString()).sid as string;
};

const clearSessions = () =>
  Session.deleteMany({ userId: { $in: [USER_ID, OTHER_USER_ID] } });

before(async () => {
  try {
    await withTimeout(
      mongoose.connect(process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017', {
        dbName: process.env.MONGO_DB_NAME,
        serverSelectionTimeoutMS: 1500,
      }),
      2000,
    );
    available = true;
  } catch (error) {
    available = false;
    IntegrationGate.reportUnavailable('session', error);
  }
});

after(async () => {
  if (available) {
    await clearSessions();
    await mongoose.disconnect();
  }
});

test('createSession persists a session document and stores only a hash of the sid', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { refreshToken } = await authService.createSession(fakeUser, { ua: 'test-UA', ip: '5.6.7.8' });
  const sid = sidOf(refreshToken);

  const stored = await Session.findById(SessionStore.handleOf(sid)).lean();
  assert.ok(stored, 'session document exists under the hashed sid');
  assert.equal(stored.userAgent, 'test-UA');
  assert.equal(stored.ipAddress, '5.6.7.8');
  assert.equal(stored.revokedAt, null);
  assert.ok(stored.createdAt instanceof Date && stored.lastSeenAt instanceof Date);
  assert.ok(stored.expiresAt.getTime() > Date.now(), 'expiresAt is in the future');

  // The raw sid must never be recoverable from the database.
  assert.equal(stored._id, hashToken(sid));
  assert.equal(await Session.findById(sid).lean(), null, 'raw sid is not a key');
});

test('listSessions returns all of the caller sessions and flags the current one', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clearSessions();
  const a = await authService.createSession(fakeUser, { ua: 'device-A' });
  const b = await authService.createSession(fakeUser, { ua: 'device-B' });
  const handleA = SessionStore.handleOf(sidOf(a.refreshToken));
  const handleB = SessionStore.handleOf(sidOf(b.refreshToken));

  // Addressed by handle: since M3 the middleware puts the handle on `req.user.sessionId`,
  // so the raw sid never leaves the token it was minted into.
  const list = await authService.listSessions(USER_ID, handleB);
  assert.equal(list.length, 2);
  assert.equal(list.find((s) => s.sid === handleB)?.current, true);
  assert.equal(list.find((s) => s.sid === handleA)?.current, false);
  assert.ok(list[0]!.expiresInSeconds > 0);
});

test('listSessions never returns another user sessions', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clearSessions();
  await authService.createSession(fakeUser, { ua: 'mine' });
  await authService.createSession(userFor(OTHER_USER_ID), { ua: 'theirs' });

  const mine = await authService.listSessions(USER_ID);
  assert.equal(mine.length, 1);
  assert.equal(mine[0]!.ua, 'mine');
});

test('an expired session is rejected before the TTL reaper removes it', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clearSessions();
  const { refreshToken } = await authService.createSession(fakeUser, { ua: 'stale' });
  const sid = sidOf(refreshToken);

  // Mongo's TTL monitor runs on a ~60 s cycle, so this is exactly the state a real
  // request hits in the minute after a session dies: the document is still there.
  await Session.updateOne(
    { _id: SessionStore.handleOf(sid) },
    { $set: { expiresAt: new Date(Date.now() - 60_000) } },
  );
  assert.ok(await Session.findById(SessionStore.handleOf(sid)).lean(), 'document is still present');

  assert.equal(await authService.findActiveSession(USER_ID, sid), null, 'read path refuses it');
  assert.deepEqual(await authService.listSessions(USER_ID), [], 'and it is not listed');
});

test('touchSession advances lastSeenAt past the throttle window without extending expiry', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { refreshToken } = await authService.createSession(fakeUser, { ua: 'touch-me' });
  const sid = sidOf(refreshToken);
  const handle = SessionStore.handleOf(sid);

  // Backdate lastSeenAt beyond the throttle so the conditional write actually matches.
  const backdated = new Date(Date.now() - 120_000);
  await Session.updateOne({ _id: handle }, { $set: { lastSeenAt: backdated } });
  const before = (await Session.findById(handle).lean())!;

  await authService.touchSession(USER_ID, sid);
  const updated = (await Session.findById(handle).lean())!;
  assert.ok(updated.lastSeenAt > backdated, 'lastSeenAt advanced');
  assert.equal(
    updated.expiresAt.getTime(),
    before.expiresAt.getTime(),
    'the absolute session window is not slid forward',
  );

  // Immediately touching again is throttled to no write at all.
  await authService.touchSession(USER_ID, sid);
  const again = (await Session.findById(handle).lean())!;
  assert.equal(again.lastSeenAt.getTime(), updated.lastSeenAt.getTime(), 'second touch was skipped');
});

test('revokeSession revokes exactly one session and is idempotent', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clearSessions();
  const keep = await authService.createSession(fakeUser, { ua: 'keep' });
  const kill = await authService.createSession(fakeUser, { ua: 'kill' });
  const killHandle = SessionStore.handleOf(sidOf(kill.refreshToken));

  assert.equal(await authService.revokeSession(USER_ID, killHandle), true);
  assert.equal(
    await authService.findActiveSession(USER_ID, sidOf(kill.refreshToken)),
    null,
    'revoked session no longer authenticates',
  );
  assert.ok(
    await authService.findActiveSession(USER_ID, sidOf(keep.refreshToken)),
    'the other session survives',
  );

  // Revocation is a soft write, so the row remains as evidence with a reason attached.
  const revoked = (await Session.findById(killHandle).lean())!;
  assert.ok(revoked.revokedAt instanceof Date);
  assert.ok(revoked.revokedReason);

  assert.equal(await authService.revokeSession(USER_ID, killHandle), false, 'second revoke is a no-op');
});

test('revokeAllSessions(except) keeps only the caller session and spares other users', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clearSessions();
  const keep = await authService.createSession(fakeUser, { ua: 'current' });
  await authService.createSession(fakeUser, { ua: 'other-1' });
  await authService.createSession(fakeUser, { ua: 'other-2' });
  await authService.createSession(userFor(OTHER_USER_ID), { ua: 'bystander' });
  const keepHandle = SessionStore.handleOf(sidOf(keep.refreshToken));

  const revoked = await authService.revokeAllSessions(USER_ID, keepHandle);
  assert.equal(revoked, 2);

  const remaining = await authService.listSessions(USER_ID, keepHandle);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]!.sid, keepHandle);
  assert.equal(remaining[0]!.current, true);

  const bystanders = await authService.listSessions(OTHER_USER_ID);
  assert.equal(bystanders.length, 1, 'another user is untouched by revoke-all');
});
