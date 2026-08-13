import {
  CLIENT_DEFAULTS,
  CLIENT_TYPES,
  TOKEN_ENDPOINT_AUTH_METHODS,
} from '../../common/constants/index.constants';
import { ScopeUtil } from './scope.util';
import type { IOAuthClient } from '../oauth-client/oauth-client.model';

/**
 * Per-client protocol policy: what a given client is allowed to ask for.
 *
 * Two jobs, and the second is the reason this is a module rather than four inline
 * checks.
 *
 *  1. **Normalisation.** Clients registered before M4 have no `scopes`, `grantTypes`,
 *     `responseTypes` or `tokenEndpointAuthMethod` at all — Mongoose defaults apply to
 *     new documents, not to rows already on disk. Reading a missing field as "no
 *     policy" would either lock every existing client out or wave every request
 *     through, depending on which way the comparison happened to be written. Every
 *     consumer goes through `effective()` instead, so the fallback is decided once.
 *
 *  2. **Rejecting rather than trimming.** A scope outside the allowlist is an error,
 *     not something to quietly drop. Silently narrowing hands the client a token it
 *     believes carries a permission it does not, and the resulting failure surfaces at
 *     some unrelated resource call much later.
 */

export interface EffectiveClientPolicy {
  clientId: string;
  scopes: string[];
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: string;
  postLogoutRedirectUris: string[];
  /** Public clients authenticate with `none` and rely entirely on PKCE. */
  isPublic: boolean;
  clientType: string;
}

type ClientLike = Pick<
  IOAuthClient,
  | 'clientId'
  | 'scopes'
  | 'grantTypes'
  | 'responseTypes'
  | 'tokenEndpointAuthMethod'
  | 'postLogoutRedirectUris'
  | 'redirectUris'
>;

// Internal: a stored array, or the registration default when the field predates M4.
const _orDefault = (value: unknown, fallback: readonly string[]): string[] =>
  Array.isArray(value) && value.length > 0 ? (value as string[]) : [...fallback];

export const ClientPolicy = {
  /** The policy actually in force for a client, defaults filled in. */
  effective(client: ClientLike): EffectiveClientPolicy {
    const tokenEndpointAuthMethod =
      typeof client.tokenEndpointAuthMethod === 'string' && client.tokenEndpointAuthMethod
        ? client.tokenEndpointAuthMethod
        : CLIENT_DEFAULTS.TOKEN_ENDPOINT_AUTH_METHOD;
    const isPublic = tokenEndpointAuthMethod === TOKEN_ENDPOINT_AUTH_METHODS.NONE;

    return {
      clientId: client.clientId,
      scopes: _orDefault(client.scopes, CLIENT_DEFAULTS.SCOPES),
      grantTypes: _orDefault(client.grantTypes, CLIENT_DEFAULTS.GRANT_TYPES),
      responseTypes: _orDefault(client.responseTypes, CLIENT_DEFAULTS.RESPONSE_TYPES),
      tokenEndpointAuthMethod,
      postLogoutRedirectUris: Array.isArray(client.postLogoutRedirectUris)
        ? client.postLogoutRedirectUris
        : [],
      isPublic,
      clientType: isPublic ? CLIENT_TYPES.PUBLIC : CLIENT_TYPES.CONFIDENTIAL,
    };
  },

  allowsResponseType(client: ClientLike, responseType: string): boolean {
    return this.effective(client).responseTypes.includes(responseType);
  },

  allowsGrantType(client: ClientLike, grantType: string): boolean {
    return this.effective(client).grantTypes.includes(grantType);
  },

  /** Requested scopes the client is not registered for. Empty means the request is fine. */
  disallowedScopes(client: ClientLike, requested: readonly string[]): string[] {
    return ScopeUtil.difference(requested, this.effective(client).scopes);
  },

  /**
   * Exact-match redirect URI check. No prefix matching and no wildcards: every open
   * redirector in OAuth's history started as a convenience on this comparison.
   */
  allowsRedirectUri(client: Pick<IOAuthClient, 'redirectUris'>, redirectUri: string): boolean {
    return Array.isArray(client.redirectUris) && client.redirectUris.includes(redirectUri);
  },

  /** Same discipline for RP-initiated logout, which is equally a redirect the server emits. */
  allowsPostLogoutRedirectUri(client: ClientLike, uri: string): boolean {
    return this.effective(client).postLogoutRedirectUris.includes(uri);
  },
};
