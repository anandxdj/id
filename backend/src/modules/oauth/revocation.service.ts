import type { Request, Response } from 'express';
import {
  NO_STORE_HEADERS,
  OAUTH_ERRORS,
  REVOKE_REASONS,
  REVOCATION_AUTH_METHODS,
  TOKEN_TYPE_HINTS,
} from '../../common/constants/index.constants';
import { Logger } from '../../common/logger/index.logger';
import * as events from '../events/event.service';
import { AccessTokenStore } from './access-token.store';
import { ClientAuthService } from './client-auth.service';

/**
 * RFC 7009 — OAuth 2.0 Token Revocation.
 *
 * Three requirements from the RFC that are easy to get wrong, and all three are the
 * reason this is a service rather than four lines in a controller:
 *
 *  - **§2.2 — an unknown token is a success.** "The authorization server responds with
 *    HTTP status code 200 if the token has been revoked successfully or if the client
 *    submitted an invalid token." Returning 400 for an unrecognised token turns the
 *    endpoint into an oracle: a caller could enumerate live tokens by watching status
 *    codes. Every outcome below returns 200.
 *
 *  - **§2.1 — revoking cascades across the grant.** "If the particular token is a
 *    refresh token and the authorization server supports the revocation of access
 *    tokens, then the authorization server SHOULD also invalidate all access tokens
 *    based on the same authorization grant." Refresh tokens land in M3; the `grantId`
 *    written at code issuance is the join column, and today it already means revoking
 *    one access token revokes everything else that code minted.
 *
 *  - **§2.1 — a client may only revoke its own tokens.** Another client's token is
 *    left untouched, and the response is still 200 so the attempt reveals nothing.
 */

const SUPPORTED_HINTS: readonly string[] = Object.values(TOKEN_TYPE_HINTS);

export const RevocationService = {
  async revoke(req: Request, res: Response): Promise<void> {
    res.set(NO_STORE_HEADERS);

    // Public clients may revoke their own tokens (RFC 7009 §2.1), so the full method
    // set is accepted here — unlike introspection.
    const auth = await ClientAuthService.authenticate(req, {
      allowedMethods: REVOCATION_AUTH_METHODS,
    });
    if (!auth.ok) {
      if (auth.challenge) res.set('WWW-Authenticate', auth.challenge);
      res.status(auth.status).json({ error: auth.error, error_description: auth.description });
      return;
    }

    const token = req.body?.token as string | undefined;
    if (!token) {
      res.status(400).json({
        error: OAUTH_ERRORS.INVALID_REQUEST,
        error_description: 'token is required',
      });
      return;
    }

    const hint = req.body?.token_type_hint as string | undefined;
    if (hint && !SUPPORTED_HINTS.includes(hint)) {
      // §2.2.1: an unsupported hint is the one error case the RFC does define.
      res.status(400).json({
        error: OAUTH_ERRORS.UNSUPPORTED_TOKEN_TYPE,
        error_description: `token_type_hint must be one of: ${SUPPORTED_HINTS.join(', ')}`,
      });
      return;
    }

    const record = await AccessTokenStore.findAny(token);

    // Unknown token, already-dead token, or another client's token: all 200, all silent.
    if (!record || record.clientId !== auth.client.clientId) {
      res.status(200).end();
      return;
    }

    const direct = await AccessTokenStore.revokeByHash(
      record.tokenHash,
      REVOKE_REASONS.CLIENT_REVOKED_TOKEN,
    );
    const cascaded = record.grantId
      ? await AccessTokenStore.revokeByGrant(record.grantId, REVOKE_REASONS.GRANT_REVOKED)
      : 0;

    Logger.info('Token revoked at the client\'s request', {
      clientId: auth.client.clientId,
      // Never `revokedTokens`: the logger redacts by key pattern and anything matching
      // `token` would come out as `[redacted]`, hiding the number that matters.
      revokedCount: direct + cascaded,
      grantCascade: cascaded,
    });

    events.record('oauth.token.revoked', {
      actorUserId: record.userId.toString(),
      clientId: auth.client.clientId,
      ...events.reqContext(req),
      meta: { revokedCount: direct + cascaded, grantCascade: cascaded },
    });

    res.status(200).end();
  },
};
