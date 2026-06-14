/**
 * Activity event store. The non-throwing contract is verified without any datastore;
 * persistence / query / TTL assertions require Mongo and self-skip when unavailable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import * as events from './event.service';
import AuthEvent from './event.model';

process.env.MONGO_DB_NAME ??= 'id_test';
const TAG = 'm1-test-ua'; // tag rows via `ua` so cleanup never touches real data

// ── Always-on: record() must never throw, even when the write fails ────────────
test('record() swallows a DB failure and does not throw', async () => {
  const origCreate = AuthEvent.create;
  const origWarn = console.warn;
  let warned = false;
  // @ts-expect-error swap the static for the test
  AuthEvent.create = () => Promise.reject(new Error('boom'));
  console.warn = () => {
    warned = true;
  };
  try {
    await assert.doesNotReject(() => events.record('login.success', { ip: '1.2.3.4' }));
    assert.equal(warned, true, 'a failed write should be logged, not thrown');
  } finally {
    AuthEvent.create = origCreate;
    console.warn = origWarn;
  }
});

// ── Mongo-backed assertions ────────────────────────────────────────────────────
let available = false;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('probe timeout')), ms))]);

before(async () => {
  try {
    await withTimeout(
      mongoose.connect(process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017', {
        dbName: process.env.MONGO_DB_NAME,
        serverSelectionTimeoutMS: 1500,
      }),
      2000,
    );
    await AuthEvent.syncIndexes();
    await AuthEvent.deleteMany({ ua: TAG });
    available = true;
  } catch {
    available = false;
  }
});

after(async () => {
  if (available) {
    await AuthEvent.deleteMany({ ua: TAG });
    await mongoose.disconnect();
  }
});

test('persists an event with actor, type, ip, ua', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const actorUserId = new mongoose.Types.ObjectId().toString();
  await events.record('login.success', { actorUserId, ip: '9.9.9.9', ua: TAG });

  const row = await AuthEvent.findOne({ ua: TAG, actorUserId }).lean();
  assert.ok(row, 'event was written');
  assert.equal(row!.type, 'login.success');
  assert.equal(row!.ip, '9.9.9.9');
  assert.ok(row!.createdAt instanceof Date);
});

test('query() filters by type and returns newest-first within the limit', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const actorUserId = new mongoose.Types.ObjectId().toString();
  const clientId = 'cl_m1test';
  await events.record('login.success', { actorUserId, ua: TAG });
  await events.record('token.issued', { actorUserId, clientId, ua: TAG });
  await events.record('userinfo.access', { actorUserId, clientId, ua: TAG });

  const issued = await events.query({ actorUserId, type: 'token.issued' });
  assert.equal(issued.length, 1);
  assert.equal(issued[0]!.type, 'token.issued');

  const all = await events.query({ actorUserId, limit: 2 });
  assert.equal(all.length, 2, 'limit is respected');
  assert.ok(all[0]!.createdAt >= all[1]!.createdAt, 'newest first');
});

test('lastUsedByClient() returns the latest touch per client', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const actorUserId = new mongoose.Types.ObjectId().toString();
  await events.record('token.issued', { actorUserId, clientId: 'cl_a', ua: TAG });
  await events.record('userinfo.access', { actorUserId, clientId: 'cl_a', ua: TAG });
  await events.record('token.issued', { actorUserId, clientId: 'cl_b', ua: TAG });

  const map = await events.lastUsedByClient(actorUserId);
  assert.ok(map['cl_a'] instanceof Date);
  assert.ok(map['cl_b'] instanceof Date);
});

test('a TTL index exists on createdAt', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const idx = await AuthEvent.collection.indexes();
  const ttl = idx.find((i) => 'expireAfterSeconds' in i && i.key?.createdAt === 1);
  assert.ok(ttl, 'TTL index on createdAt is present');
});
