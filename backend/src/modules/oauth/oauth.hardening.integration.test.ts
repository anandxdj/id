/**
 * M4 authorization-endpoint hardening: consent scope comparison, per-client protocol
 * policy, public clients, `prompt`, `max_age`/`auth_time`, and redirect-based errors.
 *
 * The first test in this file is the ship blocker — the scope-escalation path that
 * exists in both this codebase and the reference (plan §2.3-12).
 *
 * Requires Mongo + Redis; self-skips when unavailable, fails hard under
 * REQUIRE_INTEGRATION.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pkceChallengeS256, randomBase64Url } from '../../common/utils/crypto.utils';
import { IntegrationGate, OidcHarness } from '../../common/testing/index.testing';
import type { HarnessContext } from '../../common/testing/index.testing';

process.env.OIDC_ISSUER ??= 'http://localhost:4000';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.MONGO_DB_NAME ??= 'id_test';

const EMAIL = 'oidc-hardening@tabbio.com';
const PASSWORD = 'sup3r-secret-pw';
const NAME = 'Hardening Subject';
const REDIRECT_URI = 'http://localhost:3001/cb';

let ctx: HarnessContext | undefined;
let available = false;

/** One client per concern, so a grant recorded by one test cannot mask another. */
const clients = {
  escalation: { id: '', secret: '' },
  narrow: { id: '', secret: '' },
  publicSpa: { id: '' },
  basicAuth: { id: '', secret: '' },
  prompts: { id: '', secret: '' },
};

const clientIds = (): string[] =>
  [clients.escalation.id, clients.narrow.id, clients.publicSpa.id, clients.basicAuth.id, clients.prompts.id].filter(
    Boolean,
  );

before(async () => {
  try {
    ctx = await OidcHarness.start({ email: EMAIL, password: PASSWORD, name: NAME });
    const clientService = await import('../oauth-client/oauth-client.service');

    const escalation = await clientService.create({
      clientName: 'Escalation Probe',
      redirectUris: [REDIRECT_URI],
    });
    clients.escalation = { id: escalation.clientId, secret: escalation.clientSecret! };

    // Registered for `openid email` only — `profile` is outside its allowlist.
    const narrow = await clientService.create({
      clientName: 'Narrow Allowlist',
      redirectUris: [REDIRECT_URI],
      scopes: ['openid', 'email'],
    });
    clients.narrow = { id: narrow.clientId, secret: narrow.clientSecret! };

    const publicSpa = await clientService.create({
      clientName: 'Public SPA',
      redirectUris: [REDIRECT_URI],
      tokenEndpointAuthMethod: 'none',
    });
    clients.publicSpa = { id: publicSpa.clientId };
    assert.equal(publicSpa.clientSecret, undefined, 'a public client is issued no secret');

    const basicAuth = await clientService.create({
      clientName: 'Basic Auth Only',
      redirectUris: [REDIRECT_URI],
      tokenEndpointAuthMethod: 'client_secret_basic',
    });
    clients.basicAuth = { id: basicAuth.clientId, secret: basicAuth.clientSecret! };

    const prompts = await clientService.create({
      clientName: 'Prompt Probe',
      redirectUris: [REDIRECT_URI],
    });
    clients.prompts = { id: prompts.clientId, secret: prompts.clientSecret! };

    available = true;
  } catch (cause) {
    available = false;
    await OidcHarness.abandon();
    IntegrationGate.reportUnavailable('oauth.hardening', cause);
  }
});

after(async () => {
  if (available) await OidcHarness.stop(ctx, { email: EMAIL, clientIds: clientIds() });
  else ctx?.server.close();
});

// ── Request helpers ──────────────────────────────────────────────────────────

interface AuthorizeOptions {
  clientId: string;
  scope?: string;
  state?: string;
  challenge?: string | null;
  prompt?: string;
  maxAge?: string;
  responseType?: string;
  redirectUri?: string;
  anonymous?: boolean;
}

const authorize = async (options: AuthorizeOptions): Promise<Response> => {
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri ?? REDIRECT_URI,
    response_type: options.responseType ?? 'code',
    scope: options.scope ?? 'openid',
    state: options.state ?? 'st',
  });
  if (options.challenge !== null) {
    params.set('code_challenge', options.challenge ?? 'x'.repeat(43));
    params.set('code_challenge_method', 'S256');
  }
  if (options.prompt) params.set('prompt', options.prompt);
  if (options.maxAge) params.set('max_age', options.maxAge);

  return fetch(`${ctx!.base}/oauth/authorize?${params}`, {
    headers: options.anonymous ? {} : { cookie: ctx!.cookie },
    redirect: 'manual',
  });
};

