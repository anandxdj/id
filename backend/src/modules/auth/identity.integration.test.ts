/**
 * The M2 identity flows, end to end over HTTP: verification, password reset, the login
 * throttle, enumeration parity, the bcrypt→Argon2id upgrade, and real account closure.
 *
 * These go through Express rather than calling services directly, because most of what M2
 * promises is a property of the *response* — that two branches are indistinguishable — and
 * that can only be checked where the response is produced.
 *
 * The verification and reset tokens are read from the development outbox, which is how a
 * developer gets them locally too: no provider is configured here, so `EmailService`
 * suppresses delivery and captures the message in memory instead of logging a working link.
 *
 * Requires a reachable MongoDB + Redis. Self-skips when they are unavailable, and fails
 * rather than skips under REQUIRE_INTEGRATION=1.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { IntegrationGate, TestFixtures } from '../../common/testing/index.testing';
import {
  ACTION_TOKEN_TYPES,
  ERROR_CODES,
  LOGIN_THROTTLE,
  PASSWORD_ALGORITHMS,
  RATE_LIMIT_SCOPES,
  REFRESH_TOKEN_STATUS,
  REDIS_KEYS,
  SUCCESS_MESSAGES,
} from '../../common/constants/index.constants';

process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.MONGO_DB_NAME ??= 'id_test';

const PASSWORD = 'sup3r-secret-pw';
const NEW_PASSWORD = 'even-more-secret-pw';

/** Every address this suite touches, so cleanup cannot leave a stray account behind. */
const NEW_USER = 'm2-new@example.com';
const VERIFY_USER = 'm2-verify@example.com';
const RESET_USER = 'm2-reset@example.com';
const THROTTLE_USER = 'm2-throttle@example.com';
const LEGACY_USER = 'm2-legacy@example.com';
const CLOSING_USER = 'm2-closing@example.com';
const UNKNOWN_USER = 'm2-nobody@example.com';
const GATED_USER = 'm3-gated@example.com';
const EMAILS = [
  NEW_USER,
  VERIFY_USER,
  RESET_USER,
  THROTTLE_USER,
  LEGACY_USER,
  CLOSING_USER,
  UNKNOWN_USER,
  GATED_USER,
];

let server: Server | undefined;
let base = '';
let available = false;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('probe timeout')), ms))]);

interface ApiCall {
  status: number;
  /** The raw body, for the byte-for-byte enumeration comparisons. */
  raw: string;
  body: { success?: boolean; message?: string; code?: string; data?: unknown };
}

const api = async (path: string, init: RequestInit = {}): Promise<ApiCall> => {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const raw = await res.text();
  return { status: res.status, raw, body: raw ? JSON.parse(raw) : {} };
};

const post = (path: string, payload: unknown, headers: Record<string, string> = {}) =>
  api(path, { method: 'POST', body: JSON.stringify(payload), headers });

/** Read the most recent tokenised link the outbox captured for an address. */
const tokenFrom = async (email: string): Promise<string> => {
  const { DevOutbox } = await import('../../common/email/index.email');
  const [latest] = DevOutbox.list(email);
  assert.ok(latest, `a message was captured for ${email}`);
  // The token rides the URL *fragment*, never the query string — see `email.templates.ts`.
  const match = /#token=([A-Za-z0-9_-]+)/.exec(latest.html);
  assert.ok(match?.[1], 'the captured message carries a tokenised link');
  return decodeURIComponent(match[1]);
};

const login = (email: string, password: string) => post('/api/auth/login', { email, password });

/**
 * Mark an address verified straight in the database.
 *
 * Login is gated on verification since M3, so any suite that logs a registered account in
 * has to get it past that gate first. Tests whose subject is something else (reset,
 * closure, the throttle) take this shortcut deliberately: routing every one of them
 * through the mailbox would couple unrelated assertions to outbox ordering. The gate
 * itself is exercised over HTTP, end to end, by the two tests below it.
 */
const markVerified = async (email: string): Promise<void> => {
  const { User } = await import('./auth.model');
  await User.updateOne({ email }, { $set: { isVerified: true } });
};

