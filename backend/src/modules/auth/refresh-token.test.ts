/**
 * Refresh-token rotation, families, and reuse detection.
 *
 * The two assertions this file exists for are the two the reference implementation cannot
 * make: a concurrent double-refresh must **succeed**, and a genuinely stale token must
 * **kill the family**. Everything else here is scaffolding around those.
 *
 * These go through `auth.service.refresh` rather than the rotation primitive, because
 * half of what M3 promises is in the consequences — the session dying with the family,
 * the successor being usable, the presented token being spent whatever the outcome — and
 * those live above the compare-and-set.
 *
 * Requires Mongo; self-skips when unavailable, and fails rather than skips under
 * REQUIRE_INTEGRATION=1.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { IntegrationGate, TestFixtures } from '../../common/testing/index.testing';
import { ApiError } from '../../common/utils/ApiError';
import {
  ERROR_CODES,
  REFRESH_TOKEN,
  REFRESH_TOKEN_STATUS,
  REVOKE_REASONS,
} from '../../common/constants/index.constants';
import * as authService from './auth.service';
import { RefreshToken } from './refresh-token.model';
import { RefreshTokenStore } from './refresh-token.store';
import { Session } from './session.model';
import { User } from './auth.model';
import type { IUser } from './auth.model';

process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.MONGO_DB_NAME ??= 'id_test';

const EMAIL = 'm3-refresh@example.com';
const PASSWORD = 'sup3r-secret-pw';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';

let user: IUser;
let available = false;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('probe timeout')), ms))]);

/** The store keys documents by the token's hash; this is the same derivation. */
const recordFor = (token: string) =>
  RefreshToken.findOne({ tokenHash: RefreshTokenStore.hashOf(token) }).lean();

/** Assert that a promise rejects with a specific `ApiError` code. */
const rejectsWithCode = async (promise: Promise<unknown>, code: string, message: string) => {
  await assert.rejects(
    promise,
    (error: unknown) => {
      assert.ok(error instanceof ApiError, `${message}: expected an ApiError`);
      assert.equal(error.code, code, message);
      return true;
    },
  );
};

const clearData = async () => {
  await RefreshToken.deleteMany({ userId: user?._id });
  await Session.deleteMany({ userId: user?._id });
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
    await User.deleteMany({ email: EMAIL });
    user = await User.create({
      name: 'M3 Refresh',
      email: EMAIL,
      password: await TestFixtures.passwordHash(PASSWORD),
      isVerified: true,
    });
    available = true;
  } catch (error) {
    available = false;
    IntegrationGate.reportUnavailable('refresh-token', error);
  }
});

beforeEach(async () => {
  if (available) await clearData();
});

after(async () => {
  if (available) {
    await clearData();
    await User.deleteMany({ email: EMAIL });
    await mongoose.disconnect();
  }
});

// ── The family, at rest ───────────────────────────────────────────────────────
test('a login opens one family, stored as a hash and bounded by the session window', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { refreshToken } = await authService.createSession(user, { ua: UA, ip: '5.6.7.8' });

  const record = await recordFor(refreshToken);
  assert.ok(record, 'the token resolves to a row under its hash');
  assert.equal(record.status, REFRESH_TOKEN_STATUS.ACTIVE);
  assert.equal(record.parentTokenId, null, 'it is the root of the family');
  assert.equal(record.replacedByTokenId, null);

  // The plaintext must not be recoverable from the database in any form.
  const asPlaintext = await RefreshToken.findOne({ tokenHash: refreshToken }).lean();
  assert.equal(asPlaintext, null, 'the raw token is not a key');
  const serialised = JSON.stringify(record);
  assert.equal(serialised.includes(refreshToken), false, 'and appears nowhere in the row');

  // A refresh token cannot outlive its session, by construction rather than by two
  // settings agreeing with each other.
  const session = await Session.findById(record.sessionId).lean();
  assert.ok(session, 'the row points at a real session');
  assert.equal(record.expiresAt.getTime(), session.expiresAt.getTime());
  assert.equal(session.currentRefreshTokenId?.toString(), record._id.toString());
});

