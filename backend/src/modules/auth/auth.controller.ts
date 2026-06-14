import type { Request, Response, CookieOptions } from 'express';
import { ApiResponse } from '../../common/utils/ApiResponse';
import { ApiError } from '../../common/utils/ApiError';
import { getOidcIssuer } from '../../common/utils/keys.utils';
import * as authService from './auth.service';
import * as events from '../events/event.service';
import { listEnabled, getEnabledConnector } from './connectors/registry';
import { saveOAuthState, consumeOAuthState, findOrCreateFromProfile } from './social.service';

const isProd = () => process.env.NODE_ENV === 'production';

const refreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProd(),
  sameSite: 'lax',
  path: '/',
  maxAge: authService.REFRESH_TTL_SECONDS * 1000,
});

export const register = async (req: Request, res: Response) => {
  const user = await authService.register(req.body);
  ApiResponse.created(res, 'Account created', { user });
};

export const login = async (req: Request, res: Response) => {
  let result;
  try {
    result = await authService.login(req.body);
  } catch (err) {
    events.record('login.fail', {
      ...events.reqContext(req),
      meta: { email: String(req.body?.email ?? '').toLowerCase().trim() },
    });
    throw err;
  }
  const { user, accessToken, refreshToken } = result;
  res.cookie('refreshToken', refreshToken, refreshCookieOptions());
  events.record('login.success', {
    actorUserId: user._id,
    actorRole: user.role,
    ...events.reqContext(req),
  });
  ApiResponse.ok(res, 'Logged in', { user, accessToken });
};

export const refreshToken = async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken as string | undefined;
  const { accessToken } = await authService.refresh(token);
  ApiResponse.ok(res, 'Token refreshed', { accessToken });
};

export const logout = async (req: Request, res: Response) => {
  if (req.user) {
    await authService.logout(req.user.id, req.user.sessionId);
    events.record('logout', {
      actorUserId: req.user.id,
      actorRole: req.user.role,
      ...events.reqContext(req),
    });
  }
  res.clearCookie('refreshToken', { path: '/' });
  res.clearCookie('accessToken', { path: '/' });
  ApiResponse.ok(res, 'Logged out');
};

export const getMe = async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Not authenticated');
  const user = await authService.getMe(req.user.id);
  ApiResponse.ok(res, 'Current user', user);
};

// ── Social connectors ─────────────────────────────────────────────────────────
const frontendBase = () => (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
const callbackUri = (provider: string) => `${getOidcIssuer()}/api/auth/oauth/${provider}/callback`;

/** List the enabled login connectors so the UI can render a button per provider. */
export const listConnectors = async (_req: Request, res: Response) => {
  ApiResponse.ok(
    res,
    'Enabled connectors',
    listEnabled().map((c) => ({ provider: c.provider, displayName: c.displayName })),
  );
};

/** Begin a social login: store CSRF state + return_to, redirect to the provider. */
export const oauthStart = async (req: Request, res: Response) => {
  const provider = req.params.provider!;
  const connector = getEnabledConnector(provider);
  if (!connector) throw ApiError.notFound(`Unknown or disabled provider: ${provider}`);

  const returnTo = typeof req.query.return_to === 'string' ? req.query.return_to : undefined;
  const state = await saveOAuthState(provider, returnTo);
  res.redirect(connector.buildAuthorizeUrl(state, callbackUri(provider)));
};

/** Provider redirects back here: verify state, exchange, find/create user, bridge to frontend. */
export const oauthCallback = async (req: Request, res: Response) => {
  const provider = req.params.provider!;
  const loginErrorRedirect = (reason: string) =>
    res.redirect(`${frontendBase()}/login?error=${encodeURIComponent(reason)}`);

  if (req.query.error) return loginErrorRedirect(String(req.query.error));

  const connector = getEnabledConnector(provider);
  if (!connector) throw ApiError.notFound(`Unknown or disabled provider: ${provider}`);

  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  if (!code) return loginErrorRedirect('missing_code');

  const parsed = await consumeOAuthState(state);
  if (!parsed || parsed.provider !== provider) return loginErrorRedirect('invalid_state');

  try {
    const profile = await connector.exchange(code, callbackUri(provider));
    const user = await findOrCreateFromProfile(profile);
    const { accessToken, refreshToken } = await authService.createSession(user);
    res.cookie('refreshToken', refreshToken, refreshCookieOptions());
    events.record('login.success', {
      actorUserId: user._id.toString(),
      actorRole: user.role,
      ...events.reqContext(req),
      meta: { provider },
    });

    // Bridge: token + return_to ride the URL fragment (never the query) so they stay
    // out of server/access logs. The frontend /callback page consumes them.
    const fragment = new URLSearchParams({ token: accessToken });
    if (parsed.returnTo) fragment.set('return_to', parsed.returnTo);
    res.redirect(`${frontendBase()}/callback#${fragment.toString()}`);
  } catch {
    return loginErrorRedirect('oauth_failed');
  }
};