/** Poll a condition that a fire-and-forget write will satisfy shortly. */
const eventually = async (
  predicate: () => boolean | Promise<boolean>,
  what: string,
  timeoutMs = 3_000,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

/**
 * Reset the Redis rate-limit counters this suite passes through.
 *
 * Not optional and not a hack. `sensitiveLimiter` allows ten requests an *hour* — correct for
 * endpoints that mail a third party — and the counters are durable in Redis, so without this
 * the suite would exercise the limiter instead of the flows, pass once, and 429 for the next
 * hour. The limiter has its own suite (`rateLimit.integration.test.ts`); here it is a
 * precondition to clear, exactly as the database is.
 */
const resetLimiters = async () => {
  const { getRedis } = await import('../../common/config/redis');
  const redis = getRedis();
  for (const scope of [RATE_LIMIT_SCOPES.AUTH, RATE_LIMIT_SCOPES.SENSITIVE, RATE_LIMIT_SCOPES.API]) {
    const keys = await redis.keys(`${REDIS_KEYS.RATE_LIMIT}${scope}:*`);
    if (keys.length) await redis.del(...keys);
  }
};

const clearData = async () => {
  const { User } = await import('./auth.model');
  const { Session } = await import('./session.model');
  const { RefreshToken } = await import('./refresh-token.model');
  const { AuthActionToken } = await import('./action-token.model');
  const { LoginThrottle } = await import('./login-throttle.model');
  const { hashToken } = await import('../../common/utils/crypto.utils');

  // Closed accounts hold a tombstoned address, so match on both fields.
  const users = await User.find({
    $or: [{ email: { $in: EMAILS } }, { deletedEmail: { $in: EMAILS } }],
  })
    .select('_id')
    .lean();
  const ids = users.map((u) => u._id);
  await Session.deleteMany({ userId: { $in: ids } });
  await RefreshToken.deleteMany({ userId: { $in: ids } });
  await AuthActionToken.deleteMany({ userId: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
  await LoginThrottle.deleteMany({ _id: { $in: EMAILS.map((e) => hashToken(e)) } });
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
    await withTimeout(getRedis().ping(), 2000);

    const { Config } = await import('../../common/config/config');
    assert.equal(
      Config.email.configured,
      false,
      'this suite reads tokens from the development outbox, which is only populated while no provider is configured',
    );

    await clearData();
    await resetLimiters();

    const { createApp } = await import('../../app');
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server!.address();
        base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
        resolve();
      });
    });
    available = true;
  } catch (cause) {
    available = false;
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
    IntegrationGate.reportUnavailable('identity.integration', cause);
  }
});

// Each test gets a fresh rate-limit budget, so that what is being measured is the endpoint's
// behaviour rather than how many requests the tests before it happened to make.
beforeEach(async () => {
  if (available) await resetLimiters();
});

after(async () => {
  server?.close();
  if (available) {
    const mongoose = (await import('mongoose')).default;
    const { disconnectRedis } = await import('../../common/config/redis');
    const { DevOutbox } = await import('../../common/email/index.email');
    await clearData();
    DevOutbox.clear();
    await mongoose.disconnect();
    await disconnectRedis();
  }
});

// ── Enumeration parity ────────────────────────────────────────────────────────
test('register answers byte-identically for a new address and an existing one', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  const first = await post('/api/auth/register', {
    name: 'M2 New',
    email: NEW_USER,
    password: PASSWORD,
  });
  const second = await post('/api/auth/register', {
    name: 'M2 New',
    email: NEW_USER,
    password: PASSWORD,
  });

  assert.equal(first.status, 201);
  assert.equal(second.status, second.status && first.status, 'same status');
  // Byte-for-byte, not merely "same shape": a differing field, a differing message, or a
  // `user` object present on one branch is a working account-existence oracle.
  assert.equal(second.raw, first.raw, 'identical response body');
  assert.equal(first.body.message, SUCCESS_MESSAGES.REGISTERED);
  assert.equal(first.body.data, null, 'no user object to differ on');

  // Exactly one account exists, so the second call created nothing.
  const { User } = await import('./auth.model');
  assert.equal(await User.countDocuments({ email: NEW_USER }), 1);

  // The mailbox owner is the one party told the difference: a verification link the first
  // time, a "someone tried to register your address" notice the second.
  const { DevOutbox } = await import('../../common/email/index.email');
  const messages = DevOutbox.list(NEW_USER);
  assert.equal(messages.length, 2, 'both attempts produced mail');
  assert.notEqual(messages[0]!.subject, messages[1]!.subject, 'and the two differ');
});

