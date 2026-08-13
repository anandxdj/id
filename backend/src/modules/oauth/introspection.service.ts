import type { Request, Response } from 'express';
import { getOidcIssuer } from '../../common/utils/keys.utils';
import {
  INTROSPECTION_AUTH_METHODS,
  NO_STORE_HEADERS,
  OAUTH_ERRORS,
  TOKEN_TYPE_BEARER,
  TOKEN_TYPE_HINTS,
} from '../../common/constants/index.constants';
import { ClientAuthService } from './client-auth.service';
import { OidcTokenService } from './oidc-token.service';

/**
 * RFC 7662 — OAuth 2.0 Token Introspection.
 *
 * An introspection endpoint is, by construction, a machine for answering "is this
 * credential live?". §2.1 therefore requires it to be protected, and §4 spells out the
 * threat: without authentication it becomes "a fishing expedition" — an attacker feeds
 * it guesses and learns which are real. Two rules follow, and this service enforces
 * both.
 *
 *  1. **Authenticated callers only, and only confidential ones.** A public client
 *     authenticates with `none`, so honouring it here would mean honouring anyone who
 *     can read a `client_id` out of a browser URL. Public clients get 401 regardless of
 *     how they are registered.
 *
 *  2. **A caller learns nothing about tokens that are not its own.** Another client's
 *     token, a revoked token, an expired token, a forged token and a random string all
 *     produce the identical `{ "active": false }` — §2.2 explicitly makes that the
 *     answer for anything the caller is not authorised to know about.
 */
const INACTIVE = { active: false } as const;

const SUPPORTED_HINTS: readonly string[] = Object.values(TOKEN_TYPE_HINTS);

export const IntrospectionService = {
  async introspect(req: Request, res: Response): Promise<void> {
    res.set(NO_STORE_HEADERS);

    const auth = await ClientAuthService.authenticate(req, {
      allowedMethods: INTROSPECTION_AUTH_METHODS,
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
      res.status(400).json({
        error: OAUTH_ERRORS.UNSUPPORTED_TOKEN_TYPE,
        error_description: `token_type_hint must be one of: ${SUPPORTED_HINTS.join(', ')}`,
      });
      return;
    }

    // Full verification, not a bare store lookup: an ID token, a first-party session
    // token, or anything else with the wrong `typ`/`aud` must read as inactive rather
    // than as "some token we happen to have a row for".
    const verified = await OidcTokenService.verifyAccessToken(token);
    if (!verified || verified.record.clientId !== auth.client.clientId) {
      res.json(INACTIVE);
      return;
    }

    const record = verified.record;
    res.json({
      active: true,
      scope: record.scope,
      client_id: record.clientId,
      token_type: TOKEN_TYPE_BEARER,
      sub: record.userId.toString(),
      aud: getOidcIssuer(),
      iss: getOidcIssuer(),
      jti: record.jti,
      exp: Math.floor(record.expiresAt.getTime() / 1_000),
      iat: Math.floor(record.createdAt.getTime() / 1_000),
      ...(record.authTime
        ? { auth_time: Math.floor(record.authTime.getTime() / 1_000) }
        : {}),
    });
  },
};
