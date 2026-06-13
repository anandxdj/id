/** Provider-agnostic profile produced by every connector after exchanging a code. */
export interface NormalizedProfile {
  provider: string;
  providerAccountId: string; // stable subject id at the provider
  email?: string;
  emailVerified: boolean; // whether the provider asserts the email is verified
  name?: string;
  picture?: string;
}

/**
 * An OAuth/OIDC login connector. Implementations are stateless; the registry decides
 * which are enabled. `isConfigured()` gates a connector on its credentials being present.
 */
export interface OAuthConnector {
  readonly provider: string;
  readonly displayName: string;
  isConfigured(): boolean;
  /** Build the provider's authorization URL to redirect the user to. */
  buildAuthorizeUrl(state: string, redirectUri: string): string;
  /** Exchange the returned code for a normalized profile. */
  exchange(code: string, redirectUri: string): Promise<NormalizedProfile>;
}
