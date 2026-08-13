import type { Request, Response } from 'express';
import { ApiError } from '../../common/utils/ApiError';
import { Config } from '../../common/config/config';
import { getOidcIssuer, signIdToken } from '../../common/utils/keys.utils';
import { randomBase64Url, verifyPkce } from '../../common/utils/crypto.utils';
import {
  CODE_CHALLENGE_METHODS,
  CODE_REDEMPTION,
  CRYPTO,
  GRANT_TYPES,
  OAUTH_ERRORS,
  OAUTH_TRANSACTION_ID_PREFIX,
  REVOKE_REASONS,
  TTL_SECONDS,
} from '../../common/constants/index.constants';
import { Logger } from '../../common/logger/index.logger';
import * as clientService from '../oauth-client/oauth-client.service';
import * as events from '../events/event.service';
import User from '../auth/auth.model';
import Consent from './consent.model';
import { AuthRequestStore } from './auth-request.store';
import { AuthCodeStore } from './auth-code.store';
import { AccessTokenStore } from './access-token.store';
import type { IOAuthAuthCode } from './oauth-auth-code.model';

const ACCESS_TOKEN_SECONDS = TTL_SECONDS.ACCESS_TOKEN;

const loginBase = () => Config.web.loginRedirectBase;

const consentBase = () => Config.web.consentRedirectBase;

const hasScope = (scopeStr: string, needle: string): boolean =>
  (scopeStr || '').split(/\s+/).filter(Boolean).includes(needle);

// ── Authorize params ────────────────────────────────────────────────────────
interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: typeof CODE_CHALLENGE_METHODS.S256;
  nonce?: string;
}

const validateAuthorizeQuery = (q: Request['query']): AuthorizeParams => {
  const clientId = q.client_id as string | undefined;
  const redirectUri = q.redirect_uri as string | undefined;
  const responseType = q.response_type as string | undefined;
  const scope = q.scope as string | undefined;
  const state = q.state as string | undefined;
  const codeChallenge = q.code_challenge as string | undefined;
  const codeChallengeMethod = (q.code_challenge_method as string | undefined) ?? 'S256';
  const nonce = q.nonce as string | undefined;

  if (responseType !== 'code') throw ApiError.badRequest('response_type must be code');
  if (!clientId || !redirectUri || !state || !codeChallenge) {
    throw ApiError.badRequest(
      'Missing required parameters: client_id, redirect_uri, state, code_challenge',
    );
  }
  if (codeChallengeMethod !== 'S256') {
    throw ApiError.badRequest('Only code_challenge_method S256 is supported');
  }
  if (!String(scope || '').split(/\s+/).includes('openid')) {
    throw ApiError.badRequest('scope must include openid');
  }

  return {
    clientId: String(clientId).trim(),
    redirectUri: String(redirectUri),
    scope: String(scope || 'openid').trim() || 'openid',
    state: String(state),
    codeChallenge: String(codeChallenge),
    codeChallengeMethod: 'S256',
    nonce: nonce ? String(nonce) : undefined,
  };
};

const assertRedirect = (client: { redirectUris: string[] }, redirectUri: string) => {
  if (!client.redirectUris.includes(redirectUri)) {
    throw ApiError.badRequest('Invalid redirect_uri for this client');
  }
};

const buildRedirectUrl = (redirectUri: string, params: Record<string, string | undefined>): string => {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  return u.toString();
};

// ── Authorize ────────────────────────────────────────────────────────────────
type AuthorizeOutcome =
  | { type: 'redirect'; status: number; location: string }
  | { type: 'error_redirect'; redirectUri: string; state: string; error: string; desc: string }
  | { type: 'consent_redirect'; transactionId: string }
  | { type: 'code'; params: AuthorizeParams };

export const getAuthorize = async (req: Request): Promise<AuthorizeOutcome> => {
  const params = validateAuthorizeQuery(req.query);
  const client = await clientService.findByClientId(params.clientId);
  if (!client) throw ApiError.badRequest('Unknown client_id');
  assertRedirect(client, params.redirectUri);

  if (client.suspended) {
    return {
      type: 'error_redirect',
      redirectUri: params.redirectUri,
      state: params.state,
      error: 'access_denied',
      desc: 'This application has been suspended',
    };
  }

  if (!req.user) {
    const returnTo = `${getOidcIssuer()}${req.originalUrl}`;
    return {
      type: 'redirect',
      status: 302,
      location: `${loginBase()}/login?return_to=${encodeURIComponent(returnTo)}`,
    };
  }

  const existing = await Consent.findOne({ userId: req.user.id, clientId: params.clientId });
  if (!existing) {
    const transactionId = `${OAUTH_TRANSACTION_ID_PREFIX}${randomBase64Url(
      CRYPTO.TOKEN_BYTES.TRANSACTION_ID,
    ).replace(/[^a-zA-Z0-9_-]/g, '')}`;
    // Calls out to the auth-request store (TTL-indexed Mongo, scoped by user).
    await AuthRequestStore.create({ transactionId, userId: req.user.id, ...params });
    return { type: 'consent_redirect', transactionId };
  }

  return { type: 'code', params };
};

