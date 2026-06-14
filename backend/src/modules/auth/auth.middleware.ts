import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../common/utils/ApiError';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { verifyAccessToken } from '../../common/utils/jwt.utils';
import { redis } from '../../common/config/redis';
import { touchSession } from './auth.service';
import User from './auth.model';
import type { AuthUser } from '../../types/express';

const sessionKey = (userId: string, sid: string | undefined) =>
  sid ? `session:${userId}:${sid}` : `session:${userId}`;

const readAccessToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer')) {
    return header.split(' ')[1] ?? null;
  }
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken as string;
  }
  return null;
};

const toAuthUser = (
  user: { _id: { toString(): string }; role: string; name: string; email: string },
  sid: string | null,
): AuthUser => ({
  id: user._id.toString(),
  sessionId: sid,
  role: user.role,
  name: user.name,
  email: user.email,
});

/** Require a valid access token whose session is still whitelisted in Redis. */
export const authenticate = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const token = readAccessToken(req);
  if (!token) throw ApiError.unauthorized('Not authenticated');

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    // Expired/invalid: do NOT clear cookies — the frontend can still refresh.
    throw ApiError.unauthorized('Session expired or invalid');
  }

  const whitelisted = await redis.get(sessionKey(decoded.id, decoded.sid));
  if (!whitelisted) {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    throw ApiError.unauthorized('Session expired or revoked');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    throw ApiError.unauthorized('User no longer exists');
  }

  req.user = toAuthUser(user, decoded.sid ?? null);
  // Refresh last-seen for the sessions dashboard (throttled, never blocks the request).
  void touchSession(decoded.id, decoded.sid).catch(() => {});
  next();
});

/** Attach req.user when a valid session is present; never throws (anonymous-friendly). */
export const tryAttachUser = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = readAccessToken(req);
  if (!token) return next();
  try {
    const decoded = verifyAccessToken(token);
    const whitelisted = await redis.get(sessionKey(decoded.id, decoded.sid));
    if (whitelisted) {
      const user = await User.findById(decoded.id);
      if (user) req.user = toAuthUser(user, decoded.sid ?? null);
    }
  } catch {
    // invalid or expired — treat as anonymous
  }
  next();
});

/** Restrict a route to the given roles. */
export const authorize =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw ApiError.forbidden('You do not have permission to perform this action');
    }
    next();
  };
