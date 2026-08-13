/**
 * The login throttle, at store level.
 *
 * This is the deliberate departure from "counters live in Redis": Redis fails open, and
 * failing open on a login throttle means unlimited password guessing during a cache outage.
 * The counter therefore lives in Mongo, and these tests pin the three properties that
 * distinguish a throttle from the reference implementation's account-bricking lockout
 * (§2.3-2, §2.3-10):
 *
 *  1. The increment is atomic, so a concurrent burst counts as a burst rather than as one.
 *  2. A lock **expires**. This is the important one: the reference resets its counter only
 *     on a successful login while refusing to examine credentials whenever the counter is at
 *     the threshold, so success is unreachable and five unauthenticated requests brick any
 *     known address permanently.
 *  3. An un-reaped window cannot hold a lock past its end, because the read path checks
 *     `windowExpiresAt` explicitly rather than trusting the TTL monitor.
 *
 * Requires Mongo; self-skips when unavailable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { IntegrationGate } from '../../common/testing/index.testing';
import { hashToken } from '../../common/utils/crypto.utils';
import { LOGIN_THROTTLE } from '../../common/constants/index.constants';
import { LoginThrottleStore } from './login-throttle.store';
import { LoginThrottle } from './login-throttle.model';

process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.MONGO_DB_NAME ??= 'id_test';

const EMAIL = 'throttle-target@example.com';
/** An address that was never registered — it must throttle exactly like one that was. */
const UNKNOWN_EMAIL = 'throttle-nobody@example.com';
const KEYS = [hashToken(EMAIL), hashToken(UNKNOWN_EMAIL)];
let available = false;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('probe timeout')), ms))]);

const clear = () => LoginThrottle.deleteMany({ _id: { $in: KEYS } });

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
    IntegrationGate.reportUnavailable('login-throttle', error);
  }
});

after(async () => {
  if (available) {
    await clear();
    await mongoose.disconnect();
  }
});

test('the counter is keyed by digest, not by the address itself', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clear();
  await LoginThrottleStore.recordFailure(EMAIL);

  // This is the one collection an unauthenticated attacker can grow at will, one document
  // per address guessed. Storing them verbatim would accumulate an attacker-curated mailing
  // list for no operational gain, since every lookup here is an exact match.
  assert.equal(await LoginThrottle.findById(EMAIL).lean(), null, 'raw address is not a key');
  assert.ok(await LoginThrottle.findById(hashToken(EMAIL)).lean(), 'stored under its digest');
});

test('failures accumulate and the lock engages exactly at the threshold', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clear();

  for (let attempt = 1; attempt < LOGIN_THROTTLE.MAX_ATTEMPTS; attempt += 1) {
    const state = await LoginThrottleStore.recordFailure(EMAIL);
    assert.equal(state.failedAttempts, attempt);
    assert.equal(state.locked, false, `not locked at ${attempt} of ${LOGIN_THROTTLE.MAX_ATTEMPTS}`);
  }

  const locking = await LoginThrottleStore.recordFailure(EMAIL);
  assert.equal(locking.failedAttempts, LOGIN_THROTTLE.MAX_ATTEMPTS);
  assert.equal(locking.locked, true, 'locked on the threshold failure');
  assert.ok(locking.retryAfterSeconds > 0, 'and reports when to come back');

  assert.equal((await LoginThrottleStore.check(EMAIL)).locked, true, 'a later check agrees');
});

test('an address that does not exist throttles identically', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clear();

  // Keyed on the *submitted* address rather than a resolved user. Keying on a found user
  // would leave unknown addresses unthrottled, which is both an unlimited-rate guessing
  // channel and an existence oracle in its own right.
  for (let i = 0; i < LOGIN_THROTTLE.MAX_ATTEMPTS; i += 1) {
    await LoginThrottleStore.recordFailure(UNKNOWN_EMAIL);
  }
  assert.equal((await LoginThrottleStore.check(UNKNOWN_EMAIL)).locked, true);
});

test('a concurrent burst of failures counts as a burst, not as one', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clear();

  // Read-then-write in application code — which is what the reference does — loses updates
  // here, so the threshold becomes bypassable by concurrency alone. A single
  // aggregation-pipeline update on one document cannot lose them.
  const parallel = LOGIN_THROTTLE.MAX_ATTEMPTS;
  await Promise.all(
    Array.from({ length: parallel }, () => LoginThrottleStore.recordFailure(EMAIL)),
  );

  const stored = (await LoginThrottle.findById(hashToken(EMAIL)).lean())!;
  assert.equal(stored.failedAttempts, parallel, `all ${parallel} failures were counted`);
  assert.equal((await LoginThrottleStore.check(EMAIL)).locked, true);
});