const issueAuthCode = async (userId: string, params: AuthorizeParams): Promise<string> => {
  const code = randomBase64Url(CRYPTO.TOKEN_BYTES.AUTH_CODE);
  // Only the hash is persisted; the raw code exists solely in the redirect we emit.
  await AuthCodeStore.create({
    code,
    userId,
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod,
    scope: params.scope,
    nonce: params.nonce,
  });
  return code;
};

export const runAuthorize = async (req: Request, res: Response): Promise<void> => {
  const out = await getAuthorize(req);
  if (out.type === 'redirect') {
    res.redirect(out.status, out.location);
    return;
  }
  if (out.type === 'error_redirect') {
    res.redirect(302, buildRedirectUrl(out.redirectUri, { error: out.error, error_description: out.desc, state: out.state }));
    return;
  }
  if (out.type === 'consent_redirect') {
    res.redirect(302, `${consentBase()}/consent?transaction_id=${encodeURIComponent(out.transactionId)}`);
    return;
  }
  const code = await issueAuthCode(req.user!.id, out.params);
  res.redirect(302, buildRedirectUrl(out.params.redirectUri, { code, state: out.params.state }));
};

// ── Token ────────────────────────────────────────────────────────────────────
const parseBasicOrBody = (req: Request): { clientId?: string; clientSecret?: string } => {
  let clientId = req.body?.client_id as string | undefined;
  let clientSecret = req.body?.client_secret as string | undefined;
  const h = req.headers.authorization;
  if (h?.startsWith('Basic ')) {
    const decoded = Buffer.from(h.slice(6), 'base64').toString('utf8');
    const i = decoded.indexOf(':');
    if (i >= 0) {
      clientId = decoded.slice(0, i);
      clientSecret = decoded.slice(i + 1);
    }
  }
  return { clientId, clientSecret };
};

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
 * When refresh-token families land (M3) this is where family revocation hooks in.
 */
