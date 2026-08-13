/**
 * Password hashing: Argon2id, the verify-only bcrypt fallback, the upgrade rule, and the
 * timing defence.
 *
 * No datastore required — this is the one M2 suite that is pure computation, which is why
 * the timing assertions live here: they measure the KDF itself rather than a round trip
 * through Express and Mongo, so they mean something on a loaded machine.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { Config } from '../../common/config/config';
import {
  CRYPTO,
  PASSWORD_ALGORITHMS,
  PASSWORD_HASH_PREFIXES,
} from '../../common/constants/index.constants';
import { PasswordService } from './password.service';

process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';

const PASSWORD = 'correct-horse-battery-staple';

/** Median rather than mean: one scheduler hiccup should not decide a timing assertion. */
const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
};

const timeOf = async (fn: () => Promise<unknown>): Promise<number> => {
  const started = process.hrtime.bigint();
  await fn();
  return Number(process.hrtime.bigint() - started) / 1e6;
};

before(async () => {
  // Pay the native module load and the dummy-hash construction once, up front, so neither
  // lands inside a measurement.
  await PasswordService.warmup();
});

test('hashes with Argon2id at the configured cost, and the digest is self-describing', async () => {
  const hash = await PasswordService.hash(PASSWORD);
  const { memoryCost, timeCost, parallelism } = Config.password.argon2;

  assert.ok(hash.startsWith(PASSWORD_HASH_PREFIXES.ARGON2ID), 'Argon2id, not Argon2i or Argon2d');
  assert.equal(PasswordService.identify(hash), PASSWORD_ALGORITHMS.ARGON2ID);

  // The parameters are in the hash, which is what makes an `algorithm` column unnecessary
  // and `needsRehash` possible without one.
  assert.match(hash, new RegExp(`\\$m=${memoryCost},t=${timeCost},p=${parallelism}\\$`));
  assert.equal(memoryCost, CRYPTO.ARGON2.memoryCost, 'defaults are the OWASP-current values');

  assert.equal(await PasswordService.verify(hash, PASSWORD), true);
  assert.equal(await PasswordService.verify(hash, 'wrong'), false);

  // Two hashes of the same password differ — the salt is per-hash, so a database dump does
  // not reveal which accounts share a password.
  assert.notEqual(await PasswordService.hash(PASSWORD), hash);
});

test('verifies legacy bcrypt digests, and flags every one of them for upgrade', async () => {
  const legacy = await bcrypt.hash(PASSWORD, CRYPTO.LEGACY_BCRYPT_ROUNDS);

  assert.equal(PasswordService.identify(legacy), PASSWORD_ALGORITHMS.BCRYPT);
  assert.equal(await PasswordService.verify(legacy, PASSWORD), true, 'fallback still verifies');
  assert.equal(await PasswordService.verify(legacy, 'wrong'), false);
  assert.equal(PasswordService.needsRehash(legacy), true, 'and is due for replacement');
});

test('needsRehash upgrades on a raised cost and refuses to downgrade on a lowered one', async () => {
  const current = await PasswordService.hash(PASSWORD);
  assert.equal(PasswordService.needsRehash(current), false, 'a current hash is left alone');

  // A hash written when the memory cost was lower. Raising the configured cost has to make
  // this true, or the setting is decorative — the reference implementation has no upgrade
  // path at all, so its parameters are effectively frozen at whatever shipped first.
  const weaker = current.replace(
    /\$m=\d+,t=(\d+),p=(\d+)\$/,
    `$$m=${CRYPTO.ARGON2.memoryCost - 1024},t=$1,p=$2$$`,
  );
  assert.equal(PasswordService.needsRehash(weaker), true, 'weaker memory cost is upgraded');

  const fewerPasses = current.replace(/,t=\d+,/, `,t=${CRYPTO.ARGON2.timeCost - 1},`);
  assert.equal(PasswordService.needsRehash(fewerPasses), true, 'weaker time cost is upgraded');

  // Deliberately one-directional: a *stronger* stored hash is not rewritten, because that
  // would be a downgrade performed on the user's behalf.
  const stronger = current.replace(
    /\$m=\d+,/,
    `$$m=${CRYPTO.ARGON2.memoryCost * 2},`,
  );
  assert.equal(PasswordService.needsRehash(stronger), false, 'a stronger hash is not downgraded');

  assert.equal(PasswordService.needsRehash('$argon2id$garbage'), true, 'unparseable → replace');
  assert.equal(PasswordService.needsRehash(undefined), false, 'no password → nothing to do');
});

test('a malformed stored hash is a failed verification, not an exception', async () => {
  for (const bad of ['', 'not-a-hash', '$argon2id$v=19$broken', '$2a$notbcrypt']) {
    assert.equal(await PasswordService.verify(bad, PASSWORD), false, `refused: ${bad}`);
  }
  assert.equal(await PasswordService.verify(undefined, PASSWORD), false);
});

/**
 * The timing claim, measured rather than assumed.
 *
 * Without `verifyDummy`, the unknown-address branch of login returns without touching a KDF
 * — microseconds against tens of milliseconds — and that gap is a user-enumeration oracle
 * that no amount of identical error copy can close. The assertion is a ratio rather than an
 * absolute, because the absolute depends on the machine; the ratio is what an attacker
 * actually measures.
 */
test('the dummy comparison costs the same as a real one, at the real Argon2id cost', async () => {
  const realHash = await PasswordService.hash(PASSWORD);
  const SAMPLES = 7;

  const real: number[] = [];
  const dummy: number[] = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    real.push(await timeOf(() => PasswordService.verify(realHash, 'wrong-password')));
    dummy.push(await timeOf(() => PasswordService.verifyDummy('wrong-password')));
  }

  const realMs = median(real);
  const dummyMs = median(dummy);

  // Sanity: the cost is real. If a verification were free, the comparison below would pass
  // trivially and prove nothing.
  assert.ok(realMs > 1, `a real verification is measurably expensive (${realMs.toFixed(1)}ms)`);

  const ratio = dummyMs / realMs;
  assert.ok(
    ratio > 0.5 && ratio < 2,
    `dummy/real timing ratio ${ratio.toFixed(2)} (real ${realMs.toFixed(1)}ms, dummy ${dummyMs.toFixed(1)}ms) — must be within 0.5–2×; without the dummy hash it is orders of magnitude below 1`,
  );
});
