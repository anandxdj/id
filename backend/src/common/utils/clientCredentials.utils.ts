import type { Request } from 'express';
import { BASIC_PREFIX } from '../constants/index.constants';

/**
 * What a request presented as client credentials — the raw material, with no judgement
 * about whether it is acceptable.
 */
export interface PresentedClientCredentials {
  /** `client_id`, from the Authorization header if present, otherwise the body. */
  clientId?: string;
  clientSecret?: string;
  /** A `Basic` Authorization header was present, whether or not it parsed. */
  usedBasic: boolean;
  /** The header was present but not decodable as RFC 6749 §2.3.1 Basic credentials. */
  malformedBasic: boolean;
  /** Set independently of `clientId`, so a caller can detect the two contradicting. */
  bodyClientId?: string;
  bodySecret?: string;
}

/**
 * Extraction of presented client credentials, shared by everything that needs to know
 * who is calling a client-authenticated endpoint.
 *
 * This lives in `common` rather than in the OAuth module because the token endpoint's
 * rate limiter needs the same answer as the authentication service does, and the two
 * disagreeing would be a bug in both directions: a limiter that reads the `client_id`
 * differently from the authenticator buckets requests under a key that has nothing to do
 * with the caller the authenticator will decide it is talking to.
 *
 * Deliberately *not* here: whether the presented combination is a legal authentication
 * method for the client, and whether the secret is correct. Detection and policy stay
 * apart — that separation is what makes "you used client_secret_post but you are
 * registered for client_secret_basic" expressible at all.
 */

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

export const ClientCredentialsUtil = {
  parse(req: Request): PresentedClientCredentials {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const bodyClientId = _asString(body.client_id);
    const bodySecret = _asString(body.client_secret);

    const header = req.headers.authorization;
    if (!header?.startsWith(BASIC_PREFIX)) {
      return {
        clientId: bodyClientId,
        clientSecret: bodySecret,
        usedBasic: false,
        malformedBasic: false,
        bodyClientId,
        bodySecret,
      };
    }

    const decoded = Buffer.from(header.slice(BASIC_PREFIX.length), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    const basicId = separator < 0 ? null : _formDecode(decoded.slice(0, separator));
    const basicSecret = separator < 0 ? null : _formDecode(decoded.slice(separator + 1));

    if (basicId === null || basicSecret === null) {
      return { usedBasic: true, malformedBasic: true, bodyClientId, bodySecret };
    }

    return {
      clientId: basicId,
      clientSecret: basicSecret,
      usedBasic: true,
      malformedBasic: false,
      bodyClientId,
      bodySecret,
    };
  },

  /**
   * Just the `client_id`, for callers that only need to bucket a request by it.
   *
   * Returns whatever the caller *claimed*, with no existence check — see the keying
   * comment in the rate-limit middleware for why validating it here would be the bug
   * rather than the feature.
   */
  presentedClientId(req: Request): string | undefined {
    try {
      return this.parse(req).clientId;
    } catch {
      // Nothing in `parse` should throw, but it runs inside a rate-limiter key
      // generator: an exception there would fail the request closed, turning a
      // malformed header into a denial of service.
      return undefined;
    }
  },
};
