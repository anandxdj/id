import type { Request, Response } from 'express';
import { Logger } from '../../common/logger/index.logger';
import { NO_STORE_HEADERS, OAUTH_ERRORS } from '../../common/constants/index.constants';
import { runAuthorize, exchangeToken, getUserinfo } from './oauth.service';
import { RevocationService } from './revocation.service';
import { IntrospectionService } from './introspection.service';
import { EndSessionService } from './end-session.service';

/**
 * Protocol endpoints.
 *
 * Every handler wraps its body in try/catch even though `asyncHandler` already catches
 * (house rule 12) — but the catch here does something the generic error handler cannot:
 * it emits an **RFC 6749-shaped** failure. The shared handler produces
 * `{ message, code: 'INTERNAL_ERROR' }`, which is our internal contract and means
 * nothing to a conforming OAuth client. Leaking it into a protocol response is how a
 * client ends up unable to distinguish a server fault from a rejected grant.
 */

const _protocolFailure = (res: Response, error: unknown, endpoint: string): void => {
  Logger.error('OAuth endpoint failed', { endpoint, error });
  if (res.headersSent) return;
  res.set(NO_STORE_HEADERS).status(500).json({
    error: OAUTH_ERRORS.SERVER_ERROR,
    error_description: 'The authorization server encountered an unexpected condition',
  });
};

export const authorize = async (req: Request, res: Response) => {
  try {
    await runAuthorize(req, res);
  } catch (error) {
    _protocolFailure(res, error, 'authorize');
  }
};

export const token = async (req: Request, res: Response) => {
  try {
    await exchangeToken(req, res);
  } catch (error) {
    _protocolFailure(res, error, 'token');
  }
};

export const userinfo = async (req: Request, res: Response) => {
  try {
    await getUserinfo(req, res);
  } catch (error) {
    _protocolFailure(res, error, 'userinfo');
  }
};

/** RFC 7009 §2 — token revocation. */
export const revoke = async (req: Request, res: Response) => {
  try {
    await RevocationService.revoke(req, res);
  } catch (error) {
    _protocolFailure(res, error, 'revoke');
  }
};

/** RFC 7662 §2 — token introspection. */
export const introspect = async (req: Request, res: Response) => {
  try {
    await IntrospectionService.introspect(req, res);
  } catch (error) {
    _protocolFailure(res, error, 'introspect');
  }
};

/** OIDC RP-Initiated Logout 1.0 §2 — the end_session_endpoint. */
export const endSession = async (req: Request, res: Response) => {
  try {
    await EndSessionService.endSession(req, res);
  } catch (error) {
    _protocolFailure(res, error, 'end_session');
  }
};