const _handleReplayedCode = async (req: Request, code: IOAuthAuthCode): Promise<void> => {
  const revokedCount = code.issuedAccessTokenHash
    ? await AccessTokenStore.revokeByHash(
        code.issuedAccessTokenHash,
        REVOKE_REASONS.TOKEN_REUSE_DETECTED,
      )
    : 0;

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
  if (req.body?.grant_type !== GRANT_TYPES.AUTHORIZATION_CODE) {
    res.status(400).json({
      error: OAUTH_ERRORS.UNSUPPORTED_GRANT_TYPE,
      error_description: `Only ${GRANT_TYPES.AUTHORIZATION_CODE} is supported`,
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

  const { clientId, clientSecret } = parseBasicOrBody(req);
  if (!clientId) {
    res.status(401).json({ error: OAUTH_ERRORS.INVALID_CLIENT, error_description: 'Client authentication required' });
    return;
  }

  const client = await clientService.findByClientId(clientId, { withSecret: true });
  if (!client) {
    res.status(401).json({ error: OAUTH_ERRORS.INVALID_CLIENT, error_description: 'Unknown client' });
    return;
  }
  if (client.suspended) {
    res.status(401).json({ error: OAUTH_ERRORS.INVALID_CLIENT, error_description: 'This application has been suspended' });
    return;
  }

  const okSecret = clientSecret ? await clientService.verifyClientSecret(client, clientSecret) : false;
  if (!okSecret) {
    res.status(401).json({ error: OAUTH_ERRORS.INVALID_CLIENT, error_description: 'Invalid credentials' });
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

  const opaque = randomBase64Url(CRYPTO.TOKEN_BYTES.ACCESS_TOKEN);
  // Calls out to the access-token store; `{ userId, clientId }` is indexed there, which
  // is what removed the need for a separate Redis index set per (user, client).
  const { tokenHash } = await AccessTokenStore.create({
    token: opaque,
    userId: user._id.toString(),
    clientId: client.clientId,
    scope: rec.scope,
  });
  // Link the token back to the code so a later replay knows exactly what to revoke.
  await AuthCodeStore.linkIssuedAccessToken(rec.codeHash, tokenHash);

  const now = Math.floor(Date.now() / 1000);
  const idClaims: Record<string, unknown> = {
    iss: getOidcIssuer(),
    sub: user._id.toString(),
    aud: client.clientId,
    iat: now,
    exp: now + ACCESS_TOKEN_SECONDS,
  };
  if (rec.nonce) idClaims.nonce = rec.nonce;
  if (hasScope(rec.scope, 'email') && user.email) idClaims.email = user.email;
  if (hasScope(rec.scope, 'profile') && user.name) idClaims.name = user.name;
  if (hasScope(rec.scope, 'email')) idClaims.email_verified = user.isVerified === true;

  const idToken = await signIdToken(idClaims);

  events.record('token.issued', {
    actorUserId: user._id.toString(),
    clientId: client.clientId,
    ...events.reqContext(req),
    meta: { scope: rec.scope },
  });

  res.json({
    access_token: opaque,
    id_token: idToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_SECONDS,
    scope: rec.scope,
  });
};

/** Invalidate every outstanding access token a user holds for one client. Returns how
 *  many were revoked. Used by "revoke app" on the user dashboard. */
export const revokeAccessTokensForClient = (userId: string, clientId: string): Promise<number> =>
  AccessTokenStore.revokeForUserClient(userId, clientId, REVOKE_REASONS.USER_REVOKED_APP);

// ── Userinfo ───────────────────────────────────────────────────────────────
export const getUserinfo = async (req: Request, res: Response): Promise<void> => {
  const ctx = req.oauth!;
  const client = await clientService.findByClientId(ctx.clientId);
  if (client?.suspended) {
    res.status(401).json({ error: 'invalid_token', error_description: 'This application has been suspended' });
    return;
  }
  const u = await User.findById(ctx.userId);
  if (!u) {
    res.status(404).json({ error: 'invalid_token', error_description: 'User not found' });
    return;
  }
  const out: Record<string, unknown> = { sub: u._id.toString() };
  if (hasScope(ctx.scope, 'email')) {
    out.email = u.email;
    out.email_verified = u.isVerified === true;
  }
  if (hasScope(ctx.scope, 'profile')) {
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

  return {
    transaction_id: ar.transactionId,
    client_id: client.clientId,
    client_name: client.clientName,
    description: client.description || '',
    logo_url: client.logoUrl || '',
    scope: ar.scope,
    client_suspended: !!client.suspended,
  };
};

export const completeConsent = async (userId: string, transactionId: string, decision: string) => {
  const tid = String(transactionId || '').trim();
  if (!tid) throw ApiError.badRequest('transaction_id is required');
  const d = String(decision || '').toLowerCase();
  if (d !== 'allow' && d !== 'deny') throw ApiError.badRequest('decision must be allow or deny');

  /*
   * Claim the transaction up front with the same single-document compare-and-set used
   * for authorization codes. One decision therefore yields at most one code, however
   * many times the consent form is submitted — the previous `get` … `del` pair left a
   * window where a double-submit minted two.
   */
  const ar = await AuthRequestStore.consume(tid, userId);
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
      redirect_url: buildRedirectUrl(ar.redirectUri, {
        error: 'access_denied',
        error_description: 'This application has been suspended',
        state: ar.state,
      }),
    };
  }

  const params: AuthorizeParams = {
    clientId: ar.clientId,
    redirectUri: ar.redirectUri,
    scope: ar.scope,
    state: ar.state,
    codeChallenge: ar.codeChallenge,
    codeChallengeMethod: CODE_CHALLENGE_METHODS.S256,
    nonce: ar.nonce,
  };

  if (d === 'deny') {
    return {
      message: 'Access denied',
      granted: false,
      client_id: ar.clientId,
      redirect_url: buildRedirectUrl(ar.redirectUri, {
        error: 'access_denied',
        error_description: 'User denied access',
        state: ar.state,
      }),
    };
  }

  await Consent.findOneAndUpdate(
    { userId, clientId: params.clientId },
    { userId, clientId: params.clientId, scope: params.scope },
    { upsert: true, new: true },
  );

  const code = await issueAuthCode(userId, params);
  return {
    message: 'Authorized',
    granted: true,
    client_id: ar.clientId,
    redirect_url: buildRedirectUrl(ar.redirectUri, { code, state: ar.state }),
  };
};
