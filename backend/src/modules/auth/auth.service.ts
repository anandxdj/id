import { ApiError } from '../../common/utils/ApiError';
import { redis } from '../../common/config/redis';
import { randomBase64Url } from '../../common/utils/crypto.utils';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../common/utils/jwt.utils';
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

/** Create a whitelisted session for a user and return the token pair. Shared by
 *  password login and every social connector callback. */
export const createSession = async (user: IUser) => {
  const sid = randomBase64Url(24);
  await redis.set(sessionKey(user._id.toString(), sid), '1', 'EX', REFRESH_TTL_SECONDS);
  const base = { id: user._id.toString(), sid, role: user.role };
  return {
    accessToken: generateAccessToken(base),
    refreshToken: generateRefreshToken({ id: base.id, sid }),
  };
};

export { toPublic };

export const register = async (input: { name: string; email: string; password: string }) => {
  const email = input.email.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({ name: input.name.trim(), email, password: input.password });
  return toPublic(user);
};

export const login = async (input: { email: string; password: string }) => {
  const user = await User.findOne({ email: input.email.toLowerCase().trim() }).select('+password');
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const ok = await user.comparePassword(input.password);
  if (!ok) throw ApiError.unauthorized('Invalid email or password');

  const tokens = await createSession(user);
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
