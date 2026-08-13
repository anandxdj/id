import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../common/utils/ApiError';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { verifyAccessToken } from '../../common/utils/jwt.utils';
import { COOKIE_NAMES, ERROR_CODES, HTTP_STATUS } from '../../common/constants/index.constants';
import { findActiveSession, touchSession } from './auth.service';
import type { ISession } from './session.model';
import type { AuthUser } from '../../types/express';

/**
 * Request authentication.
 *
 * **One database read per authenticated request, as of M3.** It used to be two: the
 * session lookup, then a `User.findById` to discover the caller's role and whether they
 * had been disabled. The role and the disabled flag are now read from the session
 * document itself, where they have been denormalised since M1 and deliberately not
 * trusted.
 *
 * Trusting them is only safe because a stale snapshot is now impossible rather than
 * merely unlikely. Every mutation that could invalidate one — role change, suspension,
 * account closure, password reset — revokes the affected sessions through
 * `auth.service.applyAccountSnapshotChange` / `revokeAllCredentials` before the change is
 * observable anywhere. A session that still resolves is therefore a session whose
 * snapshot still matches the user document; a demoted admin has no session left to read
 * an admin role out of.
 *
 * That ordering is the whole reason this flip is an M3 change and not an M1 one. Flipping
 * the read path first would have produced exactly the privilege bug the denormalisation
 * was supposed to be free of.
 *
 * What we do **not** do is trust the access token's own `role` claim. It is minted at
 * sign-in and lives for fifteen minutes with no way to invalidate it; the session
 * document is a row we can revoke. The claim stays in the token for downstream
 * convenience and is authoritative for nothing.
 */

const readAccessToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer')) {
    return header.split(' ')[1] ?? null;
  }
  if (req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN]) {
    return req.cookies[COOKIE_NAMES.ACCESS_TOKEN] as string;
  }
  return null;
};

/** Internal: build the request principal from the session snapshot alone. */
const _toAuthUser = (userId: string, session: ISession): AuthUser => ({
  id: userId,
  sessionId: session._id,
  role: session.role,
});

/** Internal: a dead session means dead cookies; the client should stop presenting them. */
const _clearCredentialCookies = (res: Response): void => {
  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, { path: '/' });
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { path: '/' });
};

/** Require a valid access token whose session is still live in Mongo. */
export const authenticate = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const token = readAccessToken(req);
  if (!token) throw ApiError.fromCode(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.MISSING_TOKEN);

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    // Expired/invalid: do NOT clear cookies — the frontend can still refresh.
    throw ApiError.fromCode(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.TOKEN_EXPIRED);
  }

  // Calls out to the session store, which filters on `expiresAt` itself — the TTL
  // index reaps on a ~60 s cycle and must never be the thing enforcing expiry.
  const session = await findActiveSession(decoded.id, decoded.sid);
  if (!session) {
    _clearCredentialCookies(res);
    throw ApiError.fromCode(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.SESSION_INVALID);
  }

  // Belt-and-braces. Suspension revokes every session, so a disabled snapshot on a live
  // session should be unreachable — but a snapshot that is trusted has to be checked, or
  // the field is decoration.
  if (session.disabled) {
    _clearCredentialCookies(res);
    throw ApiError.fromCode(HTTP_STATUS.FORBIDDEN, ERROR_CODES.ACCOUNT_UNAVAILABLE);
  }

  req.user = _toAuthUser(decoded.id, session);
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
    if (session && !session.disabled) req.user = _toAuthUser(decoded.id, session);
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
      throw ApiError.forbidden();
    }
    next();
  };
