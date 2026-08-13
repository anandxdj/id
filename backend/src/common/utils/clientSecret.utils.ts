import { timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { hashToken, randomBase64Url } from './crypto.utils';
import { CLIENT_SECRET_DIGEST, CRYPTO } from '../constants/index.constants';

/**
 * Client secret generation and verification.
 *
 * Every piece of knowledge about the *stored format* lives here, so "what can be in
 * `clientSecretHash`?" has exactly one answer to audit, and the persistence layer above
 * never has to care.
 *
 * ## Why a digest and not a KDF
 *
 * The secret is `CRYPTO.TOKEN_BYTES.CLIENT_SECRET` bytes of CSPRNG output rendered
 * base64url. A password KDF's entire purpose is to make guessing expensive when the
 * input is drawn from a small, human-shaped distribution; against 384 bits of uniform
 * randomness there is no guess list to slow down, so the work factor buys no security
 * and is charged as latency on every single token exchange. Worse, the dependency here
 * is `bcryptjs` — the pure-JS build — which spends that time *blocking the event loop*,
 * so the cost is not even paid by the one request that asked for it.
 *
 * A bare SHA-256 is also what this codebase already does with every other high-entropy
 * bearer credential (`hashToken`, used for access, refresh and action tokens). The
 * client secret was the only one being treated like a password.
 *
 * The precondition is that secrets are always server-generated — see the note on
 * `CLIENT_SECRET_DIGEST`. `generate` is the only way to mint one, and there is no API
 * that accepts a caller-supplied secret.
 *
 * ## Why constant time still matters
 *
 * The stored value is a digest, so leaking it does not directly yield a usable secret.
 * But a byte-at-a-time comparison leaks *where* two values diverge, and a comparison
 * routine that is only sometimes constant-time is a footgun waiting for the next
 * credential to be checked with it. `timingSafeEqual` costs nothing here.
 */

/**
 * Internal: compare a stored hex digest against the digest of the presented secret,
 * in constant time with respect to the contents.
 *
 * `timingSafeEqual` throws on a length mismatch, which is the documented footgun. Both
 * operands are SHA-256 so lengths always agree in the normal case; the guard exists for
 * a stored value that has been truncated or corrupted, where `Buffer.from(…, 'hex')`
 * silently returns a short buffer rather than throwing. Rejecting on width leaks only
 * that the *stored* record is malformed, which is not a secret.
 */
const _constantTimeEqualsDigest = (stored: string, presented: string): boolean => {
  if (stored.length !== CLIENT_SECRET_DIGEST.HEX_LENGTH) return false;

  const storedBytes = Buffer.from(stored, 'hex');
  if (storedBytes.length !== CLIENT_SECRET_DIGEST.BYTE_LENGTH) return false;

  const presentedBytes = Buffer.from(hashToken(presented), 'hex');
  if (presentedBytes.length !== storedBytes.length) return false;

  return timingSafeEqual(storedBytes, presentedBytes);
};

export const ClientSecretUtil = {
  /** Mint a new secret. The only sanctioned source of client secret material. */
  generate(): string {
    return randomBase64Url(CRYPTO.TOKEN_BYTES.CLIENT_SECRET);
  },

  /** The value to store for a secret. SHA-256, hex. */
  digest(secret: string): string {
    return hashToken(secret);
  },

  /**
   * True when a stored value was produced by the pre-migration bcrypt path and must go
   * through the verify-only fallback.
   */
  isLegacy(stored: string): boolean {
    return stored.startsWith(CLIENT_SECRET_DIGEST.LEGACY_BCRYPT_PREFIX);
  },

  /**
   * Verify a presented secret against a stored value of either format.
   *
   * `needsUpgrade` is set when the match came from the bcrypt fallback, which is the
   * signal for the caller to rewrite the stored digest. It is only ever true alongside
   * `ok`: a failed comparison tells us nothing about whether the presented secret was
   * the right one, so it is not licence to overwrite anything.
   */
  async verify(
    stored: string | undefined,
    presented: string,
  ): Promise<{ ok: boolean; needsUpgrade: boolean }> {
    if (!stored || !presented) return { ok: false, needsUpgrade: false };

    if (this.isLegacy(stored)) {
      // Blocking, and knowingly so — this path runs at most once per client, on its
      // first successful authentication after deploy, and then rewrites itself away.
      const ok = await bcrypt.compare(presented, stored);
      return { ok, needsUpgrade: ok };
    }

    return { ok: _constantTimeEqualsDigest(stored, presented), needsUpgrade: false };
  },
};
