/**
 * Auth action tokens — the store-level invariants, for both token types.
 *
 * Four of these exist to pin down properties that are easy to believe you have and easy to
 * lose, each corresponding to a specific bug in the reference implementation:
 *
 *  - single-use is enforced *atomically*, not by read-then-write (§2.3-8);
 *  - re-issuing revokes every prior outstanding token (§2.3-9);
 *  - an expired-but-not-yet-reaped token is refused by the read path, because a Mongo TTL
 *    index is garbage collection on a ~60 s cycle and never an authorization boundary;
 *  - a token of one type cannot be spent as the other.
 *
 * Requires Mongo; self-skips when unavailable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { IntegrationGate } from '../../common/testing/index.testing';
import { hashToken } from '../../common/utils/crypto.utils';
import {
  ACTION_TOKEN_OUTCOME,
  ACTION_TOKEN_REVOKE_REASONS,
  ACTION_TOKEN_TYPES,
} from '../../common/constants/index.constants';
import { ActionTokenStore } from './action-token.store';
import { AuthActionToken } from './action-token.model';

process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.MONGO_DB_NAME ??= 'id_test';

const USER_ID = new mongoose.Types.ObjectId().toString();
const EMAIL = 'action-token@example.com';
let available = false;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('probe timeout')), ms))]);

const clear = () => AuthActionToken.deleteMany({ userId: USER_ID });

const issue = (type: (typeof ACTION_TOKEN_TYPES)[keyof typeof ACTION_TOKEN_TYPES]) =>
  ActionTokenStore.issue({ userId: USER_ID, type, sentToEmail: EMAIL });

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
    IntegrationGate.reportUnavailable('action-token', error);
  }
});

after(async () => {
  if (available) {
    await clear();
    await mongoose.disconnect();
  }
});

test('only the digest is stored — the token itself is never persisted', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clear();
  const { token, expiresAt } = await issue(ACTION_TOKEN_TYPES.EMAIL_VERIFICATION);

  assert.equal(await AuthActionToken.findOne({ tokenHash: token }).lean(), null, 'raw token is not a key');
  const stored = (await AuthActionToken.findOne({ tokenHash: hashToken(token) }).lean())!;
  assert.ok(stored, 'stored under its SHA-256');
  assert.equal(stored.consumedAt, null);
  assert.equal(stored.revokedAt, null);
  assert.equal(stored.sentToEmail, EMAIL, 'bound to the address it was mailed to');
  assert.ok(expiresAt.getTime() > Date.now(), 'expiry is in the future');
});

test('a token can be claimed exactly once, and a replay is distinguishable from a guess', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clear();
  const { token } = await issue(ACTION_TOKEN_TYPES.EMAIL_VERIFICATION);

  const first = await ActionTokenStore.claim(token, ACTION_TOKEN_TYPES.EMAIL_VERIFICATION);
  assert.equal(first.outcome, ACTION_TOKEN_OUTCOME.CLAIMED);
  // The pre-image is what the caller needs: which user, and which address.
  assert.equal(first.token?.userId.toString(), USER_ID);
  assert.equal(first.token?.consumedAt, null, 'the pre-image predates its own consumption');

  const replay = await ActionTokenStore.claim(token, ACTION_TOKEN_TYPES.EMAIL_VERIFICATION);
  assert.equal(replay.outcome, ACTION_TOKEN_OUTCOME.CONSUMED, 'a replay is recognised as one');

  const unknown = await ActionTokenStore.claim('never-issued', ACTION_TOKEN_TYPES.EMAIL_VERIFICATION);
  assert.equal(unknown.outcome, ACTION_TOKEN_OUTCOME.UNKNOWN);
});

test('concurrent claims of one token produce exactly one winner', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clear();
  const { token } = await issue(ACTION_TOKEN_TYPES.PASSWORD_RESET);

  // The reference does `SELECT … consumed_at IS NULL` then a separate `UPDATE`, so both of
  // these would succeed and both would set a password. A single-document compare-and-set
  // cannot do that, and needs no transaction to guarantee it.
  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      ActionTokenStore.claim(token, ACTION_TOKEN_TYPES.PASSWORD_RESET),
    ),
  );

  const claimed = results.filter((r) => r.outcome === ACTION_TOKEN_OUTCOME.CLAIMED);
  assert.equal(claimed.length, 1, 'exactly one caller spends the token');
  assert.ok(
    results.every(
      (r) =>
        r.outcome === ACTION_TOKEN_OUTCOME.CLAIMED ||
        r.outcome === ACTION_TOKEN_OUTCOME.CONSUMED,
    ),
    'every loser is told the token was already consumed',
  );
});

test('re-issuing revokes every prior outstanding token of that type', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clear();

  const first = await issue(ACTION_TOKEN_TYPES.PASSWORD_RESET);
  const second = await issue(ACTION_TOKEN_TYPES.PASSWORD_RESET);
  const third = await issue(ACTION_TOKEN_TYPES.PASSWORD_RESET);

  assert.equal(
    await ActionTokenStore.countClaimable(USER_ID, ACTION_TOKEN_TYPES.PASSWORD_RESET),
    1,
    'N reset requests leave exactly one live token, not N',
  );

  for (const stale of [first, second]) {
    const claim = await ActionTokenStore.claim(stale.token, ACTION_TOKEN_TYPES.PASSWORD_RESET);
    assert.equal(claim.outcome, ACTION_TOKEN_OUTCOME.SUPERSEDED, 'an old link stops working');
    assert.equal(claim.token?.revokedReason, ACTION_TOKEN_REVOKE_REASONS.SUPERSEDED);
  }

  const latest = await ActionTokenStore.claim(third.token, ACTION_TOKEN_TYPES.PASSWORD_RESET);
  assert.equal(latest.outcome, ACTION_TOKEN_OUTCOME.CLAIMED, 'the newest link still works');
});

test('re-issuing one type leaves the other type untouched', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clear();

  const verification = await issue(ACTION_TOKEN_TYPES.EMAIL_VERIFICATION);
  await issue(ACTION_TOKEN_TYPES.PASSWORD_RESET);
  await issue(ACTION_TOKEN_TYPES.PASSWORD_RESET);

  // Requesting a password reset must not silently invalidate a pending verification link.
  const claim = await ActionTokenStore.claim(
    verification.token,
    ACTION_TOKEN_TYPES.EMAIL_VERIFICATION,
  );
  assert.equal(claim.outcome, ACTION_TOKEN_OUTCOME.CLAIMED);
});

test('a verification token cannot be spent as a password reset, or the reverse', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clear();

  const verification = await issue(ACTION_TOKEN_TYPES.EMAIL_VERIFICATION);
  const reset = await issue(ACTION_TOKEN_TYPES.PASSWORD_RESET);

  // `type` is part of the claim filter, so this is "not found" rather than a check the
  // caller might forget to perform.
  assert.equal(
    (await ActionTokenStore.claim(verification.token, ACTION_TOKEN_TYPES.PASSWORD_RESET)).outcome,
    ACTION_TOKEN_OUTCOME.UNKNOWN,
  );
  assert.equal(
    (await ActionTokenStore.claim(reset.token, ACTION_TOKEN_TYPES.EMAIL_VERIFICATION)).outcome,
    ACTION_TOKEN_OUTCOME.UNKNOWN,
  );

  // And neither was spent by the failed attempt.
  assert.equal(
    (await ActionTokenStore.claim(verification.token, ACTION_TOKEN_TYPES.EMAIL_VERIFICATION))
      .outcome,
    ACTION_TOKEN_OUTCOME.CLAIMED,
  );
});

/**
 * The TTL regression test, once per token type.
 *
 * Mongo's TTL monitor runs on a ~60 s cycle and does not run on secondaries at all, so this
 * is precisely the state a real request hits in the minute after a token dies: the document
 * is still physically there. Anything relying on the reaper for expiry enforcement passes
 * this test's setup and fails its assertion.
 */
