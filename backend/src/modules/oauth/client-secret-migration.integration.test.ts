/**
 * Client secret storage: the move off bcrypt onto a SHA-256 digest, and the lazy
 * migration that carries pre-existing clients across without re-registering them.
 *
 * `/oauth/introspect` is used as the probe throughout. It is the smallest endpoint on the
 * server that does nothing but authenticate a confidential client — 200 means the
 * credential was accepted, 401 means it was not — so these tests exercise client
 * authentication without dragging an authorize/consent/PKCE round-trip through every
 * assertion.
 *
 * Requires Mongo + Redis; self-skips when unavailable, fails hard under
 * REQUIRE_INTEGRATION.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { ClientSecretUtil } from '../../common/utils/clientSecret.utils';
import { IntegrationGate, OidcHarness } from '../../common/testing/index.testing';
import type { HarnessContext } from '../../common/testing/index.testing';
import { CLIENT_SECRET_DIGEST, CRYPTO } from '../../common/constants/index.constants';

process.env.OIDC_ISSUER ??= 'http://localhost:4000';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.MONGO_DB_NAME ??= 'id_test';

const EMAIL = 'client-secret-migration@tabbio.com';
const PASSWORD = 'sup3r-secret-pw';
const REDIRECT_URI = 'http://localhost:3001/cb';

let ctx: HarnessContext | undefined;
let available = false;
const created: string[] = [];

type ClientService = typeof import('../oauth-client/oauth-client.service');
let clientService: ClientService;
let OAuthClientModel: typeof import('../oauth-client/oauth-client.model').OAuthClient;

before(async () => {
  try {
    ctx = await OidcHarness.start({ email: EMAIL, password: PASSWORD, name: 'Secret Migration' });
    clientService = await import('../oauth-client/oauth-client.service');
    OAuthClientModel = (await import('../oauth-client/oauth-client.model')).OAuthClient;
    available = true;
  } catch (cause) {
    available = false;
    await OidcHarness.abandon();
    IntegrationGate.reportUnavailable('client-secret-migration', cause);
  }
});

after(async () => {
  if (available) await OidcHarness.stop(ctx, { email: EMAIL, clientIds: created });
  else ctx?.server.close();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const newClient = async (clientName: string): Promise<{ id: string; secret: string }> => {
  const client = await clientService.create({ clientName, redirectUris: [REDIRECT_URI] });
  created.push(client.clientId);
  return { id: client.clientId, secret: client.clientSecret! };
};

const storedHash = async (clientId: string): Promise<string | undefined> => {
  const doc = await OAuthClientModel.findOne({ clientId }).select('+clientSecretHash').lean();
  return doc?.clientSecretHash;
};

/** Overwrite the stored digest with a bcrypt hash, i.e. put the record back in its pre-M4 state. */
const downgradeToBcrypt = async (clientId: string, secret: string): Promise<string> => {
  const legacy = await bcrypt.hash(secret, CRYPTO.LEGACY_BCRYPT_ROUNDS);
  await OAuthClientModel.updateOne({ clientId }, { $set: { clientSecretHash: legacy } });
  return legacy;
};

/** Authenticate as a client and nothing more. 200 = credential accepted, 401 = rejected. */
const authenticateAs = (id: string, secret: string): Promise<Response> =>
  fetch(`${ctx!.base}/oauth/introspect`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, token: 'not-a-real-token' }),
  });

// ── Storage format ───────────────────────────────────────────────────────────

test('a newly registered client stores a SHA-256 digest, not a KDF hash', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  const client = await newClient('Digest Format');
  const hash = await storedHash(client.id);

  assert.equal(hash?.length, CLIENT_SECRET_DIGEST.HEX_LENGTH);
  assert.equal(ClientSecretUtil.isLegacy(hash!), false);
  // The digest is of the secret and nothing else — no salt, because there is no guess
  // list to defend against for 48 bytes of CSPRNG output.
  assert.equal(hash, ClientSecretUtil.digest(client.secret));
  // And the plaintext is nowhere in the record.
  assert.notEqual(hash, client.secret);
});

