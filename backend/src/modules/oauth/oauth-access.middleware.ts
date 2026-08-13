import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { BEARER_PREFIX } from '../../common/constants/index.constants';
import { AccessTokenStore } from './access-token.store';

/** Resolve an opaque Bearer access token (from /oauth/token) into req.oauth. */
export const authenticateOidcAccess = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith(BEARER_PREFIX)) {
      res
        .status(401)
        .set('WWW-Authenticate', 'Bearer error="invalid_token"')
        .json({ error: 'invalid_token', error_description: 'Missing or invalid access token' });
      return;
    }

    // Calls out to the access-token store, which filters on `revokedAt` and `expiresAt`
    // itself — the TTL index reaps on a ~60 s cycle and cannot be what enforces expiry.
    const token = await AccessTokenStore.findLive(auth.slice(BEARER_PREFIX.length));
    if (!token) {
      res
        .status(401)
        .set('WWW-Authenticate', 'Bearer error="invalid_token"')
        .json({ error: 'invalid_token', error_description: 'Invalid or expired access token' });
      return;
    }

    req.oauth = {
      userId: token.userId.toString(),
      clientId: token.clientId,
      scope: token.scope,
    };
    next();
  },
);
