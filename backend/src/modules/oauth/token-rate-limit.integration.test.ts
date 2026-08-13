/**
 * Token-endpoint rate limiter keying: per presented `client_id` rather than per source
 * address, and the proof that keying on a caller-supplied identifier did not turn the
 * limiter into a client-existence oracle.
 *
 * Requires Mongo + Redis; self-skips when unavailable, fails hard under
 * REQUIRE_INTEGRATION.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ClientSecretUtil } from '../../common/utils/clientSecret.utils';
import { hashToken } from '../../common/utils/crypto.utils';
import { IntegrationGate, OidcHarness } from '../../common/testing/index.testing';
import type { HarnessContext } from '../../common/testing/index.testing';
import {
  RATE_LIMIT_KEY_HASH_LENGTH,
  RATE_LIMIT_KEY_KINDS,
  RATE_LIMIT_SCOPES,
  REDIS_KEYS,
  TOKEN_RATE_LIMITS,
} from '../../common/constants/index.constants';

process.env.OIDC_ISSUER ??= 'http://localhost:4000';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.MONGO_DB_NAME ??= 'id_test';

const EMAIL = 'token-rate-limit@tabbio.com';
const PASSWORD = 'sup3r-secret-pw';
const REDIRECT_URI = 'http://localhost:3001/cb';

/** A syntactically plausible `client_id` that is guaranteed not to exist. */
const ABSENT_CLIENT_ID = 'cl_absolutelyNotARegisteredClient';

let ctx: HarnessContext | undefined;
let available = false;
const created: string[] = [];

const real = { id: '', secret: '' };
let second = '';
let redisCommand: typeof import('../../common/config/redis').redisCommand;

const TOKEN_PREFIX = `${REDIS_KEYS.RATE_LIMIT}${RATE_LIMIT_SCOPES.TOKEN}:`;

before(async () => {
  try {
    ctx = await OidcHarness.start({ email: EMAIL, password: PASSWORD, name: 'Limiter Subject' });
    redisCommand = (await import('../../common/config/redis')).redisCommand;
    const clientService = await import('../oauth-client/oauth-client.service');

    const primary = await clientService.create({
      clientName: 'Limiter Primary',
      redirectUris: [REDIRECT_URI],
    });
    real.id = primary.clientId;
    real.secret = primary.clientSecret!;
    created.push(primary.clientId);

    const other = await clientService.create({
      clientName: 'Limiter Second',
      redirectUris: [REDIRECT_URI],
    });
    second = other.clientId;
    created.push(other.clientId);

    available = true;
  } catch (cause) {
    available = false;
    await OidcHarness.abandon();
    IntegrationGate.reportUnavailable('token-rate-limit', cause);
  }
});

