import { randomBytes } from 'node:crypto';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import type { Algorithm } from '@node-rs/argon2';
import bcrypt from 'bcryptjs';
import { Config } from '../../common/config/config';
import { Logger } from '../../common/logger/index.logger';
import {
  CRYPTO,
  PASSWORD_ALGORITHMS,
  PASSWORD_HASH_PREFIXES,
  PASSWORD_HASH_SLOW_MS,
  UV_THREADPOOL_MIN_FOR_ARGON2,
} from '../../common/constants/index.constants';
import type { PasswordAlgorithm } from '../../common/constants/index.constants';

/**
 * Password hashing. Argon2id for everything we write, bcrypt for verification only.
 *
 * **Why the native binding.** `bcryptjs` is the pure-JS build: slower than native for
 * equivalent work *and* fully synchronous, so every login blocked the event loop for the
 * whole KDF — a direct violation of house rule 5 and, on an authentication API, a
 * self-service denial of service. `@node-rs/argon2` runs the KDF on libuv's thread pool,
 * so the loop stays free. It ships prebuilt binaries, which is why it is preferred over
 * `argon2`: that one needs node-gyp, and a password hash is not worth putting a C++
 * toolchain into the production image.
 *
 * **Why no `algorithm` column on the user.** An Argon2 PHC string carries its own
 * parameters (`$argon2id$v=19$m=65536,t=3,p=4$…`) and bcrypt carries its cost, so the
 * stored hash is self-describing. A denormalised algorithm field could disagree with the
 * hash it claims to describe; this cannot.
 *
 * **Upgrades are not a migration.** There is no forced reset and no batch job — cost
 * parameters live in config, `needsRehash` compares the stored hash against them, and the
 * caller rehashes on the next successful login. Raising `ARGON2_MEMORY_KIB` therefore
 * upgrades the estate organically. The reference implementation has no upgrade path at
 * all, which is what makes its cost parameters effectively permanent.
 */

interface Argon2Params {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
}

/** Internal: the configured cost, as the binding wants it. */
const _params = (): Argon2Params & { algorithm: Algorithm } => ({
  ...Config.password.argon2,
  // The binding's default is Argon2id but at m=19456,t=2,p=1 — far below what we want, so
  // both the variant and the cost are passed explicitly and a library default change can
  // never silently weaken us. The cast is forced by the enum being ambient and `const`;
  // `warmup()` asserts the resulting hash really is Argon2id.
  algorithm: CRYPTO.ARGON2_ALGORITHM_ID as Algorithm,
});

/**
 * Internal: parse the cost out of an Argon2 PHC string.
 *
 * Returns `null` for anything that is not a well-formed Argon2id header, which
 * `needsRehash` deliberately treats as "rehash it" — an unparseable hash is either a
 * foreign format or corruption, and both want replacing at the next opportunity.
 */
const _parseArgon2Params = (hash: string): Argon2Params | null => {
  const match = /^\$argon2id\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(hash);
  if (!match) return null;
  return {
    memoryCost: Number(match[2]),
    timeCost: Number(match[3]),
    parallelism: Number(match[4]),
  };
};

/**
 * Internal: a throwaway Argon2id hash used to spend the same CPU on a login for an
 * address that does not exist as one that does.
 *
 * Built from random bytes rather than a fixed constant, and rebuilt whenever the cost
 * parameters change, so the comparison a stranger's login triggers is indistinguishable
 * in cost from a real one. Cached because generating it per request would make the
 * unknown-user path *slower* than the known-user path — an inverted oracle.
 */
let _dummyHash: { key: string; value: string } | undefined;

const _paramKey = (params: Argon2Params): string =>
  `${params.memoryCost}:${params.timeCost}:${params.parallelism}`;

