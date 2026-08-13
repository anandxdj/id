import type { OAuthConnector, NormalizedProfile } from './types';
import { Config } from '../../../common/config/config';

const AUTH_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_URL = 'https://api.github.com/user';
const EMAILS_URL = 'https://api.github.com/user/emails';

/**
 * Narrowing helpers, so no call site needs a non-null assertion. Split by what each
 * step actually requires: building the authorize URL needs only the public client id;
 * only the code exchange needs the secret.
 */
const requireClientId = (): string => {
  const { clientId } = Config.connectors.github;
  if (!clientId) throw new Error('GITHUB_CLIENT_ID is not configured');
  return clientId;
};

const requireCredentials = (): { clientId: string; clientSecret: string } => {
  const { clientSecret } = Config.connectors.github;
  if (!clientSecret) throw new Error('GITHUB_CLIENT_SECRET is not configured');
  return { clientId: requireClientId(), clientSecret };
};

export const githubConnector: OAuthConnector = {
  provider: 'github',
  displayName: 'GitHub',

  isConfigured() {
    const { clientId, clientSecret } = Config.connectors.github;
    return Boolean(clientId && clientSecret);
  },

  buildAuthorizeUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_id: requireClientId(),
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state,
      allow_signup: 'true',
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchange(code, redirectUri): Promise<NormalizedProfile> {
    const { clientId, clientSecret } = requireCredentials();
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) throw new Error(`GitHub token exchange failed (${tokenRes.status})`);
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) throw new Error('GitHub token response missing access_token');

    const headers = {
      authorization: `Bearer ${tokens.access_token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'id-oidc-provider',
    };

    const userRes = await fetch(USER_URL, { headers });
    if (!userRes.ok) throw new Error(`GitHub user fetch failed (${userRes.status})`);
    const u = (await userRes.json()) as { id: number; name?: string; login: string; avatar_url?: string };

    // GitHub omits private emails from /user; the verified primary lives in /user/emails.
    let email: string | undefined;
    let emailVerified = false;
    const emailRes = await fetch(EMAILS_URL, { headers });
    if (emailRes.ok) {
      const emails = (await emailRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
      const primary = emails.find((e) => e.primary) ?? emails.find((e) => e.verified) ?? emails[0];
      if (primary) {
        email = primary.email;
        emailVerified = primary.verified === true;
      }
    }

    return {
      provider: 'github',
      providerAccountId: String(u.id),
      email,
      emailVerified,
      name: u.name || u.login,
      picture: u.avatar_url,
    };
  },
};