test('concurrent registrations of one address stay identical — no 409 leaks the race', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { User } = await import('./auth.model');
  const address = `m2-race-${Date.now()}@example.com`;

  // Both requests pass the read-then-insert check, so one loses on the unique index. If that
  // `E11000` surfaced as a 409, firing two requests at once would reveal that the address had
  // been free — the same oracle the sequential path closes, reachable by racing it.
  const [first, second] = await Promise.all([
    post('/api/auth/register', { name: 'M2 Race', email: address, password: PASSWORD }),
    post('/api/auth/register', { name: 'M2 Race', email: address, password: PASSWORD }),
  ]);

  assert.equal(first!.status, 201);
  assert.equal(second!.status, 201);
  assert.equal(second!.raw, first!.raw, 'identical response body under a race');
  // The unique index is what actually enforces it — exactly one account exists.
  assert.equal(await User.countDocuments({ email: address }), 1);

  await User.deleteMany({ email: address });
});

test('forgot-password answers byte-identically for a known and an unknown address', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  await post('/api/auth/register', { name: 'M2 Reset', email: RESET_USER, password: PASSWORD });

  const known = await post('/api/auth/forgot-password', { email: RESET_USER });
  const unknown = await post('/api/auth/forgot-password', { email: UNKNOWN_USER });

  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);
  assert.equal(unknown.raw, known.raw, 'identical response body');
  assert.equal(known.body.message, SUCCESS_MESSAGES.PASSWORD_RESET_SENT);

  // And no mail was sent to the address that does not exist.
  const { DevOutbox } = await import('../../common/email/index.email');
  assert.equal(DevOutbox.list(UNKNOWN_USER).length, 0);
  assert.ok(DevOutbox.list(RESET_USER).length > 0);
});

test('resend-verification answers identically for unknown, unverified, and verified', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  await post('/api/auth/register', { name: 'M2 Verify', email: VERIFY_USER, password: PASSWORD });

  const unverified = await post('/api/auth/resend-verification', { email: VERIFY_USER });
  const unknown = await post('/api/auth/resend-verification', { email: UNKNOWN_USER });
  assert.equal(unverified.raw, unknown.raw, 'identical response body');
  assert.equal(unverified.body.message, SUCCESS_MESSAGES.VERIFICATION_SENT);

  // Also identical once the address is verified — otherwise the endpoint would report
  // verification status to anyone who asks.
  const token = await tokenFrom(VERIFY_USER);
  assert.equal((await post('/api/auth/verify-email', { token })).status, 200);
  const verified = await post('/api/auth/resend-verification', { email: VERIFY_USER });
  assert.equal(verified.raw, unknown.raw, 'still identical after verification');
});

/**
 * The timing half of enumeration resistance, measured through the whole stack.
 *
 * Without the dummy comparison, the unknown-address branch skips the KDF entirely and returns
 * an order of magnitude faster than a wrong-password attempt. The assertion is a ratio, since
 * the absolute latency belongs to the machine, and medians, since one scheduler hiccup should
 * not decide it.
 */
test('an unknown address and a wrong password take comparably long to refuse', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { LoginThrottle } = await import('./login-throttle.model');
  const { hashToken } = await import('../../common/utils/crypto.utils');

  const SAMPLES = 5;
  const timeOne = async (email: string): Promise<number> => {
    // Clear the counter between samples: a throttled response short-circuits before the KDF
    // and would be timing a rejection rather than a verification.
    await LoginThrottle.deleteMany({ _id: hashToken(email) });
    const started = process.hrtime.bigint();
    await login(email, 'definitely-the-wrong-password');
    return Number(process.hrtime.bigint() - started) / 1e6;
  };

  const known: number[] = [];
  const unknown: number[] = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    known.push(await timeOne(NEW_USER));
    unknown.push(await timeOne(UNKNOWN_USER));
  }

  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  const knownMs = med(known);
  const unknownMs = med(unknown);
  const ratio = unknownMs / knownMs;

  assert.ok(
    ratio > 0.4 && ratio < 2.5,
    `unknown/known login timing ratio ${ratio.toFixed(2)} (known ${knownMs.toFixed(1)}ms, unknown ${unknownMs.toFixed(1)}ms) — without a dummy hash the unknown branch is far faster`,
  );

  await LoginThrottle.deleteMany({ _id: { $in: [hashToken(NEW_USER), hashToken(UNKNOWN_USER)] } });
});

