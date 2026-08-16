/**
 * M3 over HTTP: rotating refresh cookies, reuse detection at the endpoint, the
 * denormalised session snapshot the middleware now trusts, device names, and every
 * revocation path that has to reach refresh tokens.
 *
 * These go through Express rather than the services because most of what M3 changed is
 * observable only in a response: which cookie comes back, whether an access token minted
 * before a demotion still opens an admin route, whether a refresh survives a suspension.
 *
 * Requires Mongo + Redis; self-skips when unavailable, and fails rather than skips under
 * REQUIRE_INTEGRATION=1.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { IntegrationGate, TestFixtures } from '../../common/testing/index.testing';
import {
  COOKIE_NAMES,
  ERROR_CODES,
  RATE_LIMIT_SCOPES,
  REDIS_KEYS,
  REFRESH_TOKEN,
  REFRESH_TOKEN_STATUS,
  REVOKE_REASONS,
  USER_ROLES,
} from '../../common/constants/index.constants';

process.env.OIDC_ISSUER ??= 'http://localhost:4000';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.MONGO_DB_NAME ??= 'id_test';

const PASSWORD = 'sup3r-secret-pw';
const OWNER = 'm3-owner@example.com';
const ACTOR = 'm3-actor-admin@example.com';
const TARGET = 'm3-target-admin@example.com';
const SUSPENDEE = 'm3-suspendee@example.com';
const RESETTER = 'm3-resetter@example.com';
const EMAILS = [OWNER, ACTOR, TARGET, SUSPENDEE, RESETTER];

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let server: Server | undefined;
let base = '';
let available = false;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('probe timeout')), ms))]);

interface ApiCall {
  status: number;
  cookies: string[];
  body: { success?: boolean; message?: string; code?: string; data?: unknown };
}

const api = async (path: string, init: RequestInit = {}): Promise<ApiCall> => {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const raw = await res.text();
  return {
    status: res.status,
    cookies: res.headers.getSetCookie(),
    body: raw ? JSON.parse(raw) : {},
  };
};

const post = (path: string, payload?: unknown, headers: Record<string, string> = {}) =>
  api(path, { method: 'POST', ...(payload === undefined ? {} : { body: JSON.stringify(payload) }), headers });

/** Pull one cookie's `name=value` pair out of a Set-Cookie list. */
const cookieNamed = (cookies: string[], name: string): string | undefined =>
  cookies.find((c) => c.startsWith(`${name}=`))?.split(';')[0];

/** Just the value, which for the refresh cookie is the signed token itself. */
const cookieValue = (pair: string): string => pair.slice(pair.indexOf('=') + 1);

interface LoggedIn {
  accessToken: string;
  refreshCookie: string;
}

const login = async (email: string, ua = CHROME_UA): Promise<LoggedIn> => {
  const res = await post('/api/auth/login', { email, password: PASSWORD }, { 'user-agent': ua });
  assert.equal(res.status, 200, `login for ${email}`);
  const refreshCookie = cookieNamed(res.cookies, COOKIE_NAMES.REFRESH_TOKEN);
  assert.ok(refreshCookie, 'login sets a refresh cookie');
  return {
    accessToken: (res.body.data as { accessToken: string }).accessToken,
    refreshCookie,
  };
};

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

const seedUser = async (email: string, role: string = USER_ROLES.USER) => {
  const { User } = await import('./auth.model');
  return User.create({
    name: email,
    email,
    password: await TestFixtures.passwordHash(PASSWORD),
    isVerified: true,
    role,
  });
};

/** `sensitiveLimiter` allows ten requests an hour and its counters are durable. */
const resetLimiters = async () => {
  const { getRedis } = await import('../../common/config/redis');
  const redis = getRedis();
  for (const scope of Object.values(RATE_LIMIT_SCOPES)) {
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

  const users = await User.find({ email: { $in: EMAILS } }).select('_id').lean();
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

    await clearData();
    await resetLimiters();
    await seedUser(OWNER);
    await seedUser(ACTOR, USER_ROLES.SUPERADMIN);
    await seedUser(TARGET, USER_ROLES.ADMIN);
    await seedUser(SUSPENDEE);
    await seedUser(RESETTER);

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
    IntegrationGate.reportUnavailable('sessions.integration', cause);
  }
});

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

