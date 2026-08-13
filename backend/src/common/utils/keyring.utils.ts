import crypto from 'node:crypto';
import { CRYPTO, SIGNING_KEY } from '../constants/index.constants';

/**
 * Stateless cryptographic primitives for the OIDC signing keyring.
 *
 * Deliberately stateless and deliberately `node:crypto` rather than `node-jose`:
 *
 *  - Stateless, because the keyring itself is a Mongo-backed collection owned by
 *    `modules/oauth/signing-key.store.ts`. Putting key *state* in `common/` would
 *    invert the layering and give two modules a claim on the same rows.
 *  - `node:crypto`, because RS256 JWS is four lines of it, and the compact
 *    serialisation has to be built by hand anyway to control the `typ` header —
 *    which is the whole mechanism that stops an ID token being replayed as an
 *    access token.
 *
 * Nothing here touches the database, the clock, or configuration.
 */

const RSA_SIGN_ALGORITHM = 'RSA-SHA256';

/** Public members of an RSA JWK, in the exact order RFC 7638 §3.2 requires. */
export interface RsaPublicJwk {
  e: string;
  kty: string;
  n: string;
}

const b64url = (input: Buffer | string): string =>
  Buffer.from(input as never).toString('base64url');

// Internal: JSON with no insignificant whitespace, which is what RFC 7638 hashes.
const _canonicalJson = (jwk: RsaPublicJwk): string =>
  `{"e":${JSON.stringify(jwk.e)},"kty":${JSON.stringify(jwk.kty)},"n":${JSON.stringify(jwk.n)}}`;

export const KeyringUtil = {
  // ── Key material ───────────────────────────────────────────────────────────
  /** Fresh RSA key pair, returned as a PKCS#8 PEM. */
  generatePrivateKeyPem(): string {
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: SIGNING_KEY.RSA_MODULUS_LENGTH,
    });
    return privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  },

  /** Parse a PEM into a private `KeyObject`. Throws on anything malformed. */
  privateKeyFromPem(pem: string): crypto.KeyObject {
    return crypto.createPrivateKey(pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem);
  },

  /**
   * Public half of a private key, as the three RSA JWK members and nothing else.
   * Whitelisted rather than filtered: `export({ format: 'jwk' })` on a *private* key
   * also yields `d`, `p`, `q`, `dp`, `dq`, `qi`, and publishing any of them to the
   * JWKS endpoint would be the end of the world.
   */
  publicJwkOf(key: crypto.KeyObject): RsaPublicJwk {
    const jwk = crypto.createPublicKey(key).export({ format: 'jwk' }) as Record<string, string>;
    return { e: jwk.e as string, kty: jwk.kty as string, n: jwk.n as string };
  },

  publicKeyFromJwk(jwk: RsaPublicJwk): crypto.KeyObject {
    return crypto.createPublicKey({ key: jwk as unknown as crypto.JsonWebKey, format: 'jwk' });
  },

  /**
   * RFC 7638 JWK thumbprint: base64url(SHA-256(canonical JSON of the required members)).
   *
   * This is the `kid`. It is derived from the key, so two deployments holding the same
   * key agree on its identifier without coordinating, a key can never be silently
   * swapped behind a stable name, and rotation produces a genuinely new `kid` — the
   * reference's literal `"default"` fails all three.
   */
  thumbprint(jwk: RsaPublicJwk): string {
    return crypto.createHash('sha256').update(_canonicalJson(jwk), 'utf8').digest('base64url');
  },

  // ── Envelope encryption of private keys at rest ────────────────────────────
  /** Stretch the configured KEK secret into a 32-byte AES key. */
  deriveKek(secret: string): Buffer {
    return crypto.scryptSync(secret, SIGNING_KEY.KEK_SALT, SIGNING_KEY.CIPHER_KEY_BYTES);
  },

  encryptPrivateKey(pem: string, kek: Buffer): { ciphertext: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(SIGNING_KEY.CIPHER_IV_BYTES);
    const cipher = crypto.createCipheriv(SIGNING_KEY.CIPHER, kek, iv);
    const ciphertext = Buffer.concat([cipher.update(pem, 'utf8'), cipher.final()]);
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  },

  /**
   * Reverse of the above. GCM authenticates, so a tampered ciphertext throws rather
   * than yielding a wrong-but-plausible key — the caller treats a throw as "this row
   * was written under a different KEK, or someone edited it".
   */
  decryptPrivateKey(
    envelope: { ciphertext: string; iv: string; authTag: string },
    kek: Buffer,
  ): string {
    const decipher = crypto.createDecipheriv(
      SIGNING_KEY.CIPHER,
      kek,
      Buffer.from(envelope.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  },

  // ── Compact JWS ────────────────────────────────────────────────────────────
  /** Sign a compact RS256 JWS. `header` must already carry `alg`, `typ` and `kid`. */
  signCompact(
    header: Record<string, unknown>,
    payload: Record<string, unknown>,
    privateKey: crypto.KeyObject,
  ): string {
    const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
    const signature = crypto
      .createSign(RSA_SIGN_ALGORITHM)
      .update(signingInput, 'utf8')
      .sign(privateKey);
    return `${signingInput}.${b64url(signature)}`;
  },

  /**
   * Verify a compact RS256 JWS against one public key.
   *
   * `alg` is pinned by the *caller's* choice of verifier, not read from the token:
   * trusting the header's `alg` is how `none` and HS256-with-the-public-key
   * confusion attacks work.
   */
  verifyCompact(token: string, publicKey: crypto.KeyObject): boolean {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    try {
      return crypto
        .createVerify(RSA_SIGN_ALGORITHM)
        .update(`${parts[0]}.${parts[1]}`, 'utf8')
        .verify(publicKey, Buffer.from(parts[2] as string, 'base64url'));
    } catch {
      return false;
    }
  },

  /** Read the protected header without verifying anything — used only to find the `kid`. */
  decodeHeader(token: string): Record<string, unknown> | null {
    return this._decodeSegment(token, 0);
  },

  /** Read the claim set without verifying anything. Never trust the result unverified. */
  decodeClaims(token: string): Record<string, unknown> | null {
    return this._decodeSegment(token, 1);
  },

  // Internal: one JSON segment of a compact JWS, or null if it is not parseable.
  _decodeSegment(token: string, index: number): Record<string, unknown> | null {
    const segment = token.split('.')[index];
    if (!segment) return null;
    try {
      const parsed: unknown = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
      return parsed !== null && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  },

  /** `alg` value every artefact this server signs and verifies carries. */
  get algorithm(): string {
    return CRYPTO.SIGNING_ALG;
  },
};