export const PasswordService = {
  /** Which format a stored hash is in. Derived from the hash itself, never stored. */
  identify(hash: string | undefined | null): PasswordAlgorithm {
    if (!hash) return PASSWORD_ALGORITHMS.UNKNOWN;
    if (hash.startsWith(PASSWORD_HASH_PREFIXES.ARGON2ID)) return PASSWORD_ALGORITHMS.ARGON2ID;
    if (PASSWORD_HASH_PREFIXES.BCRYPT.some((prefix) => hash.startsWith(prefix))) {
      return PASSWORD_ALGORITHMS.BCRYPT;
    }
    return PASSWORD_ALGORITHMS.UNKNOWN;
  },

  /** Hash a plaintext password with the configured Argon2id cost. */
  async hash(plaintext: string): Promise<string> {
    return argon2Hash(plaintext, _params());
  },

  /**
   * Verify a candidate against a stored hash of either format.
   *
   * Never throws: a malformed or foreign hash is a failed verification, not a 500. The
   * alternative — letting the binding's parse error escape — would turn one corrupt row
   * into an error response that distinguishes it from a wrong password.
   */
  async verify(hash: string | undefined | null, candidate: string): Promise<boolean> {
    if (!hash) return false;
    try {
      switch (this.identify(hash)) {
        case PASSWORD_ALGORITHMS.ARGON2ID:
          return await argon2Verify(hash, candidate);
        // Verify-only fallback for hashes written before the Argon2 migration. Still
        // blocking, but it now runs at most once per legacy user, because a successful
        // login rehashes them to Argon2id (see `needsRehash`).
        case PASSWORD_ALGORITHMS.BCRYPT:
          return await bcrypt.compare(candidate, hash);
        default:
          return false;
      }
    } catch (error) {
      Logger.warn('Password verification failed to evaluate the stored hash', {
        algorithm: this.identify(hash),
        error,
      });
      return false;
    }
  },

  /**
   * Should this hash be replaced on the next successful login?
   *
   * True for every bcrypt hash, and for any Argon2 hash weaker than the current config
   * in any dimension. Deliberately one-directional: *lowering* the configured cost does
   * not rewrite stronger existing hashes, because that would be a downgrade dressed up
   * as maintenance.
   */
  needsRehash(hash: string | undefined | null): boolean {
    if (!hash) return false;
    if (this.identify(hash) !== PASSWORD_ALGORITHMS.ARGON2ID) return true;

    const stored = _parseArgon2Params(hash);
    if (!stored) return true;

    const target = Config.password.argon2;
    return (
      stored.memoryCost < target.memoryCost ||
      stored.timeCost < target.timeCost ||
      stored.parallelism < target.parallelism
    );
  },

  /**
   * Spend a real verification's worth of CPU on a login whose email does not exist.
   *
   * Without this, "no such user" returns in microseconds while a wrong password takes
   * tens of milliseconds, and the difference is a user-enumeration oracle that needs no
   * error-message differences to exploit. The reference implementation has exactly this
   * hole (§2.3-13).
   */
  async verifyDummy(candidate: string): Promise<false> {
    const params = Config.password.argon2;
    const key = _paramKey(params);
    if (_dummyHash?.key !== key) {
      _dummyHash = { key, value: await this.hash(randomBytes(CRYPTO.TOKEN_BYTES.ACTION_TOKEN).toString('hex')) };
    }
    await this.verify(_dummyHash.value, candidate);
    return false;
  },

  /**
   * Boot-time: pre-load the native binding, publish the effective cost, and measure it.
   *
   * Three things this earns, all of which would otherwise be discovered in production:
   * the first real login does not pay the module-load cost; the operator can see the
   * parameters actually in force rather than the ones they believe they set; and the
   * measured hash time appears in the boot log, so a mistuned box is obvious immediately
   * instead of showing up as p99 latency a week later.
   */
  async warmup(): Promise<void> {
    const params = Config.password.argon2;
    const started = Date.now();
    const sample = await this.hash(randomBytes(CRYPTO.TOKEN_BYTES.ACTION_TOKEN).toString('hex'));
    const durationMs = Date.now() - started;

    // The variant is passed to the binding as a bare number, because its enum is ambient and
    // cannot be imported (see `CRYPTO.ARGON2_ALGORITHM_ID`). This is the check that makes
    // that acceptable: refuse to boot rather than hash every password with Argon2i or
    // Argon2d because an upstream enum was renumbered.
    if (this.identify(sample) !== PASSWORD_ALGORITHMS.ARGON2ID) {
      throw new Error(
        `Argon2 produced an unexpected hash variant — CRYPTO.ARGON2_ALGORITHM_ID (${CRYPTO.ARGON2_ALGORITHM_ID}) no longer selects Argon2id`,
      );
    }

    // Priming the dummy hash here too, so the *first* unknown-user login is already
    // cost-matched rather than paying an extra hash to build the dummy.
    await this.verifyDummy('warmup');

    Logger.info('Password hashing ready', {
      algorithm: PASSWORD_ALGORITHMS.ARGON2ID,
      memoryKib: params.memoryCost,
      timeCost: params.timeCost,
      parallelism: params.parallelism,
      durationMs,
    });

    if (durationMs > PASSWORD_HASH_SLOW_MS) {
      Logger.warn('Password hashing is slow — every login pays this, and a burst queues', {
        durationMs,
        budgetMs: PASSWORD_HASH_SLOW_MS,
      });
    }

    // libuv sizes its pool on first use, so this can only be reported, never fixed from
    // here. An undersized pool does not just slow hashing down: `dns.lookup` shares it,
    // and that is what a Mongo or Redis reconnect needs during an outage.
    const poolSize = Config.password.uvThreadpoolSize;
    if (poolSize === undefined || poolSize < UV_THREADPOOL_MIN_FOR_ARGON2) {
      Logger.warn(
        'UV_THREADPOOL_SIZE is below the Argon2 floor — concurrent logins will queue ahead of DNS and filesystem work',
        { configured: poolSize ?? 'default(4)', recommendedMinimum: UV_THREADPOOL_MIN_FOR_ARGON2 },
      );
    }
  },
};