after(async () => {
  if (available) await OidcHarness.stop(ctx, { email: EMAIL, clientIds: created });
  else ctx?.server.close();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const clearCounters = (): Promise<void> => OidcHarness.clearRateLimitCounters();

const tokenKeys = async (): Promise<string[]> => {
  const keys = (await redisCommand(['KEYS', `${TOKEN_PREFIX}*`])) as string[];
  return (Array.isArray(keys) ? keys : []).sort();
};

const counterFor = async (suffix: string): Promise<number> => {
  const value = (await redisCommand(['GET', `${TOKEN_PREFIX}${suffix}`])) as string | null;
  return value === null ? 0 : Number(value);
};

const clientKeySuffix = (clientId: string): string =>
  `${RATE_LIMIT_KEY_KINDS.CLIENT}:${hashToken(clientId).slice(0, RATE_LIMIT_KEY_HASH_LENGTH)}`;

/** A token request as the given client. `undefined` presents no `client_id` at all. */
const tokenRequest = (clientId?: string, secret?: string): Promise<Response> => {
  const body: Record<string, string> = {
    grant_type: 'authorization_code',
    code: 'not-a-real-code',
    redirect_uri: REDIRECT_URI,
    code_verifier: 'x'.repeat(43),
  };
  if (clientId) body.client_id = clientId;
  if (secret) body.client_secret = secret;

  return fetch(`${ctx!.base}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
};

/**
 * Everything an unauthenticated caller can see about a response. `RateLimit-Reset` is
 * deliberately excluded: it counts down in whole seconds from whenever the window opened,
 * so it varies with wall-clock timing rather than with anything about the client.
 */
interface Observable {
  status: number;
  limit: string | null;
  remaining: string | null;
  wwwAuthenticate: string | null;
  body: string;
}

const observe = async (res: Response): Promise<Observable> => ({
  status: res.status,
  limit: res.headers.get('ratelimit-limit'),
  remaining: res.headers.get('ratelimit-remaining'),
  wwwAuthenticate: res.headers.get('www-authenticate'),
  body: await res.text(),
});

// ── Keying ───────────────────────────────────────────────────────────────────

test('a request presenting a client_id is counted against that client, not the address', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  await clearCounters();

  await tokenRequest(real.id, real.secret);

  const keys = await tokenKeys();
  assert.deepEqual(keys, [`${TOKEN_PREFIX}${clientKeySuffix(real.id)}`]);
  assert.equal(await counterFor(clientKeySuffix(real.id)), 1);
  // Nothing was charged to the source address — that is the NAT fix.
  assert.equal(await counterFor(`${RATE_LIMIT_KEY_KINDS.IP}:127.0.0.1`), 0);
});

test('a request presenting no client_id falls back to the address', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  await clearCounters();

  await tokenRequest();

  const [key, ...rest] = await tokenKeys();
  assert.equal(rest.length, 0);
  assert.ok(
    key?.startsWith(`${TOKEN_PREFIX}${RATE_LIMIT_KEY_KINDS.IP}:`),
    `expected an address-keyed counter, got ${key}`,
  );
});

test('the client_id is hashed into the key rather than interpolated raw', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  await clearCounters();

  // Caller-controlled input going into a shared keyspace: a raw id could carry a
  // delimiter or run to an unbounded length.
  await tokenRequest(real.id, real.secret);

  const [key] = await tokenKeys();
  assert.ok(key, 'a counter was created');
  assert.ok(!key.includes(real.id), 'raw client_id must not appear in the Redis key');
  // `<prefix><kind>:<digest>` — the digest is fixed width whatever the id looked like.
  assert.equal(key.slice(`${TOKEN_PREFIX}${RATE_LIMIT_KEY_KINDS.CLIENT}:`.length).length, RATE_LIMIT_KEY_HASH_LENGTH);
});

test('two clients from one address consume separate budgets', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  await clearCounters();

  // The availability bug in one assertion: with IP keying these three requests would
  // share a counter, so a busy tenant would starve its neighbours behind the same egress.
  await tokenRequest(real.id, real.secret);
  await tokenRequest(real.id, real.secret);
  await tokenRequest(second, 'wrong-secret');

  assert.equal(await counterFor(clientKeySuffix(real.id)), 2);
  assert.equal(await counterFor(clientKeySuffix(second)), 1);
});

test('a client authenticating with Basic is keyed the same as one using the body', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  await clearCounters();

  // The limiter and `ClientAuthService` read the credential through the same parser, so
  // the transport the client chose cannot change which bucket it lands in.
  const basic = Buffer.from(
    `${encodeURIComponent(real.id)}:${encodeURIComponent(real.secret)}`,
  ).toString('base64');
  await fetch(`${ctx!.base}/oauth/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: 'nope' }),
  });

  assert.equal(await counterFor(clientKeySuffix(real.id)), 1);
});

// ── Budgets ──────────────────────────────────────────────────────────────────

test('an identified client is given a larger budget than an anonymous caller', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  await clearCounters();

  const identified = await observe(await tokenRequest(real.id, real.secret));
  await clearCounters();
  const anonymous = await observe(await tokenRequest());

  assert.equal(identified.limit, String(TOKEN_RATE_LIMITS.PER_CLIENT.max));
  assert.equal(anonymous.limit, String(TOKEN_RATE_LIMITS.PER_IP.max));
  assert.notEqual(identified.limit, anonymous.limit);
});

// ── The limiter must not become a client-existence oracle ────────────────────

