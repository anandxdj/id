import type { Request, Response } from 'express';
import { ApiError } from '../../common/utils/ApiError';
import { Config } from '../../common/config/config';
import { getOidcIssuer } from '../../common/utils/keys.utils';
import { randomBase64Url, verifyPkce } from '../../common/utils/crypto.utils';
import {
  CODE_CHALLENGE_METHODS,
  CODE_REDEMPTION,
  CRYPTO,
  GRANT_ID_PREFIX,
  GRANT_TYPES,
  LOGIN_HINT_PARAMS,
  MAX_AGE_LEEWAY_SECONDS,
  NO_STORE_HEADERS,
  OAUTH_ERRORS,
  OAUTH_TRANSACTION_ID_PREFIX,
  OIDC_PROMPTS,
  OIDC_SCOPES,
  REVOKE_REASONS,
  RESPONSE_TYPES,
  SUPPORTED_PROMPTS,
  SUPPORTED_TOKEN_ENDPOINT_AUTH_METHODS,
  TOKEN_TYPE_BEARER,
  TTL_SECONDS,
} from '../../common/constants/index.constants';
import type { OAuthErrorCode } from '../../common/constants/index.constants';
import { Logger } from '../../common/logger/index.logger';
import * as clientService from '../oauth-client/oauth-client.service';
import * as events from '../events/event.service';
import { findActiveSession } from '../auth/auth.service';
import User from '../auth/auth.model';
import Consent from './consent.model';
import { AuthRequestStore } from './auth-request.store';
import { AuthCodeStore } from './auth-code.store';
import { AccessTokenStore } from './access-token.store';
import { ClientAuthService } from './client-auth.service';
import { ClientPolicy } from './client-policy.service';
import { ConsentGrantService } from './consent-grant.service';
import { OidcTokenService } from './oidc-token.service';
import { ScopeUtil } from './scope.util';
import type { IOAuthAuthCode } from './oauth-auth-code.model';
import type { IOAuthClient } from '../oauth-client/oauth-client.model';

const ACCESS_TOKEN_SECONDS = TTL_SECONDS.ACCESS_TOKEN;

const loginBase = () => Config.web.loginRedirectBase;

const consentBase = () => Config.web.consentRedirectBase;

/** A query parameter may arrive repeated; take the first and ignore the rest. */
const _one = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
};

const buildRedirectUrl = (
  redirectUri: string,
  params: Record<string, string | undefined>,
): string => {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  return u.toString();
};

// ── Authorize ────────────────────────────────────────────────────────────────

interface RawAuthorizeParams {
  clientId?: string;
  redirectUri?: string;
  responseType?: string;
  scope?: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod: string;
  nonce?: string;
  prompt?: string;
  maxAge?: string;
}

/**
 * Outcomes of an authorization request.
 *
 * The split between `render_error` and `error_redirect` is the whole point of the type.
 * RFC 6749 §4.1.2.1: when the `redirect_uri` is missing or unregistered, or the
 * `client_id` is unknown, the server MUST NOT redirect — doing so would turn the
 * authorization endpoint into an open redirector. For every *other* error it MUST
 * redirect, because a conforming client is waiting at its callback and cannot parse a
 * JSON body it never receives. Returning JSON for a bad `scope`, as this server did
 * before M4, simply hangs the client.
 */
type AuthorizeOutcome =
  | { type: 'render_error'; status: number; error: OAuthErrorCode; desc: string }
  | {
      type: 'error_redirect';
      redirectUri: string;
      state?: string;
      error: OAuthErrorCode;
      desc: string;
    }
  | { type: 'login_redirect'; location: string }
  | { type: 'consent_redirect'; transactionId: string }
  | { type: 'code'; redirectUri: string; state: string; code: string };

