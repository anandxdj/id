import { ApiError } from '../../common/utils/ApiError';
import { randomBase64Url } from '../../common/utils/crypto.utils';
import {
  CRYPTO,
  ERROR_CODES,
  HTTP_STATUS,
  MILLISECONDS,
  MONGO_ERROR_CODES,
  REVOKE_REASONS,
  TTL_SECONDS,
} from '../../common/constants/index.constants';
import type { RevokeReason } from '../../common/constants/index.constants';
import { Logger } from '../../common/logger/index.logger';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../common/utils/jwt.utils';
import * as events from '../events/event.service';
import type { EventContext } from '../events/event.types';
import { AccessTokenStore } from '../oauth/access-token.store';
import { AccountState } from './account-state';
import { PasswordService } from './password.service';
import { LoginThrottleStore } from './login-throttle.store';
import { UserStore } from './user.store';
import type { IUser } from './auth.model';
import { SessionStore } from './session.store';
import type { ISession } from './session.model';

/** Keep aligned with JWT_REFRESH_EXPIRES_IN — it also sizes the refresh cookie. */
export const REFRESH_TTL_SECONDS = TTL_SECONDS.SESSION;

export interface PublicUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  isVerified: boolean;
  profilePictureUrl?: string;
}

const toPublic = (u: IUser): PublicUser => ({
  _id: u._id.toString(),
  name: u.name,
  email: u.email,
  role: u.role,
  isVerified: u.isVerified,
  profilePictureUrl: u.profilePictureUrl || undefined,
});

/** Device metadata captured when a session is created. */
export interface SessionMeta {
  ua?: string;
  ip?: string;
}

/**
 * Wire shape of a session in the account/admin APIs.
 *
 * `sid` is the session *handle* (`sha256` of the secret sid), because the raw sid never
 * leaves the token it was minted into. Clients only ever treat it as an opaque string
 * to list by and revoke by, so the contract is unchanged. Timestamps stay epoch-ms
 * numbers for the same reason.
 */
export interface SessionView {
  sid: string;
  ua?: string;
  ip?: string;
  createdAt: number;
  lastSeenAt: number;
  current: boolean;
  expiresInSeconds: number;
}

// Internal: project a stored session into its API shape.
const _toSessionView = (session: ISession, currentHandle: string | null): SessionView => ({
  sid: session._id,
  ua: session.userAgent,
  ip: session.ipAddress,
  createdAt: session.createdAt.getTime(),
  lastSeenAt: session.lastSeenAt.getTime(),
  current: session._id === currentHandle,
  expiresInSeconds: Math.max(
    0,
    Math.floor((session.expiresAt.getTime() - Date.now()) / MILLISECONDS.SECOND),
  ),
});

/** Create a session for a user and return the token pair. Shared by password login
 *  and every social connector callback. */
export const createSession = async (user: IUser, meta: SessionMeta = {}) => {
  const sid = randomBase64Url(CRYPTO.TOKEN_BYTES.SESSION_ID);
  const userId = user._id.toString();

  // Calls out to the session store — the only module that touches the collection.
  await SessionStore.create({
    sid,
    userId,
    role: user.role,
    disabled: user.disabled === true,
    userAgent: meta.ua,
    ipAddress: meta.ip,
  });

  events.record('session.created', {
    actorUserId: userId,
    actorRole: user.role,
    ip: meta.ip,
    ua: meta.ua,
    // The handle, never the sid: the sid is a credential and the logger must not see it.
    meta: { session: SessionStore.handleOf(sid) },
  });

  return {
    accessToken: generateAccessToken({ id: userId, sid, role: user.role }),
    refreshToken: generateRefreshToken({ id: userId, sid }),
  };
};

/** Resolve a live session from a verified token's sid. Null when revoked or expired. */
export const findActiveSession = (
  userId: string,
  sid: string | null | undefined,
): Promise<ISession | null> => {
  if (!sid) return Promise.resolve(null);
  return SessionStore.findActive(userId, SessionStore.handleOf(sid));
};

/** Advance a session's lastSeenAt (throttled, single conditional write). Fire-and-forget. */
export const touchSession = async (userId: string, sid: string | null | undefined): Promise<void> => {
  if (!sid) return;
  await SessionStore.touch(userId, SessionStore.handleOf(sid));
};

/** List a user's live sessions, newest-activity first; flags the caller's own. */
export const listSessions = async (
  userId: string,
  currentSid?: string | null,
): Promise<SessionView[]> => {
  const sessions = await SessionStore.listActive(userId);
  const currentHandle = currentSid ? SessionStore.handleOf(currentSid) : null;
  return sessions.map((session) => _toSessionView(session, currentHandle));
};

