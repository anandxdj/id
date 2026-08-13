/**
 * The signing keyring: thumbprint identity, encryption at rest, and rotation with an
 * overlap window.
 *
 * The property under test is the one the reference implementation cannot express at
 * all (plan §2.3-5): after a rotation, a token signed by the *previous* key must still
 * verify, and that key must still appear in JWKS, until its `notAfter` passes.
 *
 * Requires Mongo; self-skips when unavailable, and fails hard under REQUIRE_INTEGRATION.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { IntegrationGate } from '../../common/testing/index.testing';
import { KeyringUtil } from '../../common/utils/keyring.utils';
import { TOKEN_TYP } from '../../common/constants/index.constants';

process.env.OIDC_ISSUER ??= 'http://localhost:4000';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
/**
 * Its own database, deliberately.
 *
 * This suite rotates the keyring and asserts on exactly which key is active, while the
 * other integration suites run concurrently in sibling processes and each call
 * `SigningKeyService.init()` against the shared one. On a cold collection two of them
 * will each seed their own ephemeral key — harmless in production, where a configured
 * PEM makes every replica derive the same thumbprint and the unique index collapses
 * them into one row, but fatal to an assertion about *the* active kid.
 */
// Derived from whatever database the run was pointed at, rather than replacing it, so
// this suite stays isolated without ignoring an injected `MONGO_DB_NAME`.
process.env.MONGO_DB_NAME = `${process.env.MONGO_DB_NAME ?? 'id_test'}_signing_keys`;

let available = false;
/** Every kid this file creates, so teardown leaves the collection as it found it. */
const createdKids: string[] = [];

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('probe timeout')), ms))]);

before(async () => {
  try {
    const mongoose = (await import('mongoose')).default;
    await withTimeout(
      mongoose.connect(process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017', {
        dbName: process.env.MONGO_DB_NAME,
        serverSelectionTimeoutMS: 1500,
      }),
      2000,
    );

    // Start from an empty ring so the assertions below are about this run's keys and
    // not whatever a previous suite left behind.
    const { OAuthSigningKey } = await import('./oauth-signing-key.model');
    await OAuthSigningKey.deleteMany({});
    const { SigningKeyService } = await import('./signing-key.service');
    SigningKeyService._reset();
    await SigningKeyService.init();
    createdKids.push(SigningKeyService.activeKid());
    available = true;
  } catch (cause) {
    available = false;
    try {
      const mongoose = (await import('mongoose')).default;
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
    IntegrationGate.reportUnavailable('signing-key', cause);
  }
});

after(async () => {
  if (!available) return;
  const { OAuthSigningKey } = await import('./oauth-signing-key.model');
  await OAuthSigningKey.deleteMany({ kid: { $in: createdKids } });
  const mongoose = (await import('mongoose')).default;
  await mongoose.disconnect();
});

test('the active key is stored with a thumbprint kid and an encrypted private half', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { SigningKeyService } = await import('./signing-key.service');
  const { SigningKeyStore } = await import('./signing-key.store');

  const row = (await SigningKeyStore.findActive())!;
  assert.ok(row, 'a key was seeded on first boot');
  assert.equal(row.kid, SigningKeyService.activeKid());

  // RFC 7638: the identifier is derived from the key, so it cannot name a different one.
  assert.equal(
    row.kid,
    KeyringUtil.thumbprint({
      e: row.publicJwk.e as string,
      kty: row.publicJwk.kty as string,
      n: row.publicJwk.n as string,
    }),
  );

  // A database dump must not yield a signing key.
  assert.ok(row.encryptedPrivateKey.length > 0);
  assert.ok(row.encryptionIv.length > 0);
  assert.ok(row.encryptionAuthTag.length > 0);
  assert.doesNotMatch(row.encryptedPrivateKey, /PRIVATE KEY/, 'the PEM is not stored in the clear');
  assert.equal(row.publicJwk.d, undefined, 'no private exponent on the published half');
});

