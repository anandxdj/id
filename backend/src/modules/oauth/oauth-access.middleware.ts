import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { BEARER_PREFIX, OAUTH_ERRORS } from '../../common/constants/index.constants';
import { OidcTokenService } from './oidc-token.service';

/**
 * Resolve a Bearer OIDC access token into `req.oauth`.
 *
 * The rejection is deliberately uniform. A caller learns only "this credential does not
 * authorise you here" — never whether it failed because the signature was wrong, the
 * `typ` said `JWT` instead of `at+jwt`, the audience named a client rather than this
 * issuer, or the token had been revoked. Each of those distinctions is a usable probe.
 *
 * A first-party session token presented here fails at the very first check: it is HS256
 * against a secret that never leaves the server, so it has no `kid`, no `at+jwt`, and no
 * signature this endpoint could verify even in principle. That direction of the type
 * confusion in plan §2.3-1 is closed structurally rather than by a comparison.
 */
const _reject = (res: Response, description: string): void => {
  res
    .status(401)
    .set('WWW-Authenticate', `Bearer error="${OAUTH_ERRORS.INVALID_TOKEN}"`)
    .json({ error: OAUTH_ERRORS.INVALID_TOKEN, error_description: description });
};

export const authenticateOidcAccess = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith(BEARER_PREFIX)) {
      _reject(res, 'Missing or invalid access token');
      return;
    }

    // Calls out to the token service, which pins `typ`/`alg`/`iss`/`aud` and then
    // consults the server-side record — the TTL index reaps on a ~60 s cycle and can
    // never be what enforces expiry or revocation.
    const verified = await OidcTokenService.verifyAccessToken(auth.slice(BEARER_PREFIX.length));
    if (!verified) {
      _reject(res, 'Invalid or expired access token');
      return;
    }

    // Scope comes from the record, not the token body: the database is what the user
    // consented to, and it is what a later consent withdrawal edits.
    req.oauth = {
      userId: verified.record.userId.toString(),
      clientId: verified.record.clientId,
      scope: verified.record.scope,
    };
    next();
  },
);