// ── Rotation ──────────────────────────────────────────────────────────────────
test('rotation spends the presented token, issues a child, and never slides the window', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { refreshToken: first } = await authService.createSession(user, { ua: UA });

  const rotated = await authService.refresh(first);
  assert.notEqual(rotated.refreshToken, first, 'a different token came back');
  assert.ok(rotated.accessToken);

  const parent = (await recordFor(first))!;
  const child = (await recordFor(rotated.refreshToken))!;
  assert.equal(parent.status, REFRESH_TOKEN_STATUS.ROTATED);
  assert.ok(parent.rotatedAt instanceof Date);
  assert.equal(parent.replacedByTokenId?.toString(), child._id.toString(), 'parent names its heir');
  assert.equal(child.parentTokenId?.toString(), parent._id.toString(), 'and the child its parent');
  assert.equal(child.familyId.toString(), parent.familyId.toString(), 'same family');
  assert.equal(child.status, REFRESH_TOKEN_STATUS.ACTIVE);

  // Absolute, not sliding: an inherited expiry is what stops a client refreshing forever.
  assert.equal(child.expiresAt.getTime(), parent.expiresAt.getTime());

  const session = await Session.findById(child.sessionId).lean();
  assert.equal(session?.currentRefreshTokenId?.toString(), child._id.toString());

  // And the successor works, which is the other half of "rotation happened".
  const again = await authService.refresh(rotated.refreshToken);
  assert.ok(again.accessToken);
});

// ── The benign race ───────────────────────────────────────────────────────────
/**
 * Without a grace window this is the test that fails, and it fails for every real client:
 * two tabs, or a retry after a dropped response, present the same token milliseconds
 * apart and the second one trips reuse detection. The user is signed out of everything
 * for doing nothing wrong, and the logs record an attack that never happened.
 */
test('two concurrent refreshes of one token both succeed and share a successor', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { refreshToken } = await authService.createSession(user, { ua: UA });

  const [a, b] = await Promise.all([
    authService.refresh(refreshToken),
    authService.refresh(refreshToken),
  ]);

  assert.equal(a.refreshToken, b.refreshToken, 'the loser is handed the winner’s successor');
  assert.notEqual(a.refreshToken, refreshToken);
  assert.ok(a.accessToken && b.accessToken, 'both callers got a usable access token');

  // Exactly one child exists — the loser's speculative insert was cleaned up rather than
  // left to fork the family.
  const family = (await recordFor(refreshToken))!.familyId;
  assert.equal(await RefreshToken.countDocuments({ familyId: family }), 2, 'parent + one child');

  // Nothing was revoked: this was a race, not a theft.
  assert.equal(
    await RefreshToken.countDocuments({ familyId: family, status: REFRESH_TOKEN_STATUS.REVOKED }),
    0,
    'the family survived',
  );

  // The successor still rotates normally afterwards.
  assert.ok((await authService.refresh(a.refreshToken)).accessToken);
});

test('a sequential retry inside the grace window is answered the same way', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { refreshToken } = await authService.createSession(user, { ua: UA });

  // Exactly the shape of a client whose first response was dropped in transit.
  const first = await authService.refresh(refreshToken);
  const retry = await authService.refresh(refreshToken);
  assert.equal(retry.refreshToken, first.refreshToken, 'same successor, not a new generation');

  const family = (await recordFor(refreshToken))!.familyId;
  assert.equal(await RefreshToken.countDocuments({ familyId: family }), 2, 'no fork');
});

// ── Theft ─────────────────────────────────────────────────────────────────────
/**
 * The case the grace window must not swallow. Same input as the benign race — an
 * already-rotated token — separated only by *when* and by *how far behind the leaf* it is.
 */