// ── Rotation over the wire ────────────────────────────────────────────────────
test('the refresh endpoint rejects a missing cookie with the observed error', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  const response = await post('/api/auth/refresh-token');

  assert.equal(response.status, 401);
  assert.equal(response.body.code, ERROR_CODES.REFRESH_TOKEN_MISSING);
  assert.equal(response.body.message, 'No refresh token supplied');
  assert.ok(
    response.cookies.some((cookie) => cookie.startsWith(`${COOKIE_NAMES.REFRESH_TOKEN}=;`)),
    'a missing refresh token is cleared from the browser',
  );
});

test('the refresh endpoint hands back a rotated cookie, and the old one stops working', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { RefreshToken } = await import('./refresh-token.model');
  const { RefreshTokenStore } = await import('./refresh-token.store');
  const { Session } = await import('./session.model');

  const session = await login(OWNER);
  const rotated = await post('/api/auth/refresh-token', undefined, { cookie: session.refreshCookie });
  assert.equal(rotated.status, 200);

  const replacement = cookieNamed(rotated.cookies, COOKIE_NAMES.REFRESH_TOKEN);
  assert.ok(replacement, 'the response replaces the refresh cookie');
  assert.notEqual(replacement, session.refreshCookie, 'with a different token');
  assert.ok((rotated.body.data as { accessToken: string }).accessToken);

  // Wind the original past the grace window: a client that legitimately rotated does not
  // come back to the token it rotated away from ten seconds later.
  const original = await RefreshToken.findOne({
    tokenHash: RefreshTokenStore.hashOf(cookieValue(session.refreshCookie)),
  }).lean();
  assert.ok(original);
  await RefreshToken.updateOne(
    { _id: original._id },
    { $set: { rotatedAt: new Date(Date.now() - REFRESH_TOKEN.GRACE_MS - 60_000) } },
  );

  const replay = await post('/api/auth/refresh-token', undefined, { cookie: session.refreshCookie });
  assert.equal(replay.status, 401);
  assert.equal(replay.body.code, ERROR_CODES.REFRESH_TOKEN_REUSED);
  // The dead credential is cleared rather than left for the client to retry into.
  assert.ok(
    replay.cookies.some((c) => c.startsWith(`${COOKIE_NAMES.REFRESH_TOKEN}=;`)),
    'the refresh cookie is cleared',
  );

  // Family and session both gone, so the successor the honest client holds is dead too.
  const survivors = await RefreshToken.countDocuments({
    familyId: original.familyId,
    status: { $ne: REFRESH_TOKEN_STATUS.REVOKED },
  });
  assert.equal(survivors, 0);
  const sessionRow = (await Session.findById(original.sessionId).lean())!;
  assert.equal(sessionRow.revokedReason, REVOKE_REASONS.TOKEN_REUSE_DETECTED);

  assert.equal(
    (await post('/api/auth/refresh-token', undefined, { cookie: replacement })).status,
    401,
    'the successor issued moments earlier is revoked with the family',
  );
  assert.equal(
    (await api('/api/auth/me', { headers: bearer(session.accessToken) })).status,
    401,
    'and the access token no longer authenticates',
  );
});

// ── Device names ──────────────────────────────────────────────────────────────
test('the session list carries a readable device name derived from the user agent', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const session = await login(OWNER);

  const listed = await api('/api/me/sessions', { headers: bearer(session.accessToken) });
  assert.equal(listed.status, 200);
  const sessions = listed.body.data as Array<{
    deviceName?: string;
    ua?: string;
    current: boolean;
  }>;
  const current = sessions.find((s) => s.current);
  assert.ok(current, 'the caller’s own session is flagged');
  assert.equal(current.deviceName, 'Chrome on Windows');
  // The raw agent is still there: a device label is a guess, and support needs the original.
  assert.equal(current.ua, CHROME_UA);
});