const _rawParams = (q: Request['query']): RawAuthorizeParams => ({
  clientId: _one(q.client_id)?.trim(),
  redirectUri: _one(q.redirect_uri),
  responseType: _one(q.response_type),
  scope: _one(q.scope),
  state: _one(q.state),
  codeChallenge: _one(q.code_challenge),
  codeChallengeMethod: _one(q.code_challenge_method) ?? CODE_CHALLENGE_METHODS.S256,
  nonce: _one(q.nonce),
  prompt: _one(q.prompt),
  maxAge: _one(q.max_age),
});

/**
 * Internal: where to send an unauthenticated (or insufficiently recent) user.
 *
 * `prompt` is stripped from `return_to`. Leaving it in place would re-enter authorize
 * with `prompt=login` still set the moment the user comes back, forever. The intent is
 * instead handed to the sign-in page as its own parameter, so the page knows to demand
 * credentials while the resumed authorize request is an ordinary one. `max_age` stays,
 * because a genuinely fresh authentication satisfies it.
 */
const _loginLocation = (req: Request, forceLogin: boolean): string => {
  const original = new URL(`${getOidcIssuer()}${req.originalUrl}`);
  original.searchParams.delete(LOGIN_HINT_PARAMS.PROMPT);

  const login = new URL(`${loginBase()}/login`);
  login.searchParams.set(LOGIN_HINT_PARAMS.RETURN_TO, original.toString());
  if (forceLogin) login.searchParams.set(LOGIN_HINT_PARAMS.PROMPT, OIDC_PROMPTS.LOGIN);
  return login.toString();
};

/** Internal: mint an authorization code for an already-decided grant. */
const _issueAuthCode = async (input: {
  userId: string;
  clientId: string;
  redirectUri: string;
  /** Granted scope, already intersected. Never the raw request. */
  scope: string;
  codeChallenge: string;
  nonce?: string;
  authTime: Date;
}): Promise<string> => {
  const code = randomBase64Url(CRYPTO.TOKEN_BYTES.AUTH_CODE);
  const grantId = `${GRANT_ID_PREFIX}${randomBase64Url(CRYPTO.TOKEN_BYTES.GRANT_ID).replace(
    /[^a-zA-Z0-9_-]/g,
    '',
  )}`;
  // Only the hash is persisted; the raw code exists solely in the redirect we emit.
  await AuthCodeStore.create({
    code,
    userId: input.userId,
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: CODE_CHALLENGE_METHODS.S256,
    scope: input.scope,
    nonce: input.nonce,
    grantId,
    authTime: input.authTime,
  });
  return code;
};

/**
 * Resolve an authorization request into exactly one outcome.
 *
 * Ordering is deliberate and load-bearing: nothing is validated in a way that could
 * produce a redirect until the `client_id` has been resolved and the `redirect_uri`
 * confirmed against its registration.
 */
