import type { OAuthConnector, NormalizedProfile } from './types';

const AUTH_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_URL = 'https://api.github.com/user';
const EMAILS_URL = 'https://api.github.com/user/emails';

export const githubConnector: OAuthConnector = {
  provider: 'github',
  displayName: 'GitHub',

  isConfigured() {
    return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  },

  buildAuthorizeUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state,
      allow_signup: 'true',
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchange(code, redirectUri): Promise<NormalizedProfile> {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GITHUB_CLIENT_ID!,
        client_secret: process.env.GITHUB_CLIENT_SECRET!,
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