test('a hostile user agent cannot smuggle markup into the session list', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { DeviceName } = await import('./device-name');
  const { FIELD_LIMITS } = await import('../../common/constants/index.constants');

  // A header has to be a byte string, so the over-long markup goes through HTTP and the
  // characters an HTTP client refuses to send are checked against the deriver directly.
  const hostile = `<script>alert(1)</script>${'A'.repeat(5_000)}`;
  const session = await login(OWNER, hostile);

  const listed = await api('/api/me/sessions', { headers: bearer(session.accessToken) });
  const current = (listed.body.data as Array<{ deviceName?: string; current: boolean }>).find(
    (s) => s.current,
  )!;

  // The label is composed from what the parser recognised, never echoed from the input,
  // so an unparseable agent yields a fixed string rather than the attacker's.
  assert.ok(current.deviceName);
  assert.equal(current.deviceName.includes('<script>'), false, 'no markup survives');
  assert.ok(current.deviceName.length <= FIELD_LIMITS.DEVICE_NAME, 'and it is capped');

  const bidi = DeviceName.from(`Mozilla/5.0 \u202e${'B'.repeat(1_000)}`);
  assert.ok(bidi);
  assert.equal(bidi.includes('\u202e'), false, 'no bidirectional override reaches the label');
  assert.equal(bidi.includes('\u0000'), false);
});

// ── The denormalised snapshot ─────────────────────────────────────────────────
/**
 * The hazard the flip creates, and the guard that makes it safe.
 *
 * `auth.middleware` reads `role` off the session document now instead of re-reading the
 * user, which removes a database round-trip from every authenticated request. The price
 * is that a role change has to reach the sessions, or a demoted admin keeps admin until
 * their session expires. `changeUserRole` pays it by revoking them.
 */
test('demoting an admin mid-session immediately ends their admin access', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { User } = await import('./auth.model');
  const { Session } = await import('./session.model');
  const { RefreshToken } = await import('./refresh-token.model');

  const actor = await login(ACTOR);
  const target = await login(TARGET);
  const targetId = (await User.findOne({ email: TARGET }).lean())!._id.toString();

  assert.equal(
    (await api('/api/admin/users', { headers: bearer(target.accessToken) })).status,
    200,
    'the target is an admin to begin with',
  );

  const demoted = await api(`/api/admin/users/${targetId}/role`, {
    method: 'PATCH',
    headers: { ...bearer(actor.accessToken), 'content-type': 'application/json' },
    body: JSON.stringify({ role: USER_ROLES.USER }),
  });
  assert.equal(demoted.status, 200);

  // The access token minted before the demotion is unchanged and still carries `role:
  // admin` in its claims — which is exactly why the claim is authoritative for nothing.
  const after = await api('/api/admin/users', { headers: bearer(target.accessToken) });
  assert.notEqual(after.status, 200, 'the demoted admin is no longer treated as one');

  const live = await Session.countDocuments({ userId: targetId, revokedAt: null });
  assert.equal(live, 0, 'every session was revoked, so no snapshot can be stale');
  const liveTokens = await RefreshToken.countDocuments({
    userId: targetId,
    status: REFRESH_TOKEN_STATUS.ACTIVE,
  });
  assert.equal(liveTokens, 0, 'and the refresh tokens went with them');

  assert.equal(
    (await post('/api/auth/refresh-token', undefined, { cookie: target.refreshCookie })).status,
    401,
    'so the demoted session cannot refresh its way back',
  );
});

test('an admin cannot change their own role out from under their own request', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { User } = await import('./auth.model');
  const actor = await login(ACTOR);
  const actorId = (await User.findOne({ email: ACTOR }).lean())!._id.toString();

  const res = await api(`/api/admin/users/${actorId}/role`, {
    method: 'PATCH',
    headers: { ...bearer(actor.accessToken), 'content-type': 'application/json' },
    body: JSON.stringify({ role: USER_ROLES.USER }),
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.code, ERROR_CODES.CANNOT_TARGET_SELF);
});

/**
 * Pins the invariant rather than a behaviour: the session snapshot *is* the authority, so
 * writing a role straight onto the user document — bypassing the service that revokes —
 * changes nothing until the session ends.
 *
 * This is not a bug being documented, it is the contract being nailed down. Any future
 * code path that mutates `role` or `disabled` without going through
 * `applyAccountSnapshotChange` reintroduces the stale-privilege hole, and this test is
 * what makes that explicit enough to notice in review.
 */