export const getAuthorize = async (req: Request): Promise<AuthorizeOutcome> => {
  const p = _rawParams(req.query);

  // ── Phase 1: errors that must be rendered, never redirected ────────────────
  if (!p.clientId) {
    return {
      type: 'render_error',
      status: 400,
      error: OAUTH_ERRORS.INVALID_REQUEST,
      desc: 'client_id is required',
    };
  }

  const client = await clientService.findByClientId(p.clientId);
  if (!client) {
    return {
      type: 'render_error',
      status: 400,
      error: OAUTH_ERRORS.INVALID_CLIENT,
      desc: 'Unknown client_id',
    };
  }
  if (!p.redirectUri || !ClientPolicy.allowsRedirectUri(client, p.redirectUri)) {
    return {
      type: 'render_error',
      status: 400,
      error: OAUTH_ERRORS.INVALID_REQUEST,
      desc: 'redirect_uri is missing or not registered for this client',
    };
  }

  // ── Phase 2: the redirect_uri is trustworthy, so every error goes back to it ─
  const redirectUri = p.redirectUri;
  const state = p.state;
  const fail = (error: OAuthErrorCode, desc: string): AuthorizeOutcome => ({
    type: 'error_redirect',
    redirectUri,
    state,
    error,
    desc,
  });

  if (client.suspended) {
    return fail(OAUTH_ERRORS.ACCESS_DENIED, 'This application has been suspended');
  }

  const responseType = p.responseType ?? '';
  if (responseType !== RESPONSE_TYPES.CODE || !ClientPolicy.allowsResponseType(client, responseType)) {
    return fail(
      OAUTH_ERRORS.UNSUPPORTED_RESPONSE_TYPE,
      `response_type must be one of: ${ClientPolicy.effective(client).responseTypes.join(', ')}`,
    );
  }
  if (!ClientPolicy.allowsGrantType(client, GRANT_TYPES.AUTHORIZATION_CODE)) {
    return fail(
      OAUTH_ERRORS.UNAUTHORIZED_CLIENT,
      'This client is not registered for the authorization_code grant',
    );
  }

  // PKCE is mandatory for every client, public or confidential — it is the only thing
  // standing between a public client and code interception.
  if (!p.codeChallenge) {
    return fail(OAUTH_ERRORS.INVALID_REQUEST, 'code_challenge is required');
  }
  if (p.codeChallengeMethod !== CODE_CHALLENGE_METHODS.S256) {
    return fail(
      OAUTH_ERRORS.INVALID_REQUEST,
      `Only code_challenge_method ${CODE_CHALLENGE_METHODS.S256} is supported`,
    );
  }
  if (!state) {
    return fail(OAUTH_ERRORS.INVALID_REQUEST, 'state is required');
  }

  const requested = ScopeUtil.parse(p.scope);
  if (!requested.includes(OIDC_SCOPES.OPENID)) {
    return fail(OAUTH_ERRORS.INVALID_SCOPE, `scope must include ${OIDC_SCOPES.OPENID}`);
  }
  const disallowed = ClientPolicy.disallowedScopes(client, requested);
  if (disallowed.length > 0) {
    // Rejected, not trimmed: see `client-policy.service.ts`.
    return fail(
      OAUTH_ERRORS.INVALID_SCOPE,
      `This client is not registered for: ${disallowed.join(', ')}`,
    );
  }

  const prompts = ScopeUtil.parse(p.prompt);
  if (prompts.some((value) => !SUPPORTED_PROMPTS.includes(value))) {
    return fail(OAUTH_ERRORS.INVALID_REQUEST, `Unsupported prompt value`);
  }
  if (prompts.includes(OIDC_PROMPTS.NONE) && prompts.length > 1) {
    return fail(
      OAUTH_ERRORS.INVALID_REQUEST,
      `prompt=${OIDC_PROMPTS.NONE} cannot be combined with other values`,
    );
  }
  const promptNone = prompts.includes(OIDC_PROMPTS.NONE);

  let maxAge: number | undefined;
  if (p.maxAge !== undefined) {
    maxAge = Number(p.maxAge);
    if (!Number.isInteger(maxAge) || maxAge < 0) {
      return fail(OAUTH_ERRORS.INVALID_REQUEST, 'max_age must be a non-negative integer');
    }
  }

  // ── Authentication ─────────────────────────────────────────────────────────
  // `findActiveSession` is what supplies `auth_time`: the moment the end user actually
  // authenticated, which is not the moment this request arrived.
  const session = req.user ? await findActiveSession(req.user.id, req.user.sessionId) : null;
  if (!req.user || !session) {
    return promptNone
      ? fail(OAUTH_ERRORS.LOGIN_REQUIRED, 'Authentication is required and prompt=none was set')
      : { type: 'login_redirect', location: _loginLocation(req, false) };
  }

  const authTime = session.createdAt;
  const authAgeSeconds = (Date.now() - authTime.getTime()) / 1_000;
  const staleAuth = maxAge !== undefined && authAgeSeconds > maxAge + MAX_AGE_LEEWAY_SECONDS;

  if (prompts.includes(OIDC_PROMPTS.LOGIN) || staleAuth) {
    return promptNone
      ? fail(
          OAUTH_ERRORS.LOGIN_REQUIRED,
          'Re-authentication is required and prompt=none was set',
        )
      : { type: 'login_redirect', location: _loginLocation(req, true) };
  }

  // ── Consent ────────────────────────────────────────────────────────────────
  const granted = await ConsentGrantService.grantedScopes(req.user.id, client.clientId);
  const needsConsent =
    prompts.includes(OIDC_PROMPTS.CONSENT) || !ScopeUtil.covers(granted, requested);

  if (needsConsent) {
    if (promptNone) {
      return fail(
        OAUTH_ERRORS.CONSENT_REQUIRED,
        'The requested scope exceeds the existing grant and prompt=none was set',
      );
    }
    const transactionId = `${OAUTH_TRANSACTION_ID_PREFIX}${randomBase64Url(
      CRYPTO.TOKEN_BYTES.TRANSACTION_ID,
    ).replace(/[^a-zA-Z0-9_-]/g, '')}`;
    // Calls out to the auth-request store (TTL-indexed Mongo, scoped by user).
    await AuthRequestStore.create({
      transactionId,
      userId: req.user.id,
      clientId: client.clientId,
      redirectUri,
      scope: ScopeUtil.format(requested),
      state,
      codeChallenge: p.codeChallenge,
      codeChallengeMethod: CODE_CHALLENGE_METHODS.S256,
      nonce: p.nonce,
      prompt: p.prompt,
      maxAge,
    });
    return { type: 'consent_redirect', transactionId };
  }

  // Intersect even on the covered path. It is a no-op whenever `covers` is true, and
  // that is exactly why it belongs here: the day someone changes the predicate above,
  // the scope on the code is still bounded by what the user approved.
  const code = await _issueAuthCode({
    userId: req.user.id,
    clientId: client.clientId,
    redirectUri,
    scope: ScopeUtil.format(ScopeUtil.intersect(requested, granted)),
    codeChallenge: p.codeChallenge,
    nonce: p.nonce,
    authTime,
  });

  return { type: 'code', redirectUri, state, code };
};