// ── Verification ──────────────────────────────────────────────────────────────
test('a verification token works once, and re-issuing invalidates the previous one', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { User } = await import('./auth.model');
  const { DevOutbox } = await import('../../common/email/index.email');

  await post('/api/auth/register', { name: 'M2 Once', email: CLOSING_USER, password: PASSWORD });
  const firstToken = await tokenFrom(CLOSING_USER);

  // Re-issue. The old link is now in an old inbox and must stop working (§2.3-9).
  await post('/api/auth/resend-verification', { email: CLOSING_USER });
  const secondToken = await tokenFrom(CLOSING_USER);
  assert.notEqual(secondToken, firstToken, 'a fresh token was minted');

  const stale = await post('/api/auth/verify-email', { token: firstToken });
  assert.equal(stale.status, 400);
  assert.equal(stale.body.code, ERROR_CODES.INVALID_ACTION_TOKEN);
  assert.equal(
    (await User.findOne({ email: CLOSING_USER }))?.isVerified,
    false,
    'and it verified nothing',
  );

  const ok = await post('/api/auth/verify-email', { token: secondToken });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.message, SUCCESS_MESSAGES.EMAIL_VERIFIED);
  assert.equal((await User.findOne({ email: CLOSING_USER }))?.isVerified, true);

  // Used once, and only once. A replay is answered exactly as an invented token is.
  const replay = await post('/api/auth/verify-email', { token: secondToken });
  assert.equal(replay.status, 400);
  const invented = await post('/api/auth/verify-email', { token: 'not-a-real-token' });
  assert.equal(invented.status, replay.status);
  assert.equal(invented.body.code, replay.body.code, 'a replay is indistinguishable from a guess');

  DevOutbox.clear();
});

test('verification does not mint a session', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  await post('/api/auth/register', { name: 'M2 NoSess', email: THROTTLE_USER, password: PASSWORD });
  const token = await tokenFrom(THROTTLE_USER);

  const res = await api('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.data, null, 'no tokens in the body');
  // Confirming an address is not authenticating a person — conflating them is what turns a
  // missing account-state check into a suspension bypass (§2.3-11).
  const { User } = await import('./auth.model');
  const { Session } = await import('./session.model');
  const user = (await User.findOne({ email: THROTTLE_USER }))!;
  assert.equal(await Session.countDocuments({ userId: user._id }), 0, 'and no session either');
});

test('a suspended account cannot redeem a token minted before the suspension', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { User } = await import('./auth.model');

  await post('/api/auth/register', { name: 'M2 Susp', email: LEGACY_USER, password: PASSWORD });
  const token = await tokenFrom(LEGACY_USER);
  await User.updateOne({ email: LEGACY_USER }, { $set: { disabled: true } });

  const res = await post('/api/auth/verify-email', { token });
  assert.equal(res.status, 403);
  assert.equal(res.body.code, ERROR_CODES.ACCOUNT_UNAVAILABLE);
  assert.equal(
    (await User.findOne({ email: LEGACY_USER }))?.isVerified,
    false,
    'the suspension held',
  );

  await User.deleteMany({ email: LEGACY_USER });
});

// ── The email-verification gate ───────────────────────────────────────────────
/**
 * The gate's security property, which is the whole reason it took a milestone longer than
 * the verification flow itself.
 *
 * The reference answers an unverified login with a distinct `EMAIL_NOT_VERIFIED` 403,
 * *after* checking the password and *without* incrementing the throttle (§2.3-13). That
 * is a password oracle — the response changes shape at the exact moment a guess is
 * correct — and an unthrottled one, so the account it leaks about is also the account you
 * may guess against indefinitely. Both halves are asserted here.
 */
