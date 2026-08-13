import type { Request } from 'express';
import {
  OAUTH_ERRORS,
  TOKEN_ENDPOINT_AUTH_METHODS,
} from '../../common/constants/index.constants';
import type { OAuthErrorCode } from '../../common/constants/index.constants';
import { ClientCredentialsUtil } from '../../common/utils/clientCredentials.utils';
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

/**
 * Internal: classify what the caller presented. Extraction is `ClientCredentialsUtil`'s
 * job — shared with the token endpoint's rate limiter so the two cannot disagree about
 * which client a request claims to be — and everything added here is *policy*: which
 * method that material amounts to, and whether the combination is self-contradictory.
 */
const _presented = (req: Request): PresentedCredentials => {
  const raw = ClientCredentialsUtil.parse(req);

  if (raw.usedBasic) {
    if (raw.malformedBasic) {
      return {
        method: TOKEN_ENDPOINT_AUTH_METHODS.CLIENT_SECRET_BASIC,
        usedBasic: true,
        conflict: 'Malformed Basic credentials',
      };
    }

    const basic = {
      clientId: raw.clientId,
      method: TOKEN_ENDPOINT_AUTH_METHODS.CLIENT_SECRET_BASIC,
      usedBasic: true,
    };

    if (raw.bodySecret) {
      return { ...basic, conflict: 'More than one client authentication mechanism was used' };
    }
    if (raw.bodyClientId && raw.bodyClientId !== raw.clientId) {
      return { ...basic, conflict: 'client_id in the body contradicts the Authorization header' };
    }
    return { ...basic, clientSecret: raw.clientSecret };
  }

  return {
    clientId: raw.clientId,
    clientSecret: raw.clientSecret,
    method: raw.clientSecret
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
      const verified = presented.clientSecret
        ? await clientService.verifyClientSecret(client, presented.clientSecret)
        : { ok: false, needsUpgrade: false };

      // Lazy migration off bcrypt, exactly as M2 did for passwords: the plaintext is
      // only ever in hand during a successful authentication, so that is the only
      // moment the new digest can be computed. Awaited rather than fired and forgotten
      // — it is one indexed single-document update that happens once per client in the
      // system's lifetime, and awaiting keeps it observable and testable. A failure is
      // logged and ignored: the client authenticated correctly, and refusing it because
      // a housekeeping write failed would turn a migration into an outage.
      if (verified.ok && verified.needsUpgrade && presented.clientSecret) {
        await clientService.upgradeSecretDigest(
          client.clientId,
          client.clientSecretHash,
          presented.clientSecret,
        );
      }

      if (!verified.ok) {
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