export const runAuthorize = async (req: Request, res: Response): Promise<void> => {
  const out = await getAuthorize(req);

  switch (out.type) {
    case 'render_error':
      // Only reached when redirecting would mean redirecting somewhere unverified.
      res.status(out.status).json({ error: out.error, error_description: out.desc });
      return;
    case 'error_redirect':
      res.redirect(
        302,
        buildRedirectUrl(out.redirectUri, {
          error: out.error,
          error_description: out.desc,
          state: out.state,
        }),
      );
      return;
    case 'login_redirect':
      res.redirect(302, out.location);
      return;
    case 'consent_redirect':
      res.redirect(
        302,
        `${consentBase()}/consent?transaction_id=${encodeURIComponent(out.transactionId)}`,
      );
      return;
    default:
      res.redirect(302, buildRedirectUrl(out.redirectUri, { code: out.code, state: out.state }));
  }
};

// ── Token ────────────────────────────────────────────────────────────────────

/** Every failed redemption returns the same RFC 6749 error — the reason is ours, not the client's. */
const invalidGrant = (res: Response, description: string): void => {
  res.status(400).json({ error: OAUTH_ERRORS.INVALID_GRANT, error_description: description });
};

/**
 * Internal: the security response to a replayed authorization code.
 *
 * RFC 6749 §4.1.2 says an authorization server SHOULD revoke everything issued from a
 * code that is presented twice. This is the reason redemption keeps the pre-image
 * instead of deleting the row — a `findOneAndDelete` would render this branch
 * indistinguishable from a client sending garbage, and the attack signal would be lost.
 *
 * Since M4 the blast radius is the whole authorization grant rather than the single
 * token the code happened to record, which is the same cascade RFC 7009 asks for.
 */
