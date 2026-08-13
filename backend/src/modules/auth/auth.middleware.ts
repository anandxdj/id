import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../common/utils/ApiError';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { verifyAccessToken } from '../../common/utils/jwt.utils';
import { COOKIE_NAMES } from '../../common/constants/index.constants';
import { findActiveSession, touchSession } from './auth.service';
import User from './auth.model';
import type { AuthUser } from '../../types/express';

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

/** Require a valid access token whose session is still live in Mongo. */
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

  // Calls out to the session store, which filters on `expiresAt` itself — the TTL
  // index reaps on a ~60 s cycle and must never be the thing enforcing expiry.
  const session = await findActiveSession(decoded.id, decoded.sid);
  if (!session) {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { path: '/' });
    throw ApiError.unauthorized('Session expired or revoked');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { path: '/' });
    throw ApiError.unauthorized('User no longer exists');
  }
  if (user.disabled) {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { path: '/' });
    throw ApiError.forbidden('This account has been disabled');
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
    const session = await findActiveSession(decoded.id, decoded.sid);
    if (session) {
      const user = await User.findById(decoded.id);
      if (user && !user.disabled) req.user = toAuthUser(user, decoded.sid ?? null);
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