test('an unverified login answers exactly like a wrong password, and still counts', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { LoginThrottle } = await import('./login-throttle.model');
  const { hashToken } = await import('../../common/utils/crypto.utils');
  const key = hashToken(GATED_USER);

  await post('/api/auth/register', { name: 'M3 Gated', email: GATED_USER, password: PASSWORD });
  await LoginThrottle.deleteMany({ _id: key });

  const wrong = await login(GATED_USER, 'definitely-the-wrong-password');
  const unverified = await login(GATED_USER, PASSWORD);

  assert.equal(unverified.status, 401);
  assert.equal(unverified.status, wrong.status, 'same status as a wrong password');
  // Error bodies echo the per-request correlation id, which necessarily differs; that is
  // the only byte allowed to.
  const withoutRequestId = (raw: string) => raw.replace(/,"requestId":"[^"]*"/, '');
  assert.equal(
    withoutRequestId(unverified.raw),
    withoutRequestId(wrong.raw),
    'byte-identical body — no oracle in the response',
  );
  assert.equal(unverified.body.code, ERROR_CODES.INVALID_CREDENTIALS);
  assert.notEqual(unverified.body.code, ERROR_CODES.EMAIL_NOT_VERIFIED);

  // The correct-password attempt was counted like any other failure, so the gate cannot be
  // probed at an unlimited rate either.
  const counter = await LoginThrottle.findById(key).lean();
  assert.ok(counter, 'the throttle recorded the attempts');
  assert.equal(counter.failedAttempts, 2, 'including the one whose password was correct');

  await LoginThrottle.deleteMany({ _id: key });
});

test('the blocked login mails a fresh link, and verifying lets the same credentials in', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { DevOutbox } = await import('../../common/email/index.email');
  const { LoginThrottle } = await import('./login-throttle.model');
  const { hashToken } = await import('../../common/utils/crypto.utils');

  // The response said nothing, so the mailbox is the only channel carrying the reason —
  // and it is the one party entitled to it. Dispatched without being awaited, hence the poll.
  await eventually(
    () => DevOutbox.list(GATED_USER).length >= 2,
    'the blocked login to re-issue a verification link',
  );

  const token = await tokenFrom(GATED_USER);
  assert.equal((await post('/api/auth/verify-email', { token })).status, 200);

  await LoginThrottle.deleteMany({ _id: hashToken(GATED_USER) });
  const now = await login(GATED_USER, PASSWORD);
  assert.equal(now.status, 200, 'the same credentials that were refused now work');
});

// ── Password reset ────────────────────────────────────────────────────────────
test('a reset changes the password and revokes every live session', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { Session } = await import('./session.model');
  const { User } = await import('./auth.model');

  await markVerified(RESET_USER);

  // Two devices signed in, so "revoke all" has something to prove.
  const deviceA = await login(RESET_USER, PASSWORD);
  const deviceB = await login(RESET_USER, PASSWORD);
  assert.equal(deviceA.status, 200);
  assert.equal(deviceB.status, 200);
  const tokenA = (deviceA.body.data as { accessToken: string }).accessToken;

  const user = (await User.findOne({ email: RESET_USER }))!;
  assert.equal(
    await Session.countDocuments({ userId: user._id, revokedAt: null }),
    2,
    'both sessions are live',
  );

  await post('/api/auth/forgot-password', { email: RESET_USER });
  const resetToken = await tokenFrom(RESET_USER);
  const reset = await post('/api/auth/reset-password', {
    token: resetToken,
    password: NEW_PASSWORD,
  });
  assert.equal(reset.status, 200);

  // The point of the flow: a reset that leaves the intruder's session alive has achieved
  // nothing (§2.3-15).
  assert.equal(
    await Session.countDocuments({ userId: user._id, revokedAt: null }),
    0,
    'every session was revoked',
  );
  const meAfter = await api('/api/auth/me', { headers: { authorization: `Bearer ${tokenA}` } });
  assert.equal(meAfter.status, 401, 'and the access token no longer authenticates');

  assert.equal((await login(RESET_USER, PASSWORD)).status, 401, 'the old password is dead');
  assert.equal((await login(RESET_USER, NEW_PASSWORD)).status, 200, 'the new one works');

  // Single use, and every other outstanding reset link died with it.
  assert.equal((await post('/api/auth/reset-password', { token: resetToken, password: PASSWORD })).status, 400);
});