const _handleReplayedCode = async (req: Request, code: IOAuthAuthCode): Promise<void> => {
  let revokedCount = 0;
  if (code.grantId) {
    revokedCount = await AccessTokenStore.revokeByGrant(
      code.grantId,
      REVOKE_REASONS.TOKEN_REUSE_DETECTED,
    );
  } else if (code.issuedAccessTokenHash) {
    revokedCount = await AccessTokenStore.revokeByHash(
      code.issuedAccessTokenHash,
      REVOKE_REASONS.TOKEN_REUSE_DETECTED,
    );
  }

  // `revokedCount`, not `revokedTokens`: the logger redacts by key pattern, and anything
  // matching `token` comes out as `[redacted]` — which would hide the number we care about.
  Logger.warn('Authorization code replayed — revoking what it issued', {
    clientId: code.clientId,
    userId: code.userId.toString(),
    firstRedeemedAt: code.consumedAt,
    revokedCount,
  });

  events.record('oauth.code.replayed', {
    actorUserId: code.userId.toString(),
    clientId: code.clientId,
    ...events.reqContext(req),
    meta: { revokedCount, firstRedeemedAt: code.consumedAt },
  });
};

export const exchangeToken = async (req: Request, res: Response): Promise<void> => {
  // RFC 6749 §5.1: a response carrying credentials must never be cached.
  res.set(NO_STORE_HEADERS);

  const grantType = req.body?.grant_type as string | undefined;
  if (grantType !== GRANT_TYPES.AUTHORIZATION_CODE) {
    res.status(400).json({
      error: OAUTH_ERRORS.UNSUPPORTED_GRANT_TYPE,
      error_description: `Only ${GRANT_TYPES.AUTHORIZATION_CODE} is supported`,
    });
    return;
  }

  // Authenticate before spending the code: an unauthenticated caller must not be able
  // to burn a legitimate client's authorization code.
  const auth = await ClientAuthService.authenticate(req, {
    allowedMethods: SUPPORTED_TOKEN_ENDPOINT_AUTH_METHODS,
  });
  if (!auth.ok) {
    if (auth.challenge) res.set('WWW-Authenticate', auth.challenge);
    res.status(auth.status).json({ error: auth.error, error_description: auth.description });
    return;
  }
  const client = auth.client;

  if (!ClientPolicy.allowsGrantType(client, grantType)) {
    res.status(400).json({
      error: OAUTH_ERRORS.UNAUTHORIZED_CLIENT,
      error_description: 'This client is not registered for this grant type',
    });
    return;
  }

  const codeRaw = req.body?.code as string | undefined;
  const redirectUri = req.body?.redirect_uri as string | undefined;
  const codeVerifier = req.body?.code_verifier as string | undefined;
  if (!codeRaw || !redirectUri || !codeVerifier) {
    res.status(400).json({
      error: OAUTH_ERRORS.INVALID_REQUEST,
      error_description: 'Missing code, redirect_uri, or code_verifier',
    });
    return;
  }

  /*
   * Redemption: one atomic single-document compare-and-set, run before the binding and
   * PKCE checks rather than after. That ordering is deliberate — presenting a code
   * spends it whatever the outcome, so a stolen code is good for exactly one attempt and
   * the legitimate client's redemption then fails loudly instead of silently succeeding
   * alongside the attacker's.
   */
  const claim = await AuthCodeStore.claim(String(codeRaw).trim());

  if (claim.outcome === CODE_REDEMPTION.REPLAYED) {
    await _handleReplayedCode(req, claim.code);
    invalidGrant(res, 'Invalid or expired code');
    return;
  }
  if (claim.outcome !== CODE_REDEMPTION.CLAIMED) {
    invalidGrant(res, 'Invalid or expired code');
    return;
  }

  const rec = claim.code;

  if (rec.clientId !== client.clientId) {
    invalidGrant(res, 'Invalid or expired code');
    return;
  }
  if (rec.redirectUri !== redirectUri) {
    invalidGrant(res, 'redirect_uri mismatch');
    return;
  }
  if (!verifyPkce(codeVerifier, rec.codeChallenge)) {
    invalidGrant(res, 'PKCE verification failed');
    return;
  }

  const user = await User.findById(rec.userId);
  if (!user) {
    invalidGrant(res, 'User no longer exists');
    return;
  }

  /*
   * Second intersection, at issuance rather than at authorization.
   *
   * The code already carries a granted scope, so this is usually a no-op — but a
   * consent can be withdrawn or narrowed, and a client's allowlist tightened, in the
   * minutes between the redirect and the exchange. Recomputing here means the token
   * reflects the grant as it stands *now*, not as it stood when the code was minted.
   */
  const granted = await ConsentGrantService.grantedScopes(rec.userId.toString(), client.clientId);
  const finalScopes = ScopeUtil.intersect(
    ScopeUtil.intersect(ScopeUtil.parse(rec.scope), granted),
    ClientPolicy.effective(client).scopes,
  );
  if (!finalScopes.includes(OIDC_SCOPES.OPENID)) {
    invalidGrant(res, 'The authorization grant for this code is no longer valid');
    return;
  }
  const scope = ScopeUtil.format(finalScopes);
  const authTime = rec.authTime ?? rec.createdAt;
  const grantId = rec.grantId ?? rec.codeHash;

  const accessToken = await OidcTokenService.issueAccessToken({
    userId: user._id.toString(),
    clientId: client.clientId,
    scope,
    grantId,
    authTime,
  });
  // Link the token back to the code so a later replay knows exactly what to revoke.
  await AuthCodeStore.linkIssuedAccessToken(rec.codeHash, accessToken.tokenHash);

  const idToken = OidcTokenService.issueIdToken({
    userId: user._id.toString(),
    clientId: client.clientId,
    scope,
    authTime,
    nonce: rec.nonce,
    email: user.email,
    emailVerified: user.isVerified === true,
    name: user.name,
  });

  events.record('token.issued', {
    actorUserId: user._id.toString(),
    clientId: client.clientId,
    ...events.reqContext(req),
    meta: { scope, requestedScope: rec.scope },
  });

  res.json({
    access_token: accessToken.token,
    id_token: idToken,
    token_type: TOKEN_TYPE_BEARER,
    expires_in: ACCESS_TOKEN_SECONDS,
    scope,
  });
};

