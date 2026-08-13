import { ApiError } from '../../common/utils/ApiError';
import { randomBase64Url } from '../../common/utils/crypto.utils';
import { Config } from '../../common/config/config';
import {
  CRYPTO,
  ERROR_CODES,
  HTTP_STATUS,
  MILLISECONDS,
  MONGO_ERROR_CODES,
  REFRESH_OUTCOME,
  REVOKE_REASONS,
  TTL_SECONDS,
} from '../../common/constants/index.constants';
import type { RevokeReason } from '../../common/constants/index.constants';
import { Logger } from '../../common/logger/index.logger';
import { generateAccessToken, verifyRefreshToken } from '../../common/utils/jwt.utils';
import * as events from '../events/event.service';
import type { EventContext } from '../events/event.types';
import { AccessTokenStore } from '../oauth/access-token.store';
import { AccountState } from './account-state';
import { DeviceName } from './device-name';
import { EmailVerificationService } from './email-verification.service';
import { PasswordService } from './password.service';
import { LoginThrottleStore } from './login-throttle.store';
import { RefreshTokenService } from './refresh-token.service';
import { RefreshTokenStore } from './refresh-token.store';
import type { IRefreshToken } from './refresh-token.model';
import { UserStore } from './user.store';
import type { IUser } from './auth.model';
import { SessionStore } from './session.store';
import type { ISession } from './session.model';

/**
 * Sizes the refresh cookie, and is the session's own lifetime.
 *
 * Since M3 the refresh token's absolute window *is* the session's `expiresAt`, so a
 * refresh token cannot outlive the session it belongs to by construction rather than by
 * two settings agreeing. `JWT_REFRESH_EXPIRES_IN` no longer sizes it: a rotated child
 * inherits its parent's `exp`, and re-deriving that from a duration string on every
 * rotation is precisely how an absolute window turns into a sliding one.
 */
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
  /**
   * "Chrome on Windows", derived from the user agent. Additive — `ua` still carries the
   * raw string, because a device label is a guess and support needs the original.
   */
  deviceName?: string;
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
  deviceName: session.deviceName,
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

/**
 * Create a session for a user and return the token pair. Shared by password login and
 * every social connector callback.
 *
 * One login opens exactly one refresh-token **family**, rooted here. The session document
 * is written first because it is what every other path gates on; the family is created
 * against the session's own `expiresAt`, so nothing in it can outlive the session.
 */
