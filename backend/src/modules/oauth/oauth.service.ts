import type { Request, Response } from 'express';
import { ApiError } from '../../common/utils/ApiError';
import { redis } from '../../common/config/redis';
import { Config } from '../../common/config/config';
import { getOidcIssuer, signIdToken } from '../../common/utils/keys.utils';
import { hashToken, randomBase64Url, verifyPkce } from '../../common/utils/crypto.utils';
import * as clientService from '../oauth-client/oauth-client.service';
import * as events from '../events/event.service';
import User from '../auth/auth.model';
import Consent from './consent.model';

const ACCESS_TOKEN_SECONDS = 900;

const loginBase = () => Config.web.loginRedirectBase;

const consentBase = () => Config.web.consentRedirectBase;

const hasScope = (scopeStr: string, needle: string): boolean =>
  (scopeStr || '').split(/\s+/).filter(Boolean).includes(needle);

// ── Authorize params + Redis payload shapes ─────────────────────────────────
interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  nonce?: string;
}

interface AuthReqData extends AuthorizeParams {
  transactionId: string;
  userId: string;
}

interface AuthCodeData {
  codeHash: string;
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string;
  nonce?: string;
}

interface AccessTokenData {
  tokenHash: string;
  userId: string;
  clientId: string;
  scope: string;
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
    const transactionId = `txn_${randomBase64Url(24).replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const reqData: AuthReqData = { transactionId, userId: req.user.id, ...params };
    await redis.set(`auth_req:${transactionId}:${req.user.id}`, JSON.stringify(reqData), 'EX', 15 * 60);
    return { type: 'consent_redirect', transactionId };
  }

  return { type: 'code', params };
};

const issueAuthCode = async (userId: string, params: AuthorizeParams): Promise<string> => {
  const raw = randomBase64Url(32);
  const codeHash = hashToken(raw);
  const codeData: AuthCodeData = {
    codeHash,
    userId,
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod,
    scope: params.scope,
    nonce: params.nonce,
  };
  await redis.set(`auth_code:${codeHash}`, JSON.stringify(codeData), 'EX', 5 * 60);
  return raw;
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

export const exchangeToken = async (req: Request, res: Response): Promise<void> => {
  if (req.body?.grant_type !== 'authorization_code') {
    res.status(400).json({ error: 'unsupported_grant_type', error_description: 'Only authorization_code is supported' });
    return;
  }

  const codeRaw = req.body?.code as string | undefined;
  const redirectUri = req.body?.redirect_uri as string | undefined;
  const codeVerifier = req.body?.code_verifier as string | undefined;
  if (!codeRaw || !redirectUri || !codeVerifier) {
    res.status(400).json({ error: 'invalid_request', error_description: 'Missing code, redirect_uri, or code_verifier' });
    return;
  }

  const { clientId, clientSecret } = parseBasicOrBody(req);
  if (!clientId) {
    res.status(401).json({ error: 'invalid_client', error_description: 'Client authentication required' });
    return;
  }

  const client = await clientService.findByClientId(clientId, { withSecret: true });
  if (!client) {
    res.status(401).json({ error: 'invalid_client', error_description: 'Unknown client' });
    return;
  }
  if (client.suspended) {
    res.status(401).json({ error: 'invalid_client', error_description: 'This application has been suspended' });
    return;
  }

  const okSecret = clientSecret ? await clientService.verifyClientSecret(client, clientSecret) : false;
  if (!okSecret) {
    res.status(401).json({ error: 'invalid_client', error_description: 'Invalid credentials' });
    return;
  }

  const codeHash = hashToken(String(codeRaw).trim());
  const recJson = await redis.get(`auth_code:${codeHash}`);
  if (!recJson) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired code' });
    return;
  }
  const rec = JSON.parse(recJson) as AuthCodeData;

  if (rec.clientId !== client.clientId) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired code' });
    return;
  }
  if (rec.redirectUri !== redirectUri) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
    return;
  }
  if (!verifyPkce(codeVerifier, rec.codeChallenge)) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
    return;
  }

  // Single-use: delete before issuing tokens.
  await redis.del(`auth_code:${codeHash}`);

  const user = await User.findById(rec.userId);
  if (!user) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'User no longer exists' });
    return;
  }

  const opaque = randomBase64Url(32);
  const tokenHash = hashToken(opaque);
  const tokenData: AccessTokenData = {
    tokenHash,
    userId: user._id.toString(),
    clientId: client.clientId,
    scope: rec.scope,
  };
  await redis.set(`access_token:${tokenHash}`, JSON.stringify(tokenData), 'EX', ACCESS_TOKEN_SECONDS);
  // Index this token under (user, client) so "revoke app" can invalidate it without a SCAN.
  // The set's TTL tracks the token lifetime; stale hashes expire with it.
  const tokenIndexKey = `user_client_tokens:${user._id.toString()}:${client.clientId}`;
  await redis.sadd(tokenIndexKey, tokenHash);
  await redis.expire(tokenIndexKey, ACCESS_TOKEN_SECONDS);

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

/** Invalidate every outstanding access token a user holds for one client. Returns
 *  how many were deleted. Used by "revoke app" on the user dashboard. */
export const revokeAccessTokensForClient = async (
  userId: string,
  clientId: string,
): Promise<number> => {
  const indexKey = `user_client_tokens:${userId}:${clientId}`;
  const hashes = await redis.smembers(indexKey);
  let removed = 0;
  if (hashes.length) {
    removed = await redis.del(...hashes.map((h) => `access_token:${h}`));
  }
  await redis.del(indexKey);
  return removed;
};

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
  const arJson = await redis.get(`auth_req:${transactionId.trim()}:${userId}`);
  if (!arJson) throw ApiError.badRequest('Invalid or expired transaction');

  const ar = JSON.parse(arJson) as AuthReqData;
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

  const arJson = await redis.get(`auth_req:${tid}:${userId}`);
  if (!arJson) throw ApiError.badRequest('Invalid or expired transaction');
  const ar = JSON.parse(arJson) as AuthReqData;

  const client = await clientService.findByClientId(ar.clientId);
  if (!client) {
    await redis.del(`auth_req:${tid}:${userId}`);
    throw ApiError.badRequest('Client not found');
  }
  if (client.suspended) {
    await redis.del(`auth_req:${tid}:${userId}`);
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
    codeChallengeMethod: 'S256',
    nonce: ar.nonce,
  };

  await redis.del(`auth_req:${tid}:${userId}`);

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