const locationOf = (res: Response): URL => new URL(res.headers.get('location')!);

/** Drive authorize → consent → code, granting `approved` (defaults to everything asked). */
const consentAndGetCode = async (
  clientId: string,
  requestedScope: string,
  verifier: string,
  approved?: string,
): Promise<{ code: string; grantedScope: string }> => {
  const authRes = await authorize({
    clientId,
    scope: requestedScope,
    challenge: pkceChallengeS256(verifier),
  });
  assert.equal(authRes.status, 302);
  const transactionId = locationOf(authRes).searchParams.get('transaction_id');
  assert.ok(transactionId, 'a consent round-trip was required');

  const decision = await fetch(`${ctx!.base}/api/oauth/consent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx!.sessionToken}` },
    body: JSON.stringify({
      transaction_id: transactionId,
      decision: 'allow',
      ...(approved === undefined ? {} : { scope: approved }),
    }),
  });
  assert.equal(decision.status, 200);
  const body = (await decision.json()) as { data: { redirect_url: string; scope: string } };
  return {
    code: new URL(body.data.redirect_url).searchParams.get('code')!,
    grantedScope: body.data.scope,
  };
};

const redeem = (
  code: string,
  verifier: string,
  credentials: { clientId: string; clientSecret?: string; basic?: boolean },
): Promise<Response> => {
  const body: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
    client_id: credentials.clientId,
  };
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
  };
  if (credentials.basic) {
    const raw = `${encodeURIComponent(credentials.clientId)}:${encodeURIComponent(credentials.clientSecret ?? '')}`;
    headers.authorization = `Basic ${Buffer.from(raw).toString('base64')}`;
  } else if (credentials.clientSecret) {
    body.client_secret = credentials.clientSecret;
  }
  return fetch(`${ctx!.base}/oauth/token`, {
    method: 'POST',
    headers,
    body: new URLSearchParams(body),
  });
};

const claimsOf = (jwt: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(jwt.split('.')[1]!, 'base64url').toString('utf8'));

// ── 1. Consent scope escalation — the ship blocker ───────────────────────────

test('a token carries the granted scope, never the wider one the client requested', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  const verifier = randomBase64Url(32);
  // The client asks for three scopes; the user approves two of them.
  const { code, grantedScope } = await consentAndGetCode(
    clients.escalation.id,
    'openid profile email',
    verifier,
    'openid email',
  );
  assert.equal(grantedScope, 'openid email', 'the consent response reports what was granted');

  const res = await redeem(code, verifier, {
    clientId: clients.escalation.id,
    clientSecret: clients.escalation.secret,
  });
  assert.equal(res.status, 200);
  const tokens = (await res.json()) as { access_token: string; id_token: string; scope: string };

  // The assertion the whole milestone hangs on.
  assert.equal(tokens.scope, 'openid email', 'the issued token does not carry the extra scope');

  const idClaims = claimsOf(tokens.id_token);
  assert.equal(idClaims.email, EMAIL, 'email was granted, so the claim is present');
  assert.equal(idClaims.name, undefined, 'profile was NOT granted, so no name claim is emitted');

  // ...and the same holds at the resource endpoint, which reads the granted scope back
  // out of the token's server-side record rather than trusting the token body.
  const userinfo = await fetch(`${ctx!.base}/oauth/userinfo`, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  assert.equal(userinfo.status, 200);
  const profile = (await userinfo.json()) as Record<string, unknown>;
  assert.equal(profile.email, EMAIL);
  assert.equal(profile.name, undefined, 'userinfo will not serve an unapproved claim either');
});

test('asking for more than the stored grant re-prompts instead of silently upgrading', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  // The grant recorded by the previous test is `openid email`.
  const escalating = await authorize({
    clientId: clients.escalation.id,
    scope: 'openid profile email',
  });
  assert.equal(escalating.status, 302);
  assert.match(
    locationOf(escalating).pathname,
    /\/consent$/,
    'a request beyond the grant goes back to the user, not straight to a code',
  );
  assert.equal(
    locationOf(escalating).searchParams.get('code'),
    null,
    'and it certainly does not hand out a code',
  );

  // A request *within* the grant still proceeds without interrupting the user.
  const withinGrant = await authorize({ clientId: clients.escalation.id, scope: 'openid email' });
  assert.equal(withinGrant.status, 302);
  assert.ok(
    locationOf(withinGrant).searchParams.get('code'),
    'a covered request is served without a consent round-trip',
  );
});

