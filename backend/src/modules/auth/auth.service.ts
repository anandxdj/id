import { ApiError } from '../../common/utils/ApiError';
import { redis } from '../../common/config/redis';
import { randomBase64Url } from '../../common/utils/crypto.utils';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../common/utils/jwt.utils';
import * as events from '../events/event.service';
import type { EventContext } from '../events/event.types';
import User from './auth.model';
import type { IUser } from './auth.model';

export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7; // 7d — keep aligned with JWT_REFRESH_EXPIRES_IN

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

const sessionKey = (userId: string, sid: string) => `session:${userId}:${sid}`;
const sessionPrefix = (userId: string) => `session:${userId}:`;

/** Device metadata captured when a session is created. */
export interface SessionMeta {
  ua?: string;
  ip?: string;
}

/** Stored shape of a whitelisted session (the Redis value). */
export interface SessionRecord {
  ua?: string;
  ip?: string;
  createdAt: number; // epoch ms
  lastSeenAt: number; // epoch ms
}

export interface SessionView extends SessionRecord {
  sid: string;
  current: boolean;
  expiresInSeconds: number;
}

const LASTSEEN_THROTTLE_MS = 60_000;

/** Parse a stored session value, tolerating the legacy `'1'` whitelist marker. */
const parseSession = (raw: string | null): SessionRecord | null => {
  if (!raw) return null;
  if (raw === '1') return { createdAt: 0, lastSeenAt: 0 }; // pre-enrichment session
  try {
    return JSON.parse(raw) as SessionRecord;
  } catch {
    return null;
  }
};

/** SCAN all session keys for a user (small N — one per active device). */
const scanSessionKeys = async (userId: string): Promise<string[]> => {
  const match = `${sessionPrefix(userId)}*`;
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', match, 'COUNT', 100);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0');
  return keys;
};

/** Create a whitelisted session for a user and return the token pair. Shared by
 *  password login and every social connector callback. */
export const createSession = async (user: IUser, meta: SessionMeta = {}) => {
  const sid = randomBase64Url(24);
  const now = Date.now();
  const record: SessionRecord = { ua: meta.ua, ip: meta.ip, createdAt: now, lastSeenAt: now };
  await redis.set(sessionKey(user._id.toString(), sid), JSON.stringify(record), 'EX', REFRESH_TTL_SECONDS);
  events.record('session.created', {
    actorUserId: user._id.toString(),
    actorRole: user.role,
    ip: meta.ip,
    ua: meta.ua,
    meta: { sid },
  });
  const base = { id: user._id.toString(), sid, role: user.role };
  return {
    accessToken: generateAccessToken(base),
    refreshToken: generateRefreshToken({ id: base.id, sid }),
  };
};

/** Refresh a session's lastSeenAt (throttled, TTL preserved). Fire-and-forget. */
export const touchSession = async (userId: string, sid: string | null | undefined): Promise<void> => {
  if (!sid) return;
  const key = sessionKey(userId, sid);
  const rec = parseSession(await redis.get(key));
  if (!rec) return;
  const now = Date.now();
  if (now - (rec.lastSeenAt ?? 0) < LASTSEEN_THROTTLE_MS) return;
  rec.lastSeenAt = now;
  await redis.set(key, JSON.stringify(rec), 'KEEPTTL');
};

/** List a user's active sessions, newest-activity first; flags the caller's own. */
export const listSessions = async (
  userId: string,
  currentSid?: string | null,
): Promise<SessionView[]> => {
  const keys = await scanSessionKeys(userId);
  const prefix = sessionPrefix(userId);
  const views = await Promise.all(
    keys.map(async (key): Promise<SessionView> => {
      const sid = key.slice(prefix.length);
      const rec = parseSession(await redis.get(key)) ?? { createdAt: 0, lastSeenAt: 0 };
      const ttl = await redis.ttl(key);
      return {
        sid,
        ua: rec.ua,
        ip: rec.ip,
        createdAt: rec.createdAt,
        lastSeenAt: rec.lastSeenAt,
        current: sid === currentSid,
        expiresInSeconds: ttl,
      };
    }),
  );
  views.sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
  return views;
};

/** Revoke one session. Returns true if it existed. */
export const revokeSession = async (
  userId: string,
  sid: string,
  ctx: Pick<EventContext, 'ip' | 'ua' | 'actorRole'> = {},
): Promise<boolean> => {
  const removed = await redis.del(sessionKey(userId, sid));
  if (removed > 0) {
    events.record('session.revoked', { actorUserId: userId, ...ctx, meta: { sid } });
  }
  return removed > 0;
};

/** Revoke every session for a user (optionally keeping one). Returns the count revoked. */
export const revokeAllSessions = async (
  userId: string,
  exceptSid?: string | null,
  ctx: Pick<EventContext, 'ip' | 'ua' | 'actorRole'> = {},
): Promise<number> => {
  const keys = await scanSessionKeys(userId);
  const prefix = sessionPrefix(userId);
  let count = 0;
  for (const key of keys) {
    if (exceptSid && key.slice(prefix.length) === exceptSid) continue;
    count += await redis.del(key);
  }
  if (count > 0) {
    events.record('session.revoked', { actorUserId: userId, ...ctx, meta: { all: true, count, exceptSid } });
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

  const whitelisted = await redis.get(sessionKey(decoded.id, decoded.sid));
  if (!whitelisted) throw ApiError.unauthorized('Session expired or revoked');

  const user = await User.findById(decoded.id);
  if (!user) throw ApiError.unauthorized('User no longer exists');

  const accessToken = generateAccessToken({ id: decoded.id, sid: decoded.sid, role: user.role });
  return { accessToken };
};

export const logout = async (userId: string, sid: string | null) => {
  if (sid) await redis.del(sessionKey(userId, sid));
};

export const getMe = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return toPublic(user);
};