test('the session snapshot is authoritative — a raw user-document write does not reach it', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { User } = await import('./auth.model');
  const owner = await login(OWNER);
  const ownerId = (await User.findOne({ email: OWNER }).lean())!._id.toString();

  await User.updateOne({ _id: ownerId }, { $set: { role: USER_ROLES.ADMIN } });
  const escalated = await api('/api/admin/users', { headers: bearer(owner.accessToken) });
  assert.equal(escalated.status, 403, 'the session still says "user", and the session is what counts');

  await User.updateOne({ _id: ownerId }, { $set: { role: USER_ROLES.USER } });
});

// ── Revocation coverage ───────────────────────────────────────────────────────
test('suspension revokes the refresh family, not just the session', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { User } = await import('./auth.model');
  const { RefreshToken } = await import('./refresh-token.model');

  const actor = await login(ACTOR);
  const victim = await login(SUSPENDEE);
  const victimId = (await User.findOne({ email: SUSPENDEE }).lean())!._id.toString();

  const suspended = await post(
    `/api/admin/users/${victimId}/suspend`,
    { reason: 'policy' },
    bearer(actor.accessToken),
  );
  assert.equal(suspended.status, 200);

  // The reference revokes the session row and leaves the refresh token live (§2.3-15),
  // which means a suspended user refreshes their way back in.
  const refreshed = await post('/api/auth/refresh-token', undefined, {
    cookie: victim.refreshCookie,
  });
  assert.equal(refreshed.status, 401, 'a suspended user cannot refresh');
  assert.equal(
    await RefreshToken.countDocuments({ userId: victimId, status: REFRESH_TOKEN_STATUS.ACTIVE }),
    0,
  );

  await post(`/api/admin/users/${victimId}/unsuspend`, undefined, bearer(actor.accessToken));
});

test('a password reset revokes the refresh family', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { DevOutbox } = await import('../../common/email/index.email');
  const { User } = await import('./auth.model');
  const { RefreshToken } = await import('./refresh-token.model');

  const session = await login(RESETTER);
  const userId = (await User.findOne({ email: RESETTER }).lean())!._id.toString();
  assert.ok(
    (await post('/api/auth/refresh-token', undefined, { cookie: session.refreshCookie })).status === 200,
    'refresh works before the reset',
  );

  await post('/api/auth/forgot-password', { email: RESETTER });
  const [message] = DevOutbox.list(RESETTER);
  assert.ok(message, 'a reset link was captured');
  const token = decodeURIComponent(/#token=([A-Za-z0-9_-]+)/.exec(message.html)![1]!);

  const reset = await post('/api/auth/reset-password', { token, password: `${PASSWORD}-new` });
  assert.equal(reset.status, 200);

  assert.equal(
    (await post('/api/auth/refresh-token', undefined, { cookie: session.refreshCookie })).status,
    401,
    'the token the intruder was holding is dead',
  );
  assert.equal(
    await RefreshToken.countDocuments({ userId, status: REFRESH_TOKEN_STATUS.ACTIVE }),
    0,
    'no refresh token survives a password reset',
  );
});

test('signing out one device kills that device’s refresh family and no other', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { User } = await import('./auth.model');
  const { RefreshToken } = await import('./refresh-token.model');

  const phone = await login(OWNER);
  const laptop = await login(OWNER);
  const userId = (await User.findOne({ email: OWNER }).lean())!._id.toString();
  const before = await RefreshToken.countDocuments({
    userId,
    status: REFRESH_TOKEN_STATUS.ACTIVE,
  });
  assert.ok(before >= 2, 'two devices, two families');

  assert.equal((await post('/api/auth/logout', undefined, bearer(phone.accessToken))).status, 200);

  assert.equal(
    (await post('/api/auth/refresh-token', undefined, { cookie: phone.refreshCookie })).status,
    401,
    'the signed-out device cannot refresh',
  );
  assert.equal(
    (await post('/api/auth/refresh-token', undefined, { cookie: laptop.refreshCookie })).status,
    200,
    'the other device is untouched',
  );
});