test('narrowing consent after a code is issued narrows the token that code buys', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const Consent = (await import('./consent.model')).default;

  const verifier = randomBase64Url(32);
  const authRes = await authorize({
    clientId: clients.escalation.id,
    scope: 'openid email',
    challenge: pkceChallengeS256(verifier),
  });
  const code = locationOf(authRes).searchParams.get('code')!;
  assert.ok(code, 'the covered request produced a code carrying `openid email`');

  // The user withdraws `email` in the window between the redirect and the exchange.
  await Consent.updateOne(
    { userId: ctx!.userId, clientId: clients.escalation.id },
    { $set: { grantedScopes: ['openid'], scope: 'openid' } },
  );

  const res = await redeem(code, verifier, {
    clientId: clients.escalation.id,
    clientSecret: clients.escalation.secret,
  });
  assert.equal(res.status, 200);
  const tokens = (await res.json()) as { id_token: string; scope: string };
  assert.equal(
    tokens.scope,
    'openid',
    'issuance re-intersects against the grant as it stands now, not as it stood at authorize',
  );
  assert.equal(claimsOf(tokens.id_token).email, undefined);

  // Restore the grant so later tests see a predictable starting point.
  await Consent.updateOne(
    { userId: ctx!.userId, clientId: clients.escalation.id },
    { $set: { grantedScopes: ['openid', 'email'], scope: 'openid email' } },
  );
});

test('a withdrawn consent makes an outstanding code unredeemable', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const Consent = (await import('./consent.model')).default;

  const verifier = randomBase64Url(32);
  const authRes = await authorize({
    clientId: clients.escalation.id,
    scope: 'openid email',
    challenge: pkceChallengeS256(verifier),
  });
  const code = locationOf(authRes).searchParams.get('code')!;

  await Consent.deleteOne({ userId: ctx!.userId, clientId: clients.escalation.id });

  const res = await redeem(code, verifier, {
    clientId: clients.escalation.id,
    clientSecret: clients.escalation.secret,
  });
  assert.equal(res.status, 400);
  assert.equal(((await res.json()) as { error: string }).error, 'invalid_grant');
});

// ── 2. Client protocol metadata ──────────────────────────────────────────────

test('a scope outside the client allowlist is rejected, not silently trimmed', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  const res = await authorize({ clientId: clients.narrow.id, scope: 'openid profile' });
  assert.equal(res.status, 302, 'the client is valid, so the error goes back to its callback');
  const target = locationOf(res);
  assert.equal(target.origin + target.pathname, REDIRECT_URI);
  assert.equal(target.searchParams.get('error'), 'invalid_scope');
  assert.match(target.searchParams.get('error_description') ?? '', /profile/);
  assert.equal(target.searchParams.get('state'), 'st');

  // Trimming would have produced a code for `openid` and left the client believing it
  // held `profile`; nothing is issued at all.
  assert.equal(target.searchParams.get('code'), null);
});

test('a public client completes the flow with PKCE and no secret', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  const verifier = randomBase64Url(32);
  const { code } = await consentAndGetCode(clients.publicSpa.id, 'openid email', verifier);

  const res = await redeem(code, verifier, { clientId: clients.publicSpa.id });
  assert.equal(res.status, 200, 'a client registered for `none` authenticates with its id alone');
  const tokens = (await res.json()) as { access_token: string; scope: string };
  assert.equal(tokens.scope, 'openid email');
  assert.ok(tokens.access_token);
});

test('a public client is rejected without PKCE, and a wrong verifier buys nothing', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  // No code_challenge at all: refused at the authorization endpoint, by redirect.
  const noPkce = await authorize({ clientId: clients.publicSpa.id, challenge: null });
  assert.equal(noPkce.status, 302);
  assert.equal(locationOf(noPkce).searchParams.get('error'), 'invalid_request');
  assert.match(locationOf(noPkce).searchParams.get('error_description') ?? '', /code_challenge/);

  // A challenge the caller cannot answer: refused at the token endpoint. For a public
  // client this is the *only* thing standing between an intercepted code and a token.
  const verifier = randomBase64Url(32);
  const authRes = await authorize({
    clientId: clients.publicSpa.id,
    scope: 'openid email',
    challenge: pkceChallengeS256(verifier),
  });
  const code = locationOf(authRes).searchParams.get('code')!;
  const res = await redeem(code, 'a-completely-different-verifier', {
    clientId: clients.publicSpa.id,
  });
  assert.equal(res.status, 400);
  assert.equal(((await res.json()) as { error: string }).error, 'invalid_grant');
});

