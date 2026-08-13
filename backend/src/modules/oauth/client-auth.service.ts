import type { Request } from 'express';
import {
  BASIC_PREFIX,
  OAUTH_ERRORS,
  TOKEN_ENDPOINT_AUTH_METHODS,
} from '../../common/constants/index.constants';
import type { OAuthErrorCode } from '../../common/constants/index.constants';
import * as clientService from '../oauth-client/oauth-client.service';
import { ClientPolicy } from './client-policy.service';
import type { IOAuthClient } from '../oauth-client/oauth-client.model';

/**
 * Client authentication for the token, revocation and introspection endpoints.
 *
 * The rule this module exists to enforce is that a client authenticates the way it is
 * *registered* to authenticate, and no other way. Accepting whatever the request
 * happens to present is how a public client ends up able to pass a stolen secret, and
 * how a confidential client's `client_id` alone becomes sufficient at an endpoint that
 * forgot to check.
 *
 * RFC 6749 §2.3 is also explicit that a client "MUST NOT use more than one
 * authentication method in each request" — presenting Basic *and* a body secret is
 * rejected outright rather than silently resolved in favour of one of them.
 */

export type ClientAuthOutcome =
  | { ok: true; client: IOAuthClient; method: string }
  | {
      ok: false;
      status: number;
      error: OAuthErrorCode;
      description: string;
      /** Set when the caller used Basic, so the 401 can carry the RFC 6749 §5.2 challenge. */
      challenge?: string;
    };

export interface ClientAuthOptions {
  /**
   * Methods this endpoint accepts, independent of registration. Introspection narrows
   * it to the confidential methods so it cannot become an unauthenticated oracle.
   */
  allowedMethods: readonly string[];
}

interface PresentedCredentials {
  clientId?: string;
  clientSecret?: string;
  method: string;
  usedBasic: boolean;
  /** More than one authentication mechanism, or contradictory client ids. */
  conflict?: string;
}

const BASIC_CHALLENGE = 'Basic realm="oauth", charset="UTF-8"';

const _asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

/**
 * Internal: RFC 6749 §2.3.1 form-urlencodes both halves before base64. `decodeURIComponent`
 * throws on a malformed escape, and an attacker-supplied header must not be able to turn
 * a rejected credential into a 500.
 */
const _formDecode = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

/**
 * Internal: work out what the caller actually presented, without deciding whether it
 * is acceptable. Keeping detection and policy apart is what makes "you used
 * client_secret_post but you are registered for client_secret_basic" expressible.
 */
const _presented = (req: Request): PresentedCredentials => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const bodyId = _asString(body.client_id);
  const bodySecret = _asString(body.client_secret);

  const header = req.headers.authorization;
  if (header?.startsWith(BASIC_PREFIX)) {
    const decoded = Buffer.from(header.slice(BASIC_PREFIX.length), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator < 0) {
      return {
        method: TOKEN_ENDPOINT_AUTH_METHODS.CLIENT_SECRET_BASIC,
        usedBasic: true,
        conflict: 'Malformed Basic credentials',
      };
    }
    const basicId = _formDecode(decoded.slice(0, separator));
    const basicSecret = _formDecode(decoded.slice(separator + 1));
    if (basicId === null || basicSecret === null) {
      return {
        method: TOKEN_ENDPOINT_AUTH_METHODS.CLIENT_SECRET_BASIC,
        usedBasic: true,
        conflict: 'Malformed Basic credentials',
      };
    }

    if (bodySecret) {
      return {
        clientId: basicId,
        method: TOKEN_ENDPOINT_AUTH_METHODS.CLIENT_SECRET_BASIC,
        usedBasic: true,
        conflict: 'More than one client authentication mechanism was used',
      };
    }
    if (bodyId && bodyId !== basicId) {
      return {
        clientId: basicId,
        method: TOKEN_ENDPOINT_AUTH_METHODS.CLIENT_SECRET_BASIC,
        usedBasic: true,
        conflict: 'client_id in the body contradicts the Authorization header',
      };
    }
    return {
      clientId: basicId,
      clientSecret: basicSecret,
      method: TOKEN_ENDPOINT_AUTH_METHODS.CLIENT_SECRET_BASIC,
      usedBasic: true,
    };
  }

  return {
    clientId: bodyId,
    clientSecret: bodySecret,
    method: bodySecret
      ? TOKEN_ENDPOINT_AUTH_METHODS.CLIENT_SECRET_POST
      : TOKEN_ENDPOINT_AUTH_METHODS.NONE,
    usedBasic: false,
  };
};

export const ClientAuthService = {
  /**
   * Authenticate the calling client.
   *
   * Every failure returns `invalid_client` with the same generic description. The
   * branches are kept apart internally — unknown client, wrong method, bad secret — but
   * telling them apart in the response would confirm which client ids exist and which
   * of them are public.
   */
  async authenticate(req: Request, options: ClientAuthOptions): Promise<ClientAuthOutcome> {
    const presented = _presented(req);
    const challenge = presented.usedBasic ? BASIC_CHALLENGE : undefined;

    if (presented.conflict) {
      return {
        ok: false,
        status: 400,
        error: OAUTH_ERRORS.INVALID_REQUEST,
        description: presented.conflict,
        challenge,
      };
    }

    if (!presented.clientId) {
      return {
        ok: false,
        status: 401,
        error: OAUTH_ERRORS.INVALID_CLIENT,
        description: 'Client authentication required',
        challenge,
      };
    }

    const client = await clientService.findByClientId(presented.clientId, { withSecret: true });
    if (!client) {
      return {
        ok: false,
        status: 401,
        error: OAUTH_ERRORS.INVALID_CLIENT,
        description: 'Client authentication failed',
        challenge,
      };
    }
    if (client.suspended) {
      return {
        ok: false,
        status: 401,
        error: OAUTH_ERRORS.INVALID_CLIENT,
        description: 'This application has been suspended',
        challenge,
      };
    }

    const registered = ClientPolicy.effective(client).tokenEndpointAuthMethod;

    // The endpoint's own floor: introspection refuses `none` however the client is
    // registered, because an unauthenticated introspection endpoint is a token oracle.
    if (!options.allowedMethods.includes(registered)) {
      return {
        ok: false,
        status: 401,
        error: OAUTH_ERRORS.INVALID_CLIENT,
        description: 'This endpoint requires an authenticated client',
        challenge,
      };
    }

    // A client authenticates the way it is registered to, and no other way.
    if (presented.method !== registered) {
      return {
        ok: false,
        status: 401,
        error: OAUTH_ERRORS.INVALID_CLIENT,
        description: 'Client authentication failed',
        challenge,
      };
    }

    if (registered !== TOKEN_ENDPOINT_AUTH_METHODS.NONE) {
      const okSecret = presented.clientSecret
        ? await clientService.verifyClientSecret(client, presented.clientSecret)
        : false;
      if (!okSecret) {
        return {
          ok: false,
          status: 401,
          error: OAUTH_ERRORS.INVALID_CLIENT,
          description: 'Client authentication failed',
          challenge,
        };
      }
    }

    return { ok: true, client, method: registered };
  },
};