/**
 * Revoke one session, addressed by the handle the sessions API published.
 * Returns false when it was already revoked, already expired, or never existed.
 */
export const revokeSession = async (
  userId: string,
  handle: string,
  ctx: Pick<EventContext, 'ip' | 'ua' | 'actorRole'> = {},
  reason: RevokeReason = REVOKE_REASONS.USER_REVOKED_SESSION,
): Promise<boolean> => {
  const revoked = await SessionStore.revoke(userId, handle, reason);
  if (revoked) {
    events.record('session.revoked', { actorUserId: userId, ...ctx, meta: { session: handle, reason } });
  }
  return revoked;
};

/** Revoke every session for a user (optionally sparing the caller's). Returns the count. */
export const revokeAllSessions = async (
  userId: string,
  exceptSid?: string | null,
  ctx: Pick<EventContext, 'ip' | 'ua' | 'actorRole'> = {},
  reason: RevokeReason = REVOKE_REASONS.USER_LOGOUT_ALL,
): Promise<number> => {
  const count = await SessionStore.revokeAll(userId, {
    exceptHandle: exceptSid ? SessionStore.handleOf(exceptSid) : null,
    reason,
  });
  if (count > 0) {
    events.record('session.revoked', {
      actorUserId: userId,
      ...ctx,
      meta: { all: true, count, reason },
    });
  }
  return count;
};

/**
 * Revoke every credential a user holds: sessions and OIDC access tokens.
 *
 * One function so password reset, account closure, and any future admin action cannot
 * revoke different subsets of the same thing. Refresh tokens are covered transitively —
 * today's refresh token is a bare JWT whose validity is gated on the session existing
 * (see `refresh` below), so killing the session kills it. When M3 gives refresh tokens
 * their own collection, this is the single place that gains a third fan-out.
 */
export const revokeAllCredentials = async (
  userId: string,
  reason: RevokeReason,
  ctx: Pick<EventContext, 'ip' | 'ua' | 'actorRole'> = {},
): Promise<{ sessionsRevoked: number; accessTokensRevoked: number }> => {
  const sessionsRevoked = await revokeAllSessions(userId, null, ctx, reason);
  const accessTokensRevoked = await AccessTokenStore.revokeAllForUser(userId, reason);
  return { sessionsRevoked, accessTokensRevoked };
};

export { toPublic };

/**
 * Result of a registration attempt, for the controller's benefit only.
 *
 * The HTTP response is identical either way — see `auth.controller.register`. This tells
 * the controller which *email* to send, not what to answer.
 */
export interface RegisterOutcome {
  created: boolean;
  user?: IUser;
  existing?: IUser;
}

/**
 * Register an account, or report that the address is already taken.
 *
 * Notice what this does *not* do: throw a 409. A conflict response is a working
 * account-existence oracle on a public endpoint, so the decision moves up to the
 * controller, which answers identically in both cases and lets the difference surface only
 * in an email to the mailbox owner. That is the one party entitled to know.
 *
 * The duplicate check is a read-then-insert, and the unique index on `users.email` is what
 * makes it race-proof: two simultaneous registrations both pass the read and the loser gets
 * `E11000`. The reference has the same check and no index, so both of its concurrent
 * registrations succeed (§2.3-7).
 *
 * The loser is then folded back into the "already exists" branch rather than allowed to
 * surface as a 409. Otherwise the identical-response guarantee would hold for sequential
 * requests and break for concurrent ones — fire two at once, and a 409 tells you the address
 * had been free. An oracle that needs a race is still an oracle.
 */
export const register = async (input: {
  name: string;
  email: string;
  password: string;
}): Promise<RegisterOutcome> => {
  const email = UserStore.normalizeEmail(input.email);

  const existing = await UserStore.findLiveByEmail(email);
  if (existing) return { created: false, existing };

  // Calls out to the password service — the model no longer hashes anything.
  const passwordHash = await PasswordService.hash(input.password);
  try {
    const user = await UserStore.createWithPassword({ name: input.name, email, passwordHash });
    return { created: true, user };
  } catch (error) {
    if (!_isDuplicateKey(error)) throw error;
    const winner = await UserStore.findLiveByEmail(email);
    // A duplicate with nothing to find means the colliding row is a *closed* account whose
    // tombstone somehow still holds this address. Not a case that should be answerable, so
    // let the original error travel to the handler.
    if (!winner) throw error;
    return { created: false, existing: winner };
  }
};

/** Internal: a unique-index collision, narrowed with a guard rather than a cast. */
const _isDuplicateKey = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === MONGO_ERROR_CODES.DUPLICATE_KEY;

