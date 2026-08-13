import type { Request, Response, CookieOptions } from 'express';
import { ApiResponse } from '../../common/utils/ApiResponse';
import { ApiError } from '../../common/utils/ApiError';
import { getOidcIssuer } from '../../common/utils/keys.utils';
import { Config } from '../../common/config/config';
import { EmailService } from '../../common/config/email';
import { DevOutbox, EmailTemplates } from '../../common/email/index.email';
import { Logger } from '../../common/logger/index.logger';
import {
  COOKIE_NAMES,
  COOKIE_SAME_SITE,
  ERROR_CODES,
  HTTP_STATUS,
  MILLISECONDS,
  SUCCESS_MESSAGES,
} from '../../common/constants/index.constants';
import * as authService from './auth.service';
import * as events from '../events/event.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import { listEnabled, getEnabledConnector } from './connectors/registry';
import { saveOAuthState, consumeOAuthState, findOrCreateFromProfile } from './social.service';

/**
 * Internal: keep an unexpected failure from describing itself to the caller.
 *
 * An `ApiError` is a deliberate, already-safe response and passes through untouched.
 * Anything else — a Mongo error, a driver assertion — is replaced with a generic
 * `INVALID_ACTION_TOKEN`, because on a public token-redemption endpoint the *shape* of an
 * unexpected error is itself a signal: it separates "this token resolved to something and
 * then something broke" from "this token was never real".
 */
const _sanitizeUnexpected = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;
  Logger.error('Unexpected failure on a token redemption path', { error });
  return ApiError.fromCode(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.INVALID_ACTION_TOKEN);
};

/**
 * `expiresAt` is passed on every rotation so the cookie's lifetime tracks the family's
 * **absolute** window rather than being reset to a full session length each time. Without
 * it the cookie would outlive the token inside it, and a client would keep presenting a
 * credential the server had already stopped honouring.
 */
const refreshCookieOptions = (expiresAt?: Date): CookieOptions => ({
  httpOnly: true,
  // Driven by COOKIE_SECURE, which the config layer forces to `true` in production.
  // Inferring it from NODE_ENV breaks HTTPS-terminating dev proxies and silently
  // ships an insecure cookie whenever NODE_ENV is anything unexpected.
  secure: Config.cookie.secure,
  sameSite: COOKIE_SAME_SITE,
  path: '/',
  ...(Config.cookie.domain ? { domain: Config.cookie.domain } : {}),
  maxAge: expiresAt
    ? Math.max(0, expiresAt.getTime() - Date.now())
    : authService.REFRESH_TTL_SECONDS * MILLISECONDS.SECOND,
});

/**
 * Register.
 *
 * **The response is byte-identical whether or not the address already has an account.**
 * Same status, same message, same `data`. A 409 on the taken branch — which is what this
 * endpoint used to return, and what the reference still returns — is a working
 * account-existence oracle that needs no cleverness to exploit: submit an address, read the
 * status code.
 *
 * The difference surfaces where it belongs, in an email to the mailbox owner: a verification
 * link for a new account, or a "someone tried to register your address" notice for an
 * existing one. Both are dispatched fire-and-forget after the durable write, so the response
 * time does not separate the branches either.
 *
 * No `user` object comes back any more, because there is nothing to return on the taken
 * branch and a shape that varies is the same oracle in a different coat.
 */
export const register = async (req: Request, res: Response) => {
  // The write itself is allowed to fail loudly: a user told "check your email" whose
  // account was never created is a worse outcome than a 500.
  const outcome = await authService.register(req.body);

  try {
    if (outcome.created && outcome.user) {
      await EmailVerificationService.issueForNewUser(outcome.user, events.reqContext(req));
      events.record('register', {
        actorUserId: outcome.user._id.toString(),
        actorRole: outcome.user.role,
        ...events.reqContext(req),
      });
    } else if (outcome.existing) {
      EmailService.dispatch({
        to: outcome.existing.email,
        ...EmailTemplates.alreadyRegistered({ name: outcome.existing.name }),
      });
    }
  } catch (error) {
    // Everything above is post-persist side effects. Letting one of them turn into a 500
    // would reintroduce the oracle through the error path — a failure on the "account
    // created" branch answering 500 while the "already exists" branch answers 201 — and it
    // would report failure for an account that does exist. The resend endpoint is the
    // recovery path for a verification mail that never went out.
    Logger.error('Post-registration side effects failed', { error });
  }

  ApiResponse.created(res, SUCCESS_MESSAGES.REGISTERED, null);
};

/** Redeem an email-verification token. Does not sign the user in — see the service. */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    await EmailVerificationService.verify(req.body.token, events.reqContext(req));
    ApiResponse.ok(res, SUCCESS_MESSAGES.EMAIL_VERIFIED);
  } catch (error) {
    throw _sanitizeUnexpected(error);
  }
};