test('a successful login forgets the counter entirely', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clear();
  await LoginThrottleStore.recordFailure(EMAIL);
  await LoginThrottleStore.recordFailure(EMAIL);

  await LoginThrottleStore.clear(EMAIL);

  // A delete, not a reset: the counter is a control, not a log. Failed-attempt history for
  // audit lives in the events store.
  assert.equal(await LoginThrottle.findById(hashToken(EMAIL)).lean(), null);
  const state = await LoginThrottleStore.check(EMAIL);
  assert.equal(state.failedAttempts, 0);
  assert.equal(state.locked, false);
});

/**
 * The test that proves this is a window and not a lockout.
 *
 * `lockedUntil` is backdated rather than waiting out the real fifteen minutes, which is the
 * same manoeuvre the TTL regression tests use: the document is left physically present in
 * exactly the state a real request would find it in after the lock elapsed but before the
 * reaper arrived.
 */
test('a lock lifts once its window passes — five requests cannot brick an address', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clear();

  for (let i = 0; i < LOGIN_THROTTLE.MAX_ATTEMPTS; i += 1) {
    await LoginThrottleStore.recordFailure(EMAIL);
  }
  assert.equal((await LoginThrottleStore.check(EMAIL)).locked, true, 'locked to begin with');

  // Wind the clock past the lock, leaving the window itself still open.
  const key = hashToken(EMAIL);
  await LoginThrottle.updateOne(
    { _id: key },
    {
      $set: {
        lockedUntil: new Date(Date.now() - 1_000),
        windowExpiresAt: new Date(Date.now() + LOGIN_THROTTLE.WINDOW_MS),
      },
    },
  );

  const recovered = await LoginThrottleStore.check(EMAIL);
  assert.equal(recovered.locked, false, 'the lock lifted on its own');
  assert.equal(recovered.retryAfterSeconds, 0);
  assert.ok(
    await LoginThrottle.findById(key).lean(),
    'and it did so with the document still present — nothing had to run to release it',
  );
});

test('an elapsed window cannot hold a lock, even before the TTL reaper collects it', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clear();

  for (let i = 0; i < LOGIN_THROTTLE.MAX_ATTEMPTS; i += 1) {
    await LoginThrottleStore.recordFailure(EMAIL);
  }

  // Window elapsed, lock nominally still in the future, document not yet reaped — the state
  // a request sees during the up-to-a-minute lag of Mongo's TTL monitor. The read path's
  // explicit `windowExpiresAt` predicate is the only thing that decides this correctly.
  const key = hashToken(EMAIL);
  await LoginThrottle.updateOne(
    { _id: key },
    {
      $set: {
        windowExpiresAt: new Date(Date.now() - 60_000),
        lockedUntil: new Date(Date.now() + LOGIN_THROTTLE.LOCK_MS),
      },
    },
  );
  assert.ok(await LoginThrottle.findById(key).lean(), 'document is still physically present');

  assert.equal((await LoginThrottleStore.check(EMAIL)).locked, false, 'and holds no lock');

  // The next failure restarts the count from one rather than continuing the dead window.
  const restarted = await LoginThrottleStore.recordFailure(EMAIL);
  assert.equal(restarted.failedAttempts, 1, 'the counter decayed rather than accumulating');
});

test('locking extends the window so the reaper cannot cut a lock short', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clear();

  // A near-elapsed window at the moment the lock engages: without the `$max` in the store's
  // second pipeline stage, the TTL reaper would delete the document seconds later and hand
  // the attacker their five attempts straight back.
  const key = hashToken(EMAIL);
  await LoginThrottleStore.recordFailure(EMAIL);
  await LoginThrottle.updateOne(
    { _id: key },
    { $set: { failedAttempts: LOGIN_THROTTLE.MAX_ATTEMPTS - 1, windowExpiresAt: new Date(Date.now() + 1_000) } },
  );

  const locked = await LoginThrottleStore.recordFailure(EMAIL);
  assert.equal(locked.locked, true);

  const stored = (await LoginThrottle.findById(key).lean())!;
  assert.ok(
    stored.windowExpiresAt.getTime() >= stored.lockedUntil!.getTime(),
    'the document outlives the lock it is holding',
  );
});
