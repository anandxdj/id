import type { OAuthConnector, NormalizedProfile } from './types';
import { Config } from '../../../common/config/config';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

/**
 * Narrowing helpers, so no call site needs a non-null assertion. Split by what each
 * step actually requires: building the authorize URL needs only the public client id;
 * only the code exchange needs the secret.
 */
const requireClientId = (): string => {
  const { clientId } = Config.connectors.google;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured');
  return clientId;
};

const requireCredentials = (): { clientId: string; clientSecret: string } => {
  const { clientSecret } = Config.connectors.google;
  if (!clientSecret) throw new Error('GOOGLE_CLIENT_SECRET is not configured');
  return { clientId: requireClientId(), clientSecret };
};

export const googleConnector: OAuthConnector = {
  provider: 'google',
  displayName: 'Google',

  isConfigured() {
    const { clientId, clientSecret } = Config.connectors.google;
    return Boolean(clientId && clientSecret);
  },

  buildAuthorizeUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_id: requireClientId(),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchange(code, redirectUri): Promise<NormalizedProfile> {
    const { clientId, clientSecret } = requireCredentials();
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      throw new Error(`Google token exchange failed (${tokenRes.status})`);
    }
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) throw new Error('Google token response missing access_token');

    const profileRes = await fetch(USERINFO_URL, {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) throw new Error(`Google userinfo failed (${profileRes.status})`);
    const p = (await profileRes.json()) as {
      sub: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };

    return {
      provider: 'google',
      providerAccountId: p.sub,
      email: p.email,
      emailVerified: p.email_verified === true,
      name: p.name,
      picture: p.picture,
    };
  },
};