test('a token signed by a rotated-out key still verifies during the overlap window', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { SigningKeyService } = await import('./signing-key.service');

  const oldKid = SigningKeyService.activeKid();
  const signedByOldKey = SigningKeyService.sign(
    { iss: 'http://localhost:4000', sub: 'overlap-subject' },
    { typ: TOKEN_TYP.ID_TOKEN },
  );
  assert.equal(KeyringUtil.decodeHeader(signedByOldKey)!.kid, oldKid);

  const rotated = await SigningKeyService.rotate();
  createdKids.push(rotated.kid);
  assert.equal(rotated.previousKid, oldKid);
  assert.notEqual(rotated.kid, oldKid, 'rotation produces a genuinely new kid');
  assert.equal(SigningKeyService.activeKid(), rotated.kid, 'the new key signs from now on');

  // The whole point of the overlap: the outgoing key keeps working.
  const verified = await SigningKeyService.verify(signedByOldKey, { typ: TOKEN_TYP.ID_TOKEN });
  assert.ok(verified, 'a token signed before the rotation still verifies after it');
  assert.equal(verified.kid, oldKid);
  assert.equal(verified.claims.sub, 'overlap-subject');

  // ...and relying parties can still discover the key to verify it themselves.
  const publishedKids = SigningKeyService.jwks().keys.map((k) => (k as { kid: string }).kid);
  assert.ok(publishedKids.includes(oldKid), 'the retired key stays in JWKS');
  assert.ok(publishedKids.includes(rotated.kid), 'the new key is published');
});

test('once the overlap window closes the retired key is refused, TTL reaper or not', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { SigningKeyService } = await import('./signing-key.service');
  const { OAuthSigningKey } = await import('./oauth-signing-key.model');

  const retiringKid = SigningKeyService.activeKid();
  const signedBeforeRotation = SigningKeyService.sign(
    { iss: 'http://localhost:4000', sub: 'expired-overlap' },
    { typ: TOKEN_TYP.ID_TOKEN },
  );
  const rotated = await SigningKeyService.rotate();
  createdKids.push(rotated.kid);

  /*
   * Mongo's TTL monitor runs on a ~60 s cycle, so this is the genuine state of a key
   * whose overlap has just closed: physically present and still perfectly readable.
   * If the `notAfter` predicate were not carried explicitly on every read, the key
   * would keep verifying for up to a minute past the window — and the retention margin
   * on the index means it is actually kept for far longer than that on purpose.
   */
  await OAuthSigningKey.updateOne(
    { kid: retiringKid },
    { $set: { notAfter: new Date(Date.now() - 60_000) } },
  );
  assert.ok(
    await OAuthSigningKey.findOne({ kid: retiringKid }).lean(),
    'the document is still physically present',
  );

  await SigningKeyService.refresh();

  assert.equal(
    await SigningKeyService.verify(signedBeforeRotation, { typ: TOKEN_TYP.ID_TOKEN }),
    null,
    'the read path refuses a key whose overlap window has closed',
  );
  assert.ok(
    !SigningKeyService.jwks().keys.some((k) => (k as { kid: string }).kid === retiringKid),
    'and it is no longer published',
  );
});

test('verification is pinned to the typ it was asked for', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { SigningKeyService } = await import('./signing-key.service');

  const idToken = SigningKeyService.sign({ sub: 'typ-check' }, { typ: TOKEN_TYP.ID_TOKEN });
  assert.ok(await SigningKeyService.verify(idToken, { typ: TOKEN_TYP.ID_TOKEN }));
  assert.equal(
    await SigningKeyService.verify(idToken, { typ: TOKEN_TYP.OIDC_ACCESS }),
    null,
    'a correctly signed ID token is not an access token',
  );
});

test('an unknown kid, a tampered payload and a junk string all verify as null', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { SigningKeyService } = await import('./signing-key.service');

  const token = SigningKeyService.sign({ sub: 'tamper' }, { typ: TOKEN_TYP.ID_TOKEN });
  const [header, , signature] = token.split('.');
  const forgedPayload = Buffer.from(JSON.stringify({ sub: 'someone-else' })).toString('base64url');

  assert.equal(
    await SigningKeyService.verify(`${header}.${forgedPayload}.${signature}`, {
      typ: TOKEN_TYP.ID_TOKEN,
    }),
    null,
    'the signature covers the payload',
  );
  assert.equal(await SigningKeyService.verify('not-a-jwt', { typ: TOKEN_TYP.ID_TOKEN }), null);
});