test('a rotated secret is stored as a digest, and only the new secret authenticates', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  const client = await newClient('Digest Rotation');
  const rotated = await clientService.rotateSecret(client.id);
  assert.ok(rotated);

  assert.equal(await storedHash(client.id), ClientSecretUtil.digest(rotated.clientSecret));
  assert.equal((await authenticateAs(client.id, rotated.clientSecret)).status, 200);
  assert.equal((await authenticateAs(client.id, client.secret)).status, 401);
});

// ── Lazy migration ───────────────────────────────────────────────────────────

test('a pre-migration bcrypt client authenticates, and its digest is rewritten in place', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  const client = await newClient('Legacy Upgrade');
  const legacy = await downgradeToBcrypt(client.id, client.secret);
  assert.equal(await storedHash(client.id), legacy, 'record starts in the pre-migration state');

  // The whole point of the migration: no re-registration, no rotation, the existing
  // secret keeps working.
  const first = await authenticateAs(client.id, client.secret);
  assert.equal(first.status, 200, 'the existing secret still authenticates');

  const after = await storedHash(client.id);
  assert.equal(ClientSecretUtil.isLegacy(after!), false, 'bcrypt hash was replaced');
  assert.equal(after, ClientSecretUtil.digest(client.secret));

  // The secret itself is unchanged, so the client is unaware any of this happened.
  assert.equal((await authenticateAs(client.id, client.secret)).status, 200);
});

test('a failed authentication against a legacy hash rewrites nothing', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  const client = await newClient('Legacy Wrong Secret');
  const legacy = await downgradeToBcrypt(client.id, client.secret);

  // If a wrong guess could trigger the rewrite, the guess would *become* the credential.
  const res = await authenticateAs(client.id, ClientSecretUtil.generate());
  assert.equal(res.status, 401);
  assert.equal(await storedHash(client.id), legacy, 'stored hash untouched by a failed attempt');

  // And the real secret is still the real secret.
  assert.equal((await authenticateAs(client.id, client.secret)).status, 200);
});

test('the upgrade is a compare-and-swap, so it cannot clobber a concurrent rotation', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  const client = await newClient('Upgrade CAS');
  const legacy = await downgradeToBcrypt(client.id, client.secret);

  // Model the interleaving: a request verifies against `legacy`, an administrator rotates
  // the secret, and only then does the upgrade write land. A blind `$set` would install a
  // digest of the *old* secret over the new one and lock the client out until it rotated
  // again; matching on the hash that was actually verified makes it a no-op instead.
  const rotated = await clientService.rotateSecret(client.id);
  assert.ok(rotated);

  const upgraded = await clientService.upgradeSecretDigest(client.id, legacy, client.secret);
  assert.equal(upgraded, false, 'stale upgrade did not apply');
  assert.equal(await storedHash(client.id), ClientSecretUtil.digest(rotated.clientSecret));
  assert.equal((await authenticateAs(client.id, rotated.clientSecret)).status, 200);
});

test('an upgrade for an unknown client or absent hash is a no-op, not a throw', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  assert.equal(await clientService.upgradeSecretDigest('cl_does_not_exist', 'whatever', 'x'), false);
  assert.equal(await clientService.upgradeSecretDigest('cl_does_not_exist', undefined, 'x'), false);
});

// ── Regression: the digest change must not weaken authentication ──────────────

test('a wrong secret is still rejected, and the digest is not accepted in place of the secret', async (t) => {
  if (!available) return t.skip('Mongo/Redis not reachable');

  const client = await newClient('Digest Not A Secret');

  assert.equal((await authenticateAs(client.id, ClientSecretUtil.generate())).status, 401);
  assert.equal((await authenticateAs(client.id, '')).status, 401);
  // Presenting the stored digest must not authenticate: it is compared against the digest
  // *of* the presented value, so a stolen database row is not a usable credential.
  const hash = await storedHash(client.id);
  assert.equal((await authenticateAs(client.id, hash!)).status, 401);
});