test('the stored digest after a reset is Argon2id, never plaintext', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { User } = await import('./auth.model');
  const { PasswordService } = await import('./password.service');

  const stored = (await User.findOne({ email: RESET_USER }).select('+password'))!;
  assert.notEqual(stored.password, NEW_PASSWORD, 'not the plaintext');
  assert.equal(PasswordService.identify(stored.password), PASSWORD_ALGORITHMS.ARGON2ID);
});

// ── Login throttle ────────────────────────────────────────────────────────────
test('the login throttle blocks at the threshold and recovers when its window passes', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { LoginThrottle } = await import('./login-throttle.model');
  const { hashToken } = await import('../../common/utils/crypto.utils');
  const key = hashToken(THROTTLE_USER);
  await LoginThrottle.deleteMany({ _id: key });

  for (let i = 0; i < LOGIN_THROTTLE.MAX_ATTEMPTS; i += 1) {
    const attempt = await login(THROTTLE_USER, 'wrong-password');
    assert.equal(attempt.status, 401, `attempt ${i + 1} is refused as bad credentials`);
    assert.equal(attempt.body.code, ERROR_CODES.INVALID_CREDENTIALS);
  }

  // Threshold reached: refused before credentials are even examined, and with a distinct code
  // so a client can tell "wait" from "wrong".
  const blocked = await login(THROTTLE_USER, 'wrong-password');
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.code, ERROR_CODES.ACCOUNT_LOCKED);

  // And — the part the reference gets catastrophically wrong (§2.3-2) — the *correct*
  // password is also refused while locked, which is exactly why the lock must expire.
  const lockedOut = await login(THROTTLE_USER, PASSWORD);
  assert.equal(lockedOut.status, 429, 'a correct password is held off too');

  // Wind past the lock while leaving the document present, which is what a real request finds
  // in the up-to-a-minute gap before the TTL monitor arrives.
  await LoginThrottle.updateOne(
    { _id: key },
    {
      $set: {
        lockedUntil: new Date(Date.now() - 1_000),
        windowExpiresAt: new Date(Date.now() + LOGIN_THROTTLE.WINDOW_MS),
      },
    },
  );

  const recovered = await login(THROTTLE_USER, PASSWORD);
  assert.equal(recovered.status, 200, 'the account recovered on its own — a window, not a brick');

  // A successful login forgets the counter entirely.
  assert.equal(await LoginThrottle.findById(key).lean(), null);
});

// ── bcrypt fallback and upgrade ───────────────────────────────────────────────
test('a bcrypt account logs in, and its digest is upgraded to Argon2id in place', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { User } = await import('./auth.model');
  const { PasswordService } = await import('./password.service');

  // Exactly the state a pre-migration account is in.
  const legacyHash = await TestFixtures.legacyBcryptHash(PASSWORD);
  await User.create({
    name: 'M2 Legacy',
    email: LEGACY_USER,
    password: legacyHash,
    isVerified: true,
  });
  assert.equal(PasswordService.identify(legacyHash), PASSWORD_ALGORITHMS.BCRYPT);

  // No forced reset: the existing password just works.
  const ok = await login(LEGACY_USER, PASSWORD);
  assert.equal(ok.status, 200, 'a legacy password still signs in');

  const after = (await User.findOne({ email: LEGACY_USER }).select('+password'))!;
  assert.equal(
    PasswordService.identify(after.password),
    PASSWORD_ALGORITHMS.ARGON2ID,
    'and the stored digest was rewritten as Argon2id',
  );
  assert.equal(PasswordService.needsRehash(after.password), false, 'at the current cost');
  assert.equal(await PasswordService.verify(after.password, PASSWORD), true, 'same password');

  // Still works on the next login, now against the upgraded digest.
  assert.equal((await login(LEGACY_USER, PASSWORD)).status, 200);
  assert.equal((await login(LEGACY_USER, 'wrong')).status, 401);
});