/**
 * Re-issue a verification link. Answers identically for an unknown address, an already
 * verified one, and a suspended account — see `EmailVerificationService.resend`.
 */
export const resendVerification = async (req: Request, res: Response) => {
  try {
    await EmailVerificationService.resend(req.body.email, events.reqContext(req));
  } catch (error) {
    // Answer 200 anyway. This endpoint's entire contract is that its response carries no
    // information about the address, and a 500 on the "address exists" branch would carry
    // exactly that.
    Logger.error('Verification resend failed', { error });
  }
  ApiResponse.ok(res, SUCCESS_MESSAGES.VERIFICATION_SENT);
};

/** Begin a password reset. Identical response for every address, including on failure. */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    await PasswordResetService.request(req.body.email, events.reqContext(req));
  } catch (error) {
    Logger.error('Password reset request failed', { error });
  }
  ApiResponse.ok(res, SUCCESS_MESSAGES.PASSWORD_RESET_SENT);
};

/** Complete a password reset. Revokes every session and access token the account holds. */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    await PasswordResetService.reset(req.body, events.reqContext(req));
    ApiResponse.ok(res, SUCCESS_MESSAGES.PASSWORD_RESET);
  } catch (error) {
    throw _sanitizeUnexpected(error);
  }
};

/**
 * Development-only: read the mail this process suppressed because no provider is configured.
 *
 * This is the legitimate path to a verification link on a local machine. The alternative the
 * reference chose — logging the HTML body — puts a working link for every account into the
 * log pipeline (§2.3-14), which our logger's key-pattern redaction cannot help with, since a
 * token interpolated into a message string is just a string.
 *
 * `DevOutbox.enabled` is false in production *and* false whenever a provider is configured,
 * so the route is mounted only when both hold and returns nothing if state changes under it.
 * The buffer is in-memory and dies with the process.
 */
export const devOutbox = async (req: Request, res: Response) => {
  try {
    if (!DevOutbox.enabled) throw ApiError.notFound(`Route ${req.originalUrl} not found`);
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    Logger.warn('Development outbox read', { to });
    ApiResponse.ok(res, 'Suppressed messages', DevOutbox.list(to));
  } catch (error) {
    throw error;
  }
};

export const login = async (req: Request, res: Response) => {
  let result;
  try {
    result = await authService.login(req.body, events.reqContext(req));
  } catch (err) {
    events.record('login.fail', {
      ...events.reqContext(req),
      meta: { email: String(req.body?.email ?? '').toLowerCase().trim() },
    });
    throw err;
  }
  const { user, accessToken, refreshToken, refreshExpiresAt } = result;
  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, refreshCookieOptions(refreshExpiresAt));
  events.record('login.success', {
    actorUserId: user._id,
    actorRole: user.role,
    ...events.reqContext(req),
  });
  ApiResponse.ok(res, 'Logged in', { user, accessToken });
};

/**
 * Rotate the refresh token and hand back a fresh access token.
 *
 * The refresh cookie is **replaced** on every call now that tokens rotate: the presented
 * one is spent, and leaving it in the browser would guarantee that the client's next
 * refresh trips reuse detection on a token it was never told to stop using.
 *
 * On failure the cookie is cleared instead. A client holding a token that has been
 * revoked — or that just got its whole family killed — should stop presenting it rather
 * than retry into the same wall, and a dead cookie is the only way to say so over a
 * response the frontend may not be reading closely.
 */
export const refreshToken = async (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] as string | undefined;
  try {
    const result = await authService.refresh(token, events.reqContext(req));
    res.cookie(
      COOKIE_NAMES.REFRESH_TOKEN,
      result.refreshToken,
      refreshCookieOptions(result.refreshExpiresAt),
    );
    ApiResponse.ok(res, SUCCESS_MESSAGES.TOKEN_REFRESHED, { accessToken: result.accessToken });
  } catch (error) {
    // A retriable in-flight collision is not a dead credential — the client still holds a
    // token that will work on the next attempt, so leave the cookie alone.
    const retriable =
      error instanceof ApiError && error.code === ERROR_CODES.REFRESH_IN_FLIGHT;
    if (!retriable) {
      res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { path: '/' });
      res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, { path: '/' });
    }
    throw error;
  }
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
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { path: '/' });
  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, { path: '/' });
  ApiResponse.ok(res, SUCCESS_MESSAGES.LOGGED_OUT);
};

export const getMe = async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Not authenticated');
  const user = await authService.getMe(req.user.id);
  ApiResponse.ok(res, 'Current user', user);
};

// ── Social connectors ─────────────────────────────────────────────────────────
const frontendBase = () => Config.web.loginRedirectBase;
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
    const { accessToken, refreshToken, refreshExpiresAt } = await authService.createSession(
      user,
      events.reqContext(req),
    );
    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, refreshCookieOptions(refreshExpiresAt));
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
