import { AppConfig } from './config';

const P = AppConfig.apiPrefix;

/** Backend paths the SPA calls. Versioned; the unversioned aliases are a backend concern. */
export const API_PATHS = {
  LOGIN: `${P}/auth/login`,
  REGISTER: `${P}/auth/register`,
  REFRESH: `${P}/auth/refresh-token`,
  ME: `${P}/auth/me`,
  LOGOUT: `${P}/auth/logout`,
  VERIFY_EMAIL: `${P}/auth/verify-email`,
  RESEND_VERIFICATION: `${P}/auth/resend-verification`,
  FORGOT_PASSWORD: `${P}/auth/forgot-password`,
  RESET_PASSWORD: `${P}/auth/reset-password`,
  CONNECTORS: `${P}/auth/connectors`,
  oauthStart: (provider: string) => `${P}/auth/oauth/${provider}`,
  CONSENT_CONTEXT: `${P}/oauth/consent/context`,
  CONSENT: `${P}/oauth/consent`,
  ACCOUNT: `${P}/me`,
  APPS: `${P}/me/apps`,
  app: (clientId: string) => `${P}/me/apps/${encodeURIComponent(clientId)}`,
  SESSIONS: `${P}/me/sessions`,
  session: (sid: string) => `${P}/me/sessions/${encodeURIComponent(sid)}`,
  REVOKE_ALL_SESSIONS: `${P}/me/sessions/revoke-all`,
  PROFILE: `${P}/me/profile`,
  ADMIN_USERS: `${P}/admin/users`,
  adminUser: (id: string) => `${P}/admin/users/${id}`,
  ADMIN_METRICS: `${P}/admin/metrics`,
  ADMIN_ACTIVITY: `${P}/admin/activity`,
  ADMIN_CLIENTS: `${P}/admin/clients`,
  adminClient: (clientId: string) => `${P}/admin/clients/${clientId}`,
} as const;

/** App-router paths. Keep in lockstep with backend `FRONTEND_PATHS` — emailed links land here. */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  VERIFY_EMAIL: '/verify-email',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  ACCOUNT: '/account',
  ADMIN: '/admin',
} as const;

export const AUTH_COPY = {
  CONFIRM_DELETE: 'DELETE',
  PASSWORD_MIN_LENGTH: 8,
  CHECK_EMAIL: 'Check your email for a confirmation link. You can sign in once the address is verified.',
  FORGOT_SENT: 'If an account exists for that address, a reset link is on its way.',
  VERIFY_OK: 'Email confirmed. You can sign in now.',
  RESET_OK: 'Password updated. Sign in with your new password.',
  MISSING_TOKEN: 'This link is missing its token. Request a new one.',
  DELETE_OK: 'Your account has been closed and every session ended.',
} as const;

/**
 * OAuth `error` query values → copy the user can act on. Unknown codes stay generic
 * so a new authorize error does not become a raw protocol string on the login card.
 */
export const OAUTH_ERROR_COPY: Record<string, string> = {
  access_denied: 'Access was denied. You can try again, or pick a different account.',
  login_required: 'Please sign in to continue.',
  consent_required: 'This application needs your approval before it can continue.',
  interaction_required: 'Please sign in again to continue.',
  invalid_request: 'That sign-in request was malformed. Start again from the application.',
  unauthorized_client: 'This application is not allowed to sign users in.',
  server_error: 'The identity service hit a problem. Try again in a moment.',
  temporarily_unavailable: 'The identity service is briefly unavailable. Try again shortly.',
  invalid_scope: 'This application asked for access it is not registered for.',
  missing_token: 'The sign-in callback did not include a session. Please sign in again.',
  account_disabled: 'This account is not available.',
};
