import type { Request, Response } from 'express';
import { getOidcIssuer } from '../../common/utils/keys.utils';
import {
  CODE_CHALLENGE_METHODS,
  CRYPTO,
  DISCOVERY_CACHE_CONTROL,
  INTROSPECTION_AUTH_METHODS,
  OIDC_ENDPOINT_PATHS,
  RESPONSE_MODES,
  REVOCATION_AUTH_METHODS,
  SUBJECT_TYPES,
  SUPPORTED_CLAIMS,
  SUPPORTED_GRANT_TYPES,
  SUPPORTED_PROMPTS,
  SUPPORTED_RESPONSE_TYPES,
  SUPPORTED_SCOPES,
  SUPPORTED_TOKEN_ENDPOINT_AUTH_METHODS,
} from '../../common/constants/index.constants';
import { SigningKeyService } from './signing-key.service';

/**
 * OpenID Provider metadata (RFC 8414 / OIDC Discovery 1.0).
 *
 * A discovery document is a **promise**, and every value here is now derived from the
 * same constants the enforcement paths read, so it cannot drift away from what the
 * server actually does. Before M4 it made three false statements:
 *
 *  1. **`grant_types_supported` was absent.** RFC 8414 §2 gives that omission a
 *     meaning: it defaults to `["authorization_code", "implicit"]`. This server does
 *     not implement implicit, must not implement implicit, and was nevertheless
 *     advertising it to every conforming client that read the document — an invitation
 *     to attempt a flow that returns tokens in a URL fragment.
 *  2. **`token_endpoint_auth_methods_supported` omitted `none`**, so public clients had
 *     no way to discover that they are supported. It is enumerated now.
 *  3. **The revocation, introspection and end-session endpoints did not exist**, so
 *     clients had no way to find them and no reason to believe tokens could be revoked.
 *
 * `claims_supported` also gains `auth_time`, which is only honest now that it is
 * actually emitted.
 */
const endpoint = (issuer: string, path: string): string =>
  `${issuer}${OIDC_ENDPOINT_PATHS.BASE}${path}`;

export const getOpenIdConfiguration = (_req: Request, res: Response) => {
  const iss = getOidcIssuer();
  res.set('Cache-Control', DISCOVERY_CACHE_CONTROL);
  res.json({
    issuer: iss,
    authorization_endpoint: endpoint(iss, OIDC_ENDPOINT_PATHS.AUTHORIZE),
    token_endpoint: endpoint(iss, OIDC_ENDPOINT_PATHS.TOKEN),
    userinfo_endpoint: endpoint(iss, OIDC_ENDPOINT_PATHS.USERINFO),
    jwks_uri: endpoint(iss, OIDC_ENDPOINT_PATHS.JWKS),
    revocation_endpoint: endpoint(iss, OIDC_ENDPOINT_PATHS.REVOKE),
    introspection_endpoint: endpoint(iss, OIDC_ENDPOINT_PATHS.INTROSPECT),
    end_session_endpoint: endpoint(iss, OIDC_ENDPOINT_PATHS.END_SESSION),

    scopes_supported: SUPPORTED_SCOPES,
    response_types_supported: SUPPORTED_RESPONSE_TYPES,
    response_modes_supported: RESPONSE_MODES,
    // The single most consequential line in this document: its absence advertised
    // implicit. See the block comment above.
    grant_types_supported: SUPPORTED_GRANT_TYPES,
    subject_types_supported: SUBJECT_TYPES,
    id_token_signing_alg_values_supported: [CRYPTO.SIGNING_ALG],
    code_challenge_methods_supported: [CODE_CHALLENGE_METHODS.S256],
    token_endpoint_auth_methods_supported: SUPPORTED_TOKEN_ENDPOINT_AUTH_METHODS,
    revocation_endpoint_auth_methods_supported: REVOCATION_AUTH_METHODS,
    introspection_endpoint_auth_methods_supported: INTROSPECTION_AUTH_METHODS,
    prompt_values_supported: SUPPORTED_PROMPTS,
    claims_supported: SUPPORTED_CLAIMS,

    // Stated explicitly rather than omitted. Each of these defaults to `false` when
    // absent, so saying so changes nothing functionally — but a client integrating
    // against this server should not have to infer capability from silence.
    claims_parameter_supported: false,
    request_parameter_supported: false,
    request_uri_parameter_supported: false,
    require_request_uri_registration: false,
  });
};

/**
 * JWKS: ACTIVE, NEXT, and every RETIRED key still inside its overlap window.
 *
 * A pure read. The reference triggers a write-path key-sync on every unauthenticated
 * request to this endpoint, which is both a denial-of-service lever and the mechanism
 * by which its keyring freezes permanently after the first hit.
 */
export const getJwks = (_req: Request, res: Response) => {
  res.set('Cache-Control', DISCOVERY_CACHE_CONTROL);
  res.json(SigningKeyService.jwks());
};