test('a client may only authenticate the way it is registered to', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  // Registered for client_secret_basic, presenting client_secret_post.
  const wrongMethod = await redeem('bogus-code', 'bogus-verifier', {
    clientId: clients.basicAuth.id,
    clientSecret: clients.basicAuth.secret,
  });
  assert.equal(wrongMethod.status, 401);
  assert.equal(((await wrongMethod.json()) as { error: string }).error, 'invalid_client');

  // The same credential over Basic authenticates — the failure moves to the bogus code,
  // which proves the rejection above was about the method and not the secret.
  const rightMethod = await redeem('bogus-code', 'bogus-verifier', {
    clientId: clients.basicAuth.id,
    clientSecret: clients.basicAuth.secret,
    basic: true,
  });
  assert.equal(rightMethod.status, 400);
  assert.equal(((await rightMethod.json()) as { error: string }).error, 'invalid_grant');

  // A public client presenting a secret is not a public client making a mistake, it is
  // something pretending to be that client.
  const publicWithSecret = await redeem('bogus-code', 'bogus-verifier', {
    clientId: clients.publicSpa.id,
    clientSecret: 'invented',
  });
  assert.equal(publicWithSecret.status, 401);
  assert.equal(((await publicWithSecret.json()) as { error: string }).error, 'invalid_client');

  // RFC 6749 §2.3: a client MUST NOT use more than one authentication mechanism.
  const both = await fetch(`${ctx!.base}/oauth/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${Buffer.from(`${clients.basicAuth.id}:${clients.basicAuth.secret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: 'bogus',
      redirect_uri: REDIRECT_URI,
      code_verifier: 'bogus',
      client_id: clients.basicAuth.id,
      client_secret: clients.basicAuth.secret,
    }),
  });
  assert.equal(both.status, 400);
  assert.equal(((await both.json()) as { error: string }).error, 'invalid_request');
});

// ── 3. prompt and max_age ────────────────────────────────────────────────────

test('prompt=none returns login_required by redirect, rendering nothing', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  const res = await authorize({ clientId: clients.prompts.id, prompt: 'none', anonymous: true });
  assert.equal(res.status, 302);
  const target = locationOf(res);

  // Not the sign-in page, and not a JSON body: the client's own callback, carrying the
  // OIDC error code it knows how to handle.
  assert.equal(target.origin + target.pathname, REDIRECT_URI);
  assert.equal(target.searchParams.get('error'), 'login_required');
  assert.equal(target.searchParams.get('state'), 'st');
});

test('prompt=none returns consent_required when the request exceeds the grant', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  const res = await authorize({
    clientId: clients.prompts.id,
    scope: 'openid email',
    prompt: 'none',
  });
  assert.equal(res.status, 302);
  assert.equal(locationOf(res).searchParams.get('error'), 'consent_required');
});

test('prompt=consent re-asks even when the grant already covers the request', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  // `openid` is inside the grant the escalation tests recorded, so this request would
  // normally be served straight from the existing consent.
  const covered = await authorize({ clientId: clients.publicSpa.id, scope: 'openid' });
  assert.ok(locationOf(covered).searchParams.get('code'), 'covered without prompt=consent');

  const forced = await authorize({
    clientId: clients.publicSpa.id,
    scope: 'openid',
    prompt: 'consent',
  });
  assert.equal(forced.status, 302);
  assert.match(
    locationOf(forced).pathname,
    /\/consent$/,
    'prompt=consent puts the decision back in front of the user regardless of the grant',
  );
});

test('prompt=login sends the user back through sign-in without looping', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  const res = await authorize({ clientId: clients.prompts.id, prompt: 'login' });
  assert.equal(res.status, 302);
  const target = locationOf(res);
  assert.match(target.pathname, /\/login$/);
  assert.equal(target.searchParams.get('prompt'), 'login', 'the sign-in page is told to force re-auth');

  // The resumed request must not still say prompt=login, or coming back from sign-in
  // would bounce straight out to sign-in again, forever.
  const returnTo = new URL(target.searchParams.get('return_to')!);
  assert.match(returnTo.pathname, /\/oauth\/authorize$/);
  assert.equal(returnTo.searchParams.get('prompt'), null, 'prompt is stripped from return_to');
  assert.equal(returnTo.searchParams.get('client_id'), clients.prompts.id);
});