/** Invalidate every outstanding access token a user holds for one client. Returns how
 *  many were revoked. Used by "revoke app" on the user dashboard. */
export const revokeAccessTokensForClient = (userId: string, clientId: string): Promise<number> =>
  AccessTokenStore.revokeForUserClient(userId, clientId, REVOKE_REASONS.USER_REVOKED_APP);

// ── Userinfo ───────────────────────────────────────────────────────────────
export const getUserinfo = async (req: Request, res: Response): Promise<void> => {
  // Userinfo is personal data keyed by a bearer credential; nothing may cache it.
  res.set(NO_STORE_HEADERS);

  const ctx = req.oauth!;
  const client = await clientService.findByClientId(ctx.clientId);
  if (client?.suspended) {
    res.status(401).json({
      error: OAUTH_ERRORS.INVALID_TOKEN,
      error_description: 'This application has been suspended',
    });
    return;
  }
  const u = await User.findById(ctx.userId);
  if (!u) {
    res
      .status(404)
      .json({ error: OAUTH_ERRORS.INVALID_TOKEN, error_description: 'User not found' });
    return;
  }

  // `ctx.scope` is the granted scope read back from the token's server-side record, not
  // anything the caller supplied — a client cannot widen its own claim set.
  const out: Record<string, unknown> = { sub: u._id.toString() };
  if (ScopeUtil.has(ctx.scope, OIDC_SCOPES.EMAIL)) {
    out.email = u.email;
    out.email_verified = u.isVerified === true;
  }
  if (ScopeUtil.has(ctx.scope, OIDC_SCOPES.PROFILE)) {
    out.name = u.name;
  }

  events.record('userinfo.access', {
    actorUserId: ctx.userId,
    clientId: ctx.clientId,
    ...events.reqContext(req),
  });

  res.json(out);
};

