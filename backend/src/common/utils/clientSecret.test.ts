/**
 * Client secret digest: format, constant-time comparison, and the bcrypt fallback that
 * carries pre-migration clients forward.
 *
 * Pure crypto — no datastore, so this runs unconditionally.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { ClientSecretUtil } from './clientSecret.utils';
import { hashToken } from './crypto.utils';
import { CLIENT_SECRET_DIGEST, CRYPTO } from '../constants/index.constants';

test('generate: distinct, and carries the configured entropy', () => {
  const a = ClientSecretUtil.generate();
  const b = ClientSecretUtil.generate();

  assert.notEqual(a, b);
  // base64url of N bytes is ceil(N * 4 / 3) characters once padding is stripped.
  assert.equal(a.length, Math.ceil((CRYPTO.TOKEN_BYTES.CLIENT_SECRET * 4) / 3));
});

test('digest: SHA-256 hex, and stable for a given input', () => {
  const secret = ClientSecretUtil.generate();
  const digest = ClientSecretUtil.digest(secret);

  assert.equal(digest.length, CLIENT_SECRET_DIGEST.HEX_LENGTH);
  assert.match(digest, /^[0-9a-f]+$/);
  assert.equal(digest, ClientSecretUtil.digest(secret));
  // The same primitive every other high-entropy credential in the system is stored with.
  assert.equal(digest, hashToken(secret));
});

test('verify: accepts the right secret and rejects a wrong one, with no upgrade signalled', async () => {
  const secret = ClientSecretUtil.generate();
  const stored = ClientSecretUtil.digest(secret);

  assert.deepEqual(await ClientSecretUtil.verify(stored, secret), {
    ok: true,
    needsUpgrade: false,
  });
  assert.deepEqual(await ClientSecretUtil.verify(stored, ClientSecretUtil.generate()), {
    ok: false,
    needsUpgrade: false,
  });
});

test('verify: a secret differing only in its last character is rejected', async () => {
  const secret = ClientSecretUtil.generate();
  const stored = ClientSecretUtil.digest(secret);

  const nearMiss = `${secret.slice(0, -1)}${secret.endsWith('A') ? 'B' : 'A'}`;
  assert.equal((await ClientSecretUtil.verify(stored, nearMiss)).ok, false);
  // A prefix must not pass either — the comparison is over digests, not a prefix match.
  assert.equal((await ClientSecretUtil.verify(stored, secret.slice(0, -1))).ok, false);
});

test('verify: absent stored value or empty presented secret is a rejection, never a throw', async () => {
  const secret = ClientSecretUtil.generate();

  assert.deepEqual(await ClientSecretUtil.verify(undefined, secret), {
    ok: false,
    needsUpgrade: false,
  });
  assert.deepEqual(await ClientSecretUtil.verify(ClientSecretUtil.digest(secret), ''), {
    ok: false,
    needsUpgrade: false,
  });
});

test('verify: a truncated or non-hex stored digest is rejected rather than throwing', async () => {
  const secret = ClientSecretUtil.generate();
  const digest = ClientSecretUtil.digest(secret);

  // `timingSafeEqual` throws on a width mismatch and `Buffer.from(…, 'hex')` truncates
  // silently instead of reporting bad input, so both have to be caught before the compare.
  for (const corrupt of [digest.slice(0, 32), `${digest}00`, 'z'.repeat(64), '']) {
    const result = await ClientSecretUtil.verify(corrupt, secret);
    assert.equal(result.ok, false, `stored value ${JSON.stringify(corrupt)} must not verify`);
  }
});

test('isLegacy: discriminates bcrypt MCF from a SHA-256 digest', async () => {
  const secret = ClientSecretUtil.generate();

  assert.equal(ClientSecretUtil.isLegacy(ClientSecretUtil.digest(secret)), false);
  assert.equal(
    ClientSecretUtil.isLegacy(await bcrypt.hash(secret, CRYPTO.LEGACY_BCRYPT_ROUNDS)),
    true,
  );
});

test('verify: a bcrypt hash still authenticates, and asks to be upgraded', async () => {
  const secret = ClientSecretUtil.generate();
  const legacy = await bcrypt.hash(secret, CRYPTO.LEGACY_BCRYPT_ROUNDS);

  assert.deepEqual(await ClientSecretUtil.verify(legacy, secret), {
    ok: true,
    needsUpgrade: true,
  });
});

test('verify: a failed bcrypt comparison never asks for an upgrade', async () => {
  // The upgrade rewrites the stored digest from the presented plaintext, so licensing it
  // on a failed comparison would let any wrong guess overwrite the real credential.
  const legacy = await bcrypt.hash(ClientSecretUtil.generate(), CRYPTO.LEGACY_BCRYPT_ROUNDS);

  assert.deepEqual(await ClientSecretUtil.verify(legacy, ClientSecretUtil.generate()), {
    ok: false,
    needsUpgrade: false,
  });
});