/**
 * Password login.
 *
 * The ordering here is the whole security design, so it is worth stating explicitly:
 *
 *  1. **Throttle check first**, keyed on the *submitted* address. Keying on a resolved user
 *     would mean unknown addresses were never throttled, which hands an attacker an
 *     unlimited-rate probe; keying on the submission means an address that does not exist
 *     locks exactly like one that does, so the throttle itself reveals nothing.
 *  2. **A hash comparison happens on every path**, real or dummy, so response time does not
 *     separate "no such account" from "wrong password".
 *  3. **A failure increments the throttle**, whether or not the account exists — otherwise
 *     the counter's presence becomes the oracle that the response text is not.
 *  4. **Account state is checked after the password verifies**, so suspension is not
 *     discoverable without the credential.
 *  5. **Rehash on success**, which is what makes the configured cost a live setting rather
 *     than a value that only applies to accounts created after a deploy.
 */
export const login = async (
  input: { email: string; password: string },
  meta: SessionMeta = {},
) => {
  const email = UserStore.normalizeEmail(input.email);

  const throttle = await LoginThrottleStore.check(email);
  if (throttle.locked) {
    events.record('login.throttled', {
      ...meta,
      meta: { email, retryAfterSeconds: throttle.retryAfterSeconds },
    });
    throw ApiError.fromCode(HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_CODES.ACCOUNT_LOCKED);
  }

  const user = await UserStore.findLiveByEmailWithPassword(email);

  // A dummy comparison against a real Argon2id hash at the configured cost. Skipping it
  // would make the unknown-address path microseconds long and the known-address path tens
  // of milliseconds — an enumeration oracle that needs no error-message difference at all.
  // Social-only accounts take the same branch: they have no digest to compare.
  const ok = user?.password
    ? await PasswordService.verify(user.password, input.password)
    : await PasswordService.verifyDummy(input.password);

  // `|| !user` is redundant at runtime — `ok` cannot be true without a digest to verify — and
  // present so the compiler narrows `user` from here on. A guard, not a non-null assertion.
  if (!ok || !user) {
    // Incremented for nonexistent addresses too, so a burst against a guessed address is
    // bounded and the counter cannot be used to tell the two cases apart.
    await LoginThrottleStore.recordFailure(email);
    throw ApiError.fromCode(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.INVALID_CREDENTIALS);
  }

  AccountState.assertUsable(user);

  await LoginThrottleStore.clear(email);
  await _upgradePasswordHash(user, input.password);

  const tokens = await createSession(user, meta);
  return { user: toPublic(user), ...tokens };
};

/**
 * Internal: transparently move a verified password onto the current Argon2id cost.
 *
 * This is the entire migration strategy for the legacy bcrypt estate, and for any future
 * cost increase: no forced reset, no batch job, no `algorithm` column. The plaintext exists
 * in exactly one place — the caller's stack frame, having just been verified — so it is
 * passed in as an argument rather than stashed anywhere, and this is the only moment an
 * upgrade is possible without asking the user for anything.
 *
 * Failures are logged and swallowed: a user who has just presented correct credentials must
 * not be denied a session because a follow-up write failed. They are upgraded on their next
 * login instead.
 */
const _upgradePasswordHash = async (user: IUser, plaintext: string): Promise<void> => {
  if (!PasswordService.needsRehash(user.password)) return;
  const previous = PasswordService.identify(user.password);
  try {
    const rehashed = await PasswordService.hash(plaintext);
    await UserStore.setPasswordHash(user._id.toString(), rehashed);
    Logger.info('Password hash upgraded to the current cost', { from: previous });
  } catch (error) {
    Logger.warn('Password hash upgrade failed — will retry on next login', { error });
  }
};

/** Reissue an access token from a valid, still-whitelisted refresh token. */
export const refresh = async (refreshToken: string | undefined) => {
  if (!refreshToken) throw ApiError.unauthorized('Missing refresh token');

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const session = await findActiveSession(decoded.id, decoded.sid);
  if (!session) throw ApiError.unauthorized('Session expired or revoked');

  // Through the store, so `deletedAt: null` is enforced here as on every other credential
  // path — a closed account must not be able to mint a fresh access token from a refresh
  // token issued before closure.
  const user = await UserStore.findLiveById(decoded.id);
  if (!user) throw ApiError.unauthorized('User no longer exists');
  AccountState.assertUsable(user);

  const accessToken = generateAccessToken({ id: decoded.id, sid: decoded.sid, role: user.role });
  return { accessToken };
};

export const logout = async (userId: string, sid: string | null) => {
  if (!sid) return;
  await SessionStore.revoke(userId, SessionStore.handleOf(sid), REVOKE_REASONS.USER_LOGOUT);
};

export const getMe = async (userId: string) => {
  const user = await UserStore.findLiveById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return toPublic(user);
};