test('a registered and an unregistered client_id are indistinguishable to the caller', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  // The attack this forecloses: key on a *validated* client_id and the limiter starts
  // answering "is this client real?" through its budget, headers and status — leaking
  // exactly what `ClientAuthService` is careful never to disclose in its responses.
  // The key is derived from the presented string with no lookup, so the two cases are
  // byte-for-byte identical over a whole sequence of requests.
  const probes = 4;

  await clearCounters();
  const realRun: Observable[] = [];
  for (let i = 0; i < probes; i += 1) {
    realRun.push(await observe(await tokenRequest(real.id, 'wrong-secret')));
  }

  await clearCounters();
  const absentRun: Observable[] = [];
  for (let i = 0; i < probes; i += 1) {
    absentRun.push(await observe(await tokenRequest(ABSENT_CLIENT_ID, 'wrong-secret')));
  }

  for (let i = 0; i < probes; i += 1) {
    assert.deepEqual(
      absentRun[i],
      realRun[i],
      `request ${i + 1} distinguishes a real client_id from an absent one`,
    );
  }

  // Sanity: the sequence has to actually be moving, or "identical" proves nothing.
  const first = realRun[0];
  const last = realRun[probes - 1];
  assert.ok(first && last);
  assert.notEqual(first.remaining, last.remaining);
  assert.equal(first.status, 401);
});

test('an unregistered client_id gets its own counter, with the same budget', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  await clearCounters();

  // Both requests create a bucket; neither is treated as more or less real than the other.
  await tokenRequest(real.id, 'wrong-secret');
  await tokenRequest(ABSENT_CLIENT_ID, 'wrong-secret');

  assert.equal(await counterFor(clientKeySuffix(real.id)), 1);
  assert.equal(await counterFor(clientKeySuffix(ABSENT_CLIENT_ID)), 1);
});

test('exhausting an unregistered client_id does not touch a real one', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  await clearCounters();

  // The corollary of separate buckets: an attacker cannot lock a client out by spraying
  // its budget from outside, nor learn anything from the attempt.
  for (let i = 0; i < 3; i += 1) await tokenRequest(ABSENT_CLIENT_ID, 'wrong-secret');

  assert.equal(await counterFor(clientKeySuffix(ABSENT_CLIENT_ID)), 3);
  assert.equal(await counterFor(clientKeySuffix(real.id)), 0);

  const stillFine = await tokenRequest(real.id, real.secret);
  assert.notEqual(stillFine.status, 429);
});

// ── Robustness: the key generator is on the request path ─────────────────────

test('a malformed Basic header is counted and rejected, never a 500', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  await clearCounters();

  // The key generator runs before any handler, so anything it throws on becomes a
  // failure of the whole endpoint rather than a rejected credential.
  const malformed = ['not-base64-at-all!!', Buffer.from('no-colon-here').toString('base64'), ''];

  for (const credentials of malformed) {
    const res = await fetch(`${ctx!.base}/oauth/token`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: 'nope' }),
    });
    assert.ok(res.status < 500, `Basic "${credentials}" produced ${res.status}`);
  }

  // Unattributable, so it lands in the address bucket rather than vanishing uncounted.
  const keys = await tokenKeys();
  assert.ok(
    keys.every((key) => key.startsWith(`${TOKEN_PREFIX}${RATE_LIMIT_KEY_KINDS.IP}:`)),
    `malformed credentials must not mint a client bucket, got ${keys.join(', ')}`,
  );
});

test('a percent-escape that cannot be decoded is rejected rather than crashing', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  await clearCounters();

  // RFC 6749 §2.3.1 form-encodes both halves, so `decodeURIComponent` is unavoidable —
  // and it throws on a lone `%`.
  const credentials = Buffer.from('%E0%A4%A:secret').toString('base64');
  const res = await fetch(`${ctx!.base}/oauth/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: 'nope' }),
  });

  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'invalid_request');
});

// ── Revocation and introspection inherit the same keying ─────────────────────

test('revocation and introspection are keyed by client too', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');
  await clearCounters();

  // They take the same credential and the same kind of token, so they share the limiter.
  for (const path of ['/oauth/revoke', '/oauth/introspect']) {
    await fetch(`${ctx!.base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: real.id,
        client_secret: real.secret,
        token: ClientSecretUtil.generate(),
      }),
    });
  }

  assert.equal(await counterFor(clientKeySuffix(real.id)), 2);
});