test('a token rotated longer ago than the grace window revokes the whole family', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { refreshToken: stolen } = await authService.createSession(user, { ua: UA });

  const legitimate = await authService.refresh(stolen);
  const parent = (await recordFor(stolen))!;

  // Wind the rotation back past the grace window: the legitimate client rotated a while
  // ago, and somebody is now presenting the token it rotated away from.
  await RefreshToken.updateOne(
    { _id: parent._id },
    { $set: { rotatedAt: new Date(Date.now() - REFRESH_TOKEN.GRACE_MS - 60_000) } },
  );

  await rejectsWithCode(
    authService.refresh(stolen),
    ERROR_CODES.REFRESH_TOKEN_REUSED,
    'a stale rotated token is treated as theft',
  );

  // The blast radius: the family, and the session it belongs to. Both, because either one
  // left alive keeps the thief in.
  const survivors = await RefreshToken.countDocuments({
    familyId: parent.familyId,
    status: { $ne: REFRESH_TOKEN_STATUS.REVOKED },
  });
  assert.equal(survivors, 0, 'every token in the family is revoked');

  const session = (await Session.findById(parent.sessionId).lean())!;
  assert.ok(session.revokedAt instanceof Date, 'and the session with it');
  assert.equal(session.revokedReason, REVOKE_REASONS.TOKEN_REUSE_DETECTED);

  // The attacker's own descendants die too — that is the entire point of revoking the
  // family rather than the presented token. The legitimate client's live token is gone.
  await rejectsWithCode(
    authService.refresh(legitimate.refreshToken),
    ERROR_CODES.REFRESH_TOKEN_INVALID,
    'the successor the legitimate client holds is dead as well',
  );
});

test('a token two generations behind the leaf is theft even inside the grace window', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { refreshToken: root } = await authService.createSession(user, { ua: UA });

  // A → B → C, all within the grace window. Presenting A is not a race: whoever holds A
  // never saw B, because anyone who did would be presenting B.
  const second = await authService.refresh(root);
  await authService.refresh(second.refreshToken);

  const parent = (await recordFor(root))!;
  const rotatedAgo = Date.now() - (parent.rotatedAt?.getTime() ?? 0);
  assert.ok(rotatedAgo < REFRESH_TOKEN.GRACE_MS, 'still inside the window on time alone');

  await rejectsWithCode(
    authService.refresh(root),
    ERROR_CODES.REFRESH_TOKEN_REUSED,
    'generation, not just elapsed time, decides',
  );

  assert.equal(
    await RefreshToken.countDocuments({
      familyId: parent.familyId,
      status: { $ne: REFRESH_TOKEN_STATUS.REVOKED },
    }),
    0,
  );
});

// ── Everything else that can go wrong ─────────────────────────────────────────
test('an expired refresh token is refused before the TTL reaper removes it', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { refreshToken } = await authService.createSession(user, { ua: UA });
  const record = (await recordFor(refreshToken))!;

  // Mongo's TTL monitor runs on a ~60 s cycle, and refresh tokens are deliberately
  // retained past expiry so a late replay stays detectable — so this is not a corner
  // case, it is the normal state of an expired token.
  await RefreshToken.updateOne(
    { _id: record._id },
    { $set: { expiresAt: new Date(Date.now() - 60_000) } },
  );
  assert.ok(await RefreshToken.findById(record._id).lean(), 'the document is still present');

  await rejectsWithCode(
    authService.refresh(refreshToken),
    ERROR_CODES.REFRESH_TOKEN_INVALID,
    'the read path enforces expiry itself',
  );

  const after = (await RefreshToken.findById(record._id).lean())!;
  assert.equal(after.status, REFRESH_TOKEN_STATUS.REVOKED, 'and burns it on the way out');
});

test('a made-up token and a well-formed one for a deleted row answer identically', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { refreshToken } = await authService.createSession(user, { ua: UA });
  await RefreshToken.deleteMany({ tokenHash: RefreshTokenStore.hashOf(refreshToken) });

  await rejectsWithCode(
    authService.refresh(refreshToken),
    ERROR_CODES.REFRESH_TOKEN_INVALID,
    'a token with no row is simply invalid',
  );
  await rejectsWithCode(
    authService.refresh('not-a-jwt'),
    ERROR_CODES.REFRESH_TOKEN_INVALID,
    'and so is a forgery — the same answer, so neither confirms the other',
  );
  await rejectsWithCode(
    authService.refresh(undefined),
    ERROR_CODES.REFRESH_TOKEN_MISSING,
    'a missing cookie is a client bug, not a credential failure',
  );
});

test('a refresh token whose session was revoked cannot mint anything', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { refreshToken } = await authService.createSession(user, { ua: UA });
  const record = (await recordFor(refreshToken))!;

  // Sign out on another device. The session revocation is what everything gates on.
  await authService.revokeSession(user._id.toString(), record.sessionId);

  await rejectsWithCode(
    authService.refresh(refreshToken),
    ERROR_CODES.REFRESH_TOKEN_INVALID,
    'the family died with the session',
  );
});