// ── Consent (called by the first-party consent API) ──────────────────────────
export const loadConsentContext = async (userId: string, transactionId?: string) => {
  if (!transactionId || typeof transactionId !== 'string') {
    throw ApiError.badRequest('transaction_id is required');
  }
  // Read-only: rendering the consent screen must not consume the transaction, so this
  // is a `findPending` rather than the CAS claim used by `completeConsent`.
  const ar = await AuthRequestStore.findPending(transactionId.trim(), userId);
  if (!ar) throw ApiError.badRequest('Invalid or expired transaction');

  const client = await clientService.findByClientId(ar.clientId);
  if (!client) throw ApiError.badRequest('Client not found');

  const requested = ScopeUtil.parse(ar.scope);
  const alreadyGranted = await ConsentGrantService.grantedScopes(userId, ar.clientId);

  return {
    transaction_id: ar.transactionId,
    client_id: client.clientId,
    client_name: client.clientName,
    description: client.description || '',
    logo_url: client.logoUrl || '',
    scope: ar.scope,
    /** What the user is being asked for, split out so the screen can render checkboxes. */
    requested_scopes: requested,
    /** What they have already approved — the delta is what this prompt is really about. */
    granted_scopes: alreadyGranted,
    client_suspended: !!client.suspended,
  };
};

export interface CompleteConsentInput {
  userId: string;
  /** The caller's session id, used to read `auth_time` for the issued code. */
  sessionId?: string | null;
  transactionId: string;
  decision: string;
  /**
   * The subset the user actually approved. Omitted means "everything that was
   * requested"; anything else must be a subset of the request.
   */
  scope?: string | string[];
}

export const completeConsent = async (input: CompleteConsentInput) => {
  const tid = String(input.transactionId || '').trim();
  if (!tid) throw ApiError.badRequest('transaction_id is required');
  const decision = String(input.decision || '').toLowerCase();
  if (decision !== 'allow' && decision !== 'deny') {
    throw ApiError.badRequest('decision must be allow or deny');
  }

  /*
   * Claim the transaction up front with the same single-document compare-and-set used
   * for authorization codes. One decision therefore yields at most one code, however
   * many times the consent form is submitted — the previous `get` … `del` pair left a
   * window where a double-submit minted two.
   */
  const ar = await AuthRequestStore.consume(tid, input.userId);
  if (!ar) throw ApiError.badRequest('Invalid or expired transaction');

  const client = await clientService.findByClientId(ar.clientId);
  if (!client) {
    throw ApiError.badRequest('Client not found');
  }
  if (client.suspended) {
    return {
      message: 'Application suspended',
      granted: false,
      client_id: ar.clientId,
      scope: '',
      redirect_url: buildRedirectUrl(ar.redirectUri, {
        error: OAUTH_ERRORS.ACCESS_DENIED,
        error_description: 'This application has been suspended',
        state: ar.state,
      }),
    };
  }

  if (decision === 'deny') {
    return {
      message: 'Access denied',
      granted: false,
      client_id: ar.clientId,
      scope: '',
      redirect_url: buildRedirectUrl(ar.redirectUri, {
        error: OAUTH_ERRORS.ACCESS_DENIED,
        error_description: 'User denied access',
        state: ar.state,
      }),
    };
  }

  const requested = ScopeUtil.parse(ar.scope);
  const approved = await ConsentGrantService.record({
    userId: input.userId,
    client,
    requested,
    approved: input.scope === undefined ? requested : ScopeUtil.parse(input.scope),
  });

  const session = await findActiveSession(input.userId, input.sessionId);
  const code = await _issueAuthCode({
    userId: input.userId,
    clientId: ar.clientId,
    redirectUri: ar.redirectUri,
    // The grant, not the request. This is the line the escalation bug lived on.
    scope: ScopeUtil.format(ScopeUtil.intersect(requested, approved)),
    codeChallenge: ar.codeChallenge,
    nonce: ar.nonce,
    authTime: session?.createdAt ?? new Date(),
  });

  return {
    message: 'Authorized',
    granted: true,
    client_id: ar.clientId,
    scope: ScopeUtil.format(ScopeUtil.intersect(requested, approved)),
    redirect_url: buildRedirectUrl(ar.redirectUri, { code, state: ar.state }),
  };
};

export type { IOAuthClient };