export const createSession = async (user: IUser, meta: SessionMeta = {}) => {
  const sid = randomBase64Url(CRYPTO.TOKEN_BYTES.SESSION_ID);
  const userId = user._id.toString();
  const handle = SessionStore.handleOf(sid);

  // Calls out to the session store — the only module that touches the collection.
  const session = await SessionStore.create({
    sid,
    userId,
    role: user.role,
    disabled: user.disabled === true,
    // Helper: parses and sanitises the user agent, which is untrusted text that ends up
    // rendered in the account owner's session list.
    deviceName: DeviceName.from(meta.ua),
    userAgent: meta.ua,
    ipAddress: meta.ip,
  });

  // Calls out to the refresh-token service, which owns rotation policy and the family.
  const { token: refreshToken, record } = await RefreshTokenService.issueForSession({
    userId,
    sid,
    sessionId: handle,
    expiresAt: session.expiresAt,
  });
  await SessionStore.setCurrentRefreshToken(handle, record._id);

  events.record('session.created', {
    actorUserId: userId,
    actorRole: user.role,
    ip: meta.ip,
    ua: meta.ua,
    // The handle and the jti, never the sid or the token: both of those are credentials
    // and the activity log is queryable by support and by the admin surface.
    meta: { session: handle, refreshJti: record.tokenJti },
  });

  return {
    accessToken: generateAccessToken({ id: userId, sid, role: user.role }),
    refreshToken,
    refreshExpiresAt: session.expiresAt,
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

/**
 * List a user's live sessions, newest-activity first; flags the caller's own.
 *
 * Addressed by **handle**, not sid. Since M3 the middleware puts the handle on
 * `req.user.sessionId` — the raw sid stays inside the token it was minted into and no
 * longer travels through request-scoped state, so nothing downstream of authentication
 * holds a value that could be replayed as a credential.
 */
export const listSessions = async (
  userId: string,
  currentHandle?: string | null,
): Promise<SessionView[]> => {
  const sessions = await SessionStore.listActive(userId);
  return sessions.map((session) => _toSessionView(session, currentHandle ?? null));
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
    // Sessions and refresh-token families are revoked together, always, in this one
    // place. Until M3 a refresh token was a bare JWT gated on its session, so killing the
    // session was enough; now the family is durable and would outlive it. Splitting the
    // two across call sites is exactly how the reference ends up revoking the session row
    // and leaving the refresh token live (§2.3-15).
    await RefreshTokenStore.revokeForSession(userId, handle, reason);
    events.record('session.revoked', { actorUserId: userId, ...ctx, meta: { session: handle, reason } });
  }
  return revoked;
};

/** Revoke every session for a user (optionally sparing one, by handle). Returns the count. */
export const revokeAllSessions = async (
  userId: string,
  exceptHandle?: string | null,
  ctx: Pick<EventContext, 'ip' | 'ua' | 'actorRole'> = {},
  reason: RevokeReason = REVOKE_REASONS.USER_LOGOUT_ALL,
): Promise<number> => {
  const count = await SessionStore.revokeAll(userId, { exceptHandle: exceptHandle ?? null, reason });
  // Unconditional, unlike the single-session path: a `count` of zero only means no
  // session was still live, which is not the same as no refresh token still being usable.
  await RefreshTokenStore.revokeAllForUser(userId, {
    reason,
    exceptSessionId: exceptHandle ?? null,
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

/** What a full credential revocation actually killed. */
export interface RevocationSummary {
  sessionsRevoked: number;
  refreshTokensRevoked: number;
  accessTokensRevoked: number;
}

/**
 * Revoke every credential a user holds: sessions, refresh-token families, and OIDC access
 * tokens.
 *
 * One function so password reset, account closure, suspension, and role change cannot
 * revoke different subsets of the same thing. That is not hypothetical tidiness — the
 * reference revokes the session row on all four paths and leaves refresh tokens and
 * third-party access tokens live on every one of them (§2.3-15), which is what happens
 * when the fan-out is written out four times.
 *
 * M2 could get away with two fan-outs because a refresh token was a bare JWT gated on its
 * session existing. It is a durable record now, so this is the third.
 */
export const revokeAllCredentials = async (
  userId: string,
  reason: RevokeReason,
  ctx: Pick<EventContext, 'ip' | 'ua' | 'actorRole'> = {},
): Promise<RevocationSummary> => {
  // Sessions first: everything else gates on the session, so this is the write that
  // actually ends the user's authority. The rest is cleaning up what it left behind.
  const sessionsRevoked = await revokeAllSessions(userId, null, ctx, reason);
  const refreshTokensRevoked = await RefreshTokenStore.revokeAllForUser(userId, { reason });
  const accessTokensRevoked = await AccessTokenStore.revokeAllForUser(userId, reason);
  return { sessionsRevoked, refreshTokensRevoked, accessTokensRevoked };
};

/**
 * Propagate a change to the denormalised account snapshot the middleware now trusts.
 *
 * **This is the precondition for that trust, not a nicety.** `auth.middleware` reads
 * `role` and `disabled` off the session document and no longer re-reads the user, which
 * removes a database round-trip from the hottest path in the system — and turns a stale
 * snapshot into a privilege bug. A demoted admin who kept their session would keep admin
 * until it expired.
 *
 * Two writes, in this order, and the order is the point:
 *
 *  1. **Re-stamp the snapshot** on every live session. Covers the narrow race where a
 *     session is created between the user write and step 2.
 *  2. **Revoke them all.** This is what makes staleness impossible rather than unlikely:
 *     no session survives the change, so no session can disagree with the user document.
 *
 * Step 2 alone would be sufficient, which is exactly why step 1 is cheap insurance.
 */
/**
 * Re-stamp the snapshot without revoking anything.
 *
 * The narrow case: a change that *widens* what a session may do (reinstatement), where
 * signing the user out would be gratuitous. Never use it for a change that narrows
 * authority — that is what `applyAccountSnapshotChange` is for.
 */
export const applySessionSnapshot = (
  userId: string,
  snapshot: { role?: string; disabled?: boolean },
): Promise<number> => SessionStore.applySnapshot(userId, snapshot);

export const applyAccountSnapshotChange = async (
  userId: string,
  snapshot: { role?: string; disabled?: boolean },
  reason: RevokeReason,
  ctx: Pick<EventContext, 'ip' | 'ua' | 'actorRole'> = {},
): Promise<RevocationSummary> => {
  await SessionStore.applySnapshot(userId, snapshot);
  return revokeAllCredentials(userId, reason, ctx);
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
 *  5. **The email-verification gate answers exactly like a wrong password** — see below.
 *  6. **Rehash on success**, which is what makes the configured cost a live setting rather
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
  await _assertEmailVerified(user, email, meta);

  await LoginThrottleStore.clear(email);
  await _upgradePasswordHash(user, input.password);

  const tokens = await createSession(user, meta);
  return { user: toPublic(user), ...tokens };
};

/**
 * Internal: refuse an unverified account — without turning the endpoint into an oracle.
 *
 * The reference implementation returns a distinct `EMAIL_NOT_VERIFIED` 403 here, *after*
 * the password has verified and *without* incrementing the throttle (§2.3-13). Both
 * halves of that are wrong, and together they are worse than either:
 *
 *  - The distinct response is a **password oracle**. An attacker guessing against an
 *    unverified account learns the exact moment they guess right, because the answer
 *    changes shape from "invalid credentials" to "verify your email". No mailbox access
 *    required, no timing analysis, just read the status code.
 *  - Skipping the counter makes that oracle **unthrottled**. Every other failure path
 *    increments and eventually locks; this one never does, so the account it leaks about
 *    is also the one account you can guess against forever.
 *
 * So this branch is byte-identical to a wrong password — same status, same code, same
 * message — and it increments the same counter, which means an attacker cannot even use
 * the *lock* to separate the cases. The only channel that carries the real reason is a
 * fresh verification link mailed to the address, dispatched without being awaited so the
 * two branches do not separate on response time either.
 *
 * The rejection is therefore only actionable by someone who controls the mailbox, which
 * is the entire point.
 */
const _assertEmailVerified = async (
  user: IUser,
  email: string,
  meta: SessionMeta,
): Promise<void> => {
  if (user.isVerified) return;

  await LoginThrottleStore.recordFailure(email);

  // Calls out to the verification service, fire-and-forget: awaiting a token write and a
  // mail dispatch here would make this branch measurably slower than a wrong password.
  void EmailVerificationService.notifyLoginBlocked(user, meta).catch((error: unknown) => {
    Logger.warn('Could not re-issue a verification link for a blocked login', { error });
  });

  throw ApiError.fromCode(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.INVALID_CREDENTIALS);
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

export interface RefreshResult {
  accessToken: string;
  /** The successor. The caller must replace the client's cookie with it. */
  refreshToken: string;
  /** Absolute, inherited from the family — used to size the replacement cookie. */
  refreshExpiresAt: Date;
}

/**
 * Rotate a refresh token: spend the presented one, issue its successor, mint a fresh
 * access token.
 *
 * The rotation itself, and the judgement about whether a replay is a race or a theft,
 * live in `refresh-token.service.ts`. What lives here is the *consequence*: turning an
 * outcome into an HTTP-shaped answer, and — for reuse — into the revocation fan-out.
 *
 * Note the order of the validations after a successful claim. The presented token is
 * already spent by then, deliberately: a token presented against a dead session must not
 * remain replayable just because the session check failed.
 */
export const refresh = async (
  refreshToken: string | undefined,
  ctx: Pick<EventContext, 'ip' | 'ua'> = {},
): Promise<RefreshResult> => {
  if (!refreshToken) {
    throw ApiError.fromCode(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.REFRESH_TOKEN_MISSING);
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.fromCode(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.REFRESH_TOKEN_INVALID);
  }

  // Calls out to the refresh-token service, which owns the compare-and-set and the
  // race-versus-theft judgement.
  const rotation = await RefreshTokenService.rotate(refreshToken, decoded.sid);

  if (rotation.outcome === REFRESH_OUTCOME.REUSE_DETECTED) {
    await _handleReuse(rotation.presented, ctx);
    throw ApiError.fromCode(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.REFRESH_TOKEN_REUSED);
  }
  if (rotation.outcome === REFRESH_OUTCOME.IN_FLIGHT) {
    // Distinct, and retriable: a rotation is provably underway but its successor is not
    // readable yet. Answering 401 here would sign out a client that did nothing wrong.
    throw ApiError.fromCode(HTTP_STATUS.CONFLICT, ERROR_CODES.REFRESH_IN_FLIGHT);
  }
  if (!rotation.token || !rotation.record) {
    // Unknown, revoked, or expired — all one answer. Telling them apart would confirm to
    // a holder of a made-up token that some other token had once been real.
    throw ApiError.fromCode(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.REFRESH_TOKEN_INVALID);
  }

  const session = await findActiveSession(decoded.id, decoded.sid);
  if (!session) {
    // The presented token is spent and its successor was never handed out; kill the
    // successor too rather than leaving a live token attached to a dead session.
    await RefreshTokenStore.revokeOne(rotation.record._id, REVOKE_REASONS.ADMIN_REVOKED);
    throw ApiError.fromCode(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.SESSION_INVALID);
  }

  // Through the store, so `deletedAt: null` is enforced here as on every other credential
  // path — a closed account must not be able to mint a fresh access token from a refresh
  // token issued before closure. This read stays, unlike the one the middleware dropped:
  // refresh runs once per access-token lifetime, not once per request.
  const user = await UserStore.findLiveById(decoded.id);
  if (!user) throw ApiError.fromCode(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.SESSION_INVALID);
  AccountState.assertUsable(user);

  // Advance the session's pointer at the leaf. Best-effort and non-authoritative — the
  // compare-and-set on the token row is what decides validity — so it is written last,
  // where a failure costs an out-of-date field on an admin screen and nothing more. Idempotent
  // on the grace path, where the pointer is already where it should be.
  await SessionStore.setCurrentRefreshToken(session._id, rotation.record._id);

  events.record('refresh.success', {
    actorUserId: decoded.id,
    actorRole: user.role,
    ...ctx,
  });

  return {
    accessToken: generateAccessToken({ id: decoded.id, sid: decoded.sid, role: user.role }),
    refreshToken: rotation.token,
    refreshExpiresAt: rotation.record.expiresAt,
  };
};

/**
 * Internal: an already-rotated token was presented outside the grace window.
 *
 * Either the token was stolen and the thief is late, or the legitimate client has been
 * cloned. Both mean the family is compromised, and the response is to kill it — including
 * the attacker's own descendants, which is the part that makes rotation worth having. A
 * thief who used a token *before* the legitimate client rotates wins that round; what
 * they cannot do is keep the access, because the legitimate client's next refresh trips
 * this same check from the other side.
 *
 * Order: **session first**, because it is what every authenticated request gates on and
 * therefore what actually ends the access. Then the family, then the audit event.
 *
 * Blast radius is the family and its session, not every session the user holds. Killing
 * everything punishes a user whose other devices are demonstrably fine and makes any
 * false positive catastrophic; the stricter posture is available as a setting for
 * deployments that want it, and is deliberately not the default.
 */
const _handleReuse = async (
  presented: IRefreshToken | undefined,
  ctx: Pick<EventContext, 'ip' | 'ua'>,
): Promise<void> => {
  if (!presented) return;
  const userId = presented.userId.toString();

  await revokeSession(userId, presented.sessionId, ctx, REVOKE_REASONS.TOKEN_REUSE_DETECTED);
  const familyRevoked = await RefreshTokenStore.revokeFamily(
    presented.familyId,
    REVOKE_REASONS.TOKEN_REUSE_DETECTED,
  );

  const allSessions = Config.sessions.reuseRevokesAllSessions;
  if (allSessions) {
    await revokeAllCredentials(userId, REVOKE_REASONS.TOKEN_REUSE_DETECTED, ctx);
  }

  Logger.warn('Refresh token reuse detected — family revoked', {
    jti: presented.tokenJti,
    familyRevoked,
    allSessions,
  });
  events.record('refresh.reuse_detected', {
    actorUserId: userId,
    ...ctx,
    // The jti and the handle, never the token: this log is queryable by support.
    meta: {
      jti: presented.tokenJti,
      session: presented.sessionId,
      familyRevoked,
      allSessions,
    },
  });
};

export const logout = async (userId: string, handle: string | null) => {
  if (!handle) return;
  // Through the service rather than the store, so the refresh family dies with the
  // session instead of outliving the sign-out.
  await revokeSession(userId, handle, {}, REVOKE_REASONS.USER_LOGOUT);
};

export const getMe = async (userId: string) => {
  const user = await UserStore.findLiveById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return toPublic(user);
};
