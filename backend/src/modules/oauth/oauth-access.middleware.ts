import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { hashToken } from '../../common/utils/crypto.utils';
import { redis } from '../../common/config/redis';

/** Resolve an opaque Bearer access token (from /oauth/token) into req.oauth. */
export const authenticateOidcAccess = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      res
        .status(401)
        .set('WWW-Authenticate', 'Bearer error="invalid_token"')
        .json({ error: 'invalid_token', error_description: 'Missing or invalid access token' });
      return;
    }

    const token = auth.slice(7);
    const tokenJson = await redis.get(`access_token:${hashToken(token)}`);
    if (!tokenJson) {
      res
        .status(401)
        .set('WWW-Authenticate', 'Bearer error="invalid_token"')
        .json({ error: 'invalid_token', error_description: 'Invalid or expired access token' });
      return;
    }

    const row = JSON.parse(tokenJson) as { userId: string; clientId: string; scope: string };
    req.oauth = { userId: row.userId, clientId: row.clientId, scope: row.scope };
    next();
  },
);