test('max_age forces re-authentication, and auth_time reports the real sign-in moment', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  const { Session } = await import('../auth/session.model');
  const { SessionStore } = await import('../auth/session.store');

  // Age the session by an hour. `auth_time` is the moment the user authenticated, so
  // this is exactly what a browser session left open over lunch looks like.
  const sid = claimsOf(ctx!.sessionToken).sid as string;
  const authenticatedAt = new Date(Date.now() - 3_600_000);
  await Session.updateOne(
    { _id: SessionStore.handleOf(sid) },
    { $set: { createdAt: authenticatedAt } },
  );

  // Too old for the client's freshness requirement → back through sign-in.
  const stale = await authorize({ clientId: clients.prompts.id, maxAge: '60' });
  assert.equal(stale.status, 302);
  assert.match(locationOf(stale).pathname, /\/login$/);
  assert.equal(locationOf(stale).searchParams.get('prompt'), 'login');

  // ...and with prompt=none, where re-authentication is not permitted, that becomes the
  // error rather than a redirect to a page nobody is watching.
  const staleSilent = await authorize({
    clientId: clients.prompts.id,
    maxAge: '60',
    prompt: 'none',
  });
  assert.equal(staleSilent.status, 302);
  assert.equal(locationOf(staleSilent).searchParams.get('error'), 'login_required');

  // Within the window: the flow proceeds, and auth_time is the backdated moment rather
  // than "now" — the whole point of the claim.
  const verifier = randomBase64Url(32);
  const { code } = await consentAndGetCode(clients.prompts.id, 'openid email', verifier);
  const res = await redeem(code, verifier, {
    clientId: clients.prompts.id,
    clientSecret: clients.prompts.secret,
  });
  assert.equal(res.status, 200);
  const tokens = (await res.json()) as { id_token: string; access_token: string };

  const expectedAuthTime = Math.floor(authenticatedAt.getTime() / 1_000);
  assert.equal(
    claimsOf(tokens.id_token).auth_time,
    expectedAuthTime,
    'auth_time is when the user signed in, not when the token was minted',
  );
  assert.equal(claimsOf(tokens.access_token).auth_time, expectedAuthTime);
  assert.ok(
    (claimsOf(tokens.id_token).iat as number) > expectedAuthTime,
    'and it is demonstrably older than the issuance time',
  );

  const fresh = await authorize({ clientId: clients.prompts.id, scope: 'openid email', maxAge: '7200' });
  assert.ok(locationOf(fresh).searchParams.get('code'), 'a satisfied max_age does not interrupt');
});

// ── 4. Authorize error handling ──────────────────────────────────────────────

test('authorize redirects protocol errors and renders only what it cannot attribute', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  // Valid client + registered redirect_uri → every error goes back to the callback,
  // because a conforming client is waiting there and cannot read a JSON body.
  const badResponseType = await authorize({ clientId: clients.prompts.id, responseType: 'token' });
  assert.equal(badResponseType.status, 302);
  assert.equal(locationOf(badResponseType).searchParams.get('error'), 'unsupported_response_type');

  const missingOpenid = await authorize({ clientId: clients.prompts.id, scope: 'email profile' });
  assert.equal(missingOpenid.status, 302);
  assert.equal(locationOf(missingOpenid).searchParams.get('error'), 'invalid_scope');

  const badPrompt = await authorize({ clientId: clients.prompts.id, prompt: 'nonsense' });
  assert.equal(badPrompt.status, 302);
  assert.equal(locationOf(badPrompt).searchParams.get('error'), 'invalid_request');

  const badMaxAge = await authorize({ clientId: clients.prompts.id, maxAge: 'soon' });
  assert.equal(badMaxAge.status, 302);
  assert.equal(locationOf(badMaxAge).searchParams.get('error'), 'invalid_request');

  const conflictingPrompt = await authorize({ clientId: clients.prompts.id, prompt: 'none login' });
  assert.equal(conflictingPrompt.status, 302);
  assert.equal(locationOf(conflictingPrompt).searchParams.get('error'), 'invalid_request');

  // An unregistered redirect_uri is the one thing that must NOT be redirected to —
  // that is the definition of an open redirector.
  const badRedirect = await authorize({
    clientId: clients.prompts.id,
    redirectUri: 'http://evil.example/cb',
  });
  assert.equal(badRedirect.status, 400);
  assert.equal(((await badRedirect.json()) as { error: string }).error, 'invalid_request');

  // Nor is an unknown client_id, for the same reason.
  const unknownClient = await authorize({ clientId: 'cl_does_not_exist' });
  assert.equal(unknownClient.status, 400);
  assert.equal(((await unknownClient.json()) as { error: string }).error, 'invalid_client');
});