for (const [label, type] of Object.entries(ACTION_TOKEN_TYPES)) {
  test(`an expired ${label} token is refused before the TTL reaper removes it`, async (t) => {
    if (!available) return t.skip('Mongo not reachable');
    await clear();
    const { token } = await issue(type);

    await AuthActionToken.updateOne(
      { tokenHash: hashToken(token) },
      { $set: { expiresAt: new Date(Date.now() - 60_000) } },
    );
    assert.ok(
      await AuthActionToken.findOne({ tokenHash: hashToken(token) }).lean(),
      'document is still physically present',
    );

    const claim = await ActionTokenStore.claim(token, type);
    assert.equal(claim.outcome, ACTION_TOKEN_OUTCOME.EXPIRED, 'read path refuses it anyway');
    assert.equal(
      await ActionTokenStore.countClaimable(USER_ID, type),
      0,
      'and it is not counted as claimable',
    );
  });
}

test('revokeAllForUser kills both types at once, and only for that user', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  await clear();
  const other = new mongoose.Types.ObjectId().toString();

  await issue(ACTION_TOKEN_TYPES.EMAIL_VERIFICATION);
  await issue(ACTION_TOKEN_TYPES.PASSWORD_RESET);
  const bystander = await ActionTokenStore.issue({
    userId: other,
    type: ACTION_TOKEN_TYPES.PASSWORD_RESET,
    sentToEmail: 'bystander@example.com',
  });

  const revoked = await ActionTokenStore.revokeAllForUser(
    USER_ID,
    ACTION_TOKEN_REVOKE_REASONS.PASSWORD_RESET,
  );
  assert.equal(revoked, 2, 'both of this user tokens');

  assert.equal(
    (await ActionTokenStore.claim(bystander.token, ACTION_TOKEN_TYPES.PASSWORD_RESET)).outcome,
    ACTION_TOKEN_OUTCOME.CLAIMED,
    'another user token is untouched',
  );
  await AuthActionToken.deleteMany({ userId: other });
});