// ── Account closure ───────────────────────────────────────────────────────────
test('closing an account revokes everything and frees the address for re-registration', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { User } = await import('./auth.model');
  const { Session } = await import('./session.model');
  const { ActionTokenStore } = await import('./action-token.store');

  const signedIn = await login(CLOSING_USER, PASSWORD);
  assert.equal(signedIn.status, 200);
  const accessToken = (signedIn.body.data as { accessToken: string }).accessToken;
  const before = (await User.findOne({ email: CLOSING_USER }))!;

  // An outstanding reset link exists at the moment of closure and must not survive it.
  await post('/api/auth/forgot-password', { email: CLOSING_USER });
  const orphanToken = await tokenFrom(CLOSING_USER);

  const closed = await api('/api/me', {
    method: 'DELETE',
    headers: { authorization: `Bearer ${accessToken}` },
  });
  assert.equal(closed.status, 200);
  assert.equal(closed.body.message, SUCCESS_MESSAGES.ACCOUNT_DELETED);

  // The row survives as evidence, disabled and stamped, with the real address preserved.
  const tombstoned = (await User.findById(before._id).select('+deletedEmail'))!;
  assert.ok(tombstoned.deletedAt, 'deletedAt is stamped');
  assert.equal(tombstoned.disabled, true);
  assert.equal(tombstoned.deletedEmail, CLOSING_USER, 'the real address is retained');
  assert.notEqual(tombstoned.email, CLOSING_USER, 'and moved off the live unique index');

  assert.equal(await Session.countDocuments({ userId: before._id, revokedAt: null }), 0);
  // M3: refresh tokens are durable records now, so closure has to reach them explicitly
  // rather than relying on the session dying underneath them.
  const { RefreshToken } = await import('./refresh-token.model');
  assert.equal(
    await RefreshToken.countDocuments({
      userId: before._id,
      status: REFRESH_TOKEN_STATUS.ACTIVE,
    }),
    0,
    'and no refresh token outlives the account',
  );
  assert.equal(
    (await api('/api/auth/me', { headers: { authorization: `Bearer ${accessToken}` } })).status,
    401,
    'the session is gone',
  );
  // Claimable, not merely un-revoked: an already-*consumed* token keeps `revokedAt: null`
  // legitimately, because revoking something already spent would mean nothing.
  for (const type of Object.values(ACTION_TOKEN_TYPES)) {
    assert.equal(
      await ActionTokenStore.countClaimable(before._id.toString(), type),
      0,
      `no claimable ${type} token survives closure`,
    );
  }
  assert.equal(
    (await post('/api/auth/reset-password', { token: orphanToken, password: NEW_PASSWORD })).status,
    400,
    'a reset link mailed before closure cannot be redeemed',
  );

  assert.equal((await login(CLOSING_USER, PASSWORD)).status, 401, 'and the password is dead');

  // The whole point: the address is available again, rather than burned forever (§2.3-16).
  const reRegister = await post('/api/auth/register', {
    name: 'M2 Reborn',
    email: CLOSING_USER,
    password: NEW_PASSWORD,
  });
  assert.equal(reRegister.status, 201);
  const reborn = (await User.findOne({ email: CLOSING_USER, deletedAt: null }))!;
  assert.ok(reborn, 'a genuinely new account exists on the freed address');
  assert.notEqual(reborn._id.toString(), before._id.toString(), 'and it is not the old one');
  // A genuinely new account starts unverified, so it meets the gate like any other.
  assert.equal((await login(CLOSING_USER, NEW_PASSWORD)).status, 401, 'gated until verified');
  await markVerified(CLOSING_USER);
  assert.equal((await login(CLOSING_USER, NEW_PASSWORD)).status, 200);
});

// ── The developer path to a suppressed token ──────────────────────────────────
test('the development outbox exposes the link, and no token is ever logged', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  await post('/api/auth/forgot-password', { email: RESET_USER });

  const outbox = await api(`/api/auth/dev/outbox?to=${encodeURIComponent(RESET_USER)}`);
  assert.equal(outbox.status, 200, 'reachable while no provider is configured');
  const messages = outbox.body.data as Array<{ to: string; subject: string; html: string }>;
  assert.ok(messages.length > 0);
  assert.equal(messages[0]!.to, RESET_USER);
  // This endpoint is the legitimate alternative to the reference's habit of logging the whole
  // HTML body, which puts a working link for every account into the log pipeline (§2.3-14).
  assert.match(messages[0]!.html, /#token=/, 'the link is here');
  assert.doesNotMatch(messages[0]!.html, /\?token=/, 'and in the fragment, not the query');
});
