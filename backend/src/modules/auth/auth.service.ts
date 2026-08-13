import { ApiError } from '../../common/utils/ApiError';
import { randomBase64Url } from '../../common/utils/crypto.utils';
import {
  CRYPTO,
  MILLISECONDS,
  REVOKE_REASONS,
  TTL_SECONDS,
} from '../../common/constants/index.constants';
import type { RevokeReason } from '../../common/constants/index.constants';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../common/utils/jwt.utils';
import * as events from '../events/event.service';
import type { EventContext } from '../events/event.types';
import User from './auth.model';
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

export { toPublic };

export const register = async (input: { name: string; email: string; password: string }) => {
  const email = input.email.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({ name: input.name.trim(), email, password: input.password });
  return toPublic(user);
};

export const login = async (
  input: { email: string; password: string },
  meta: SessionMeta = {},
) => {
  const user = await User.findOne({ email: input.email.toLowerCase().trim() }).select('+password');
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const ok = await user.comparePassword(input.password);
  if (!ok) throw ApiError.unauthorized('Invalid email or password');

  if (user.disabled) throw ApiError.forbidden('This account has been disabled');

  const tokens = await createSession(user, meta);
  return { user: toPublic(user), ...tokens };
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

  const user = await User.findById(decoded.id);
  if (!user) throw ApiError.unauthorized('User no longer exists');

  const accessToken = generateAccessToken({ id: decoded.id, sid: decoded.sid, role: user.role });
  return { accessToken };
};

export const logout = async (userId: string, sid: string | null) => {
  if (!sid) return;
  await SessionStore.revoke(userId, SessionStore.handleOf(sid), REVOKE_REASONS.USER_LOGOUT);
};

export const getMe = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return toPublic(user);
};
