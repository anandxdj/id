import mongoose from 'mongoose';
import type { Model } from 'mongoose';
import {
  COLLECTIONS,
  COLLECTION_NAMES,
  SIGNING_KEY,
  SIGNING_KEY_STATUS,
} from '../../common/constants/index.constants';
import type { SigningKeyStatus } from '../../common/constants/index.constants';

/**
 * The OIDC signing keyring.
 *
 * Every field here exists to fix something the reference gets wrong (plan §2.3-5):
 * its `kid` is the literal `"default"`, its key-sync no-ops once a row with that `kid`
 * exists, and its access tokens carry no `kid` at all — so adding a second key throws
 * `JWKSMultipleMatchingKeys` on every verification and rotation is impossible.
 *
 * ⚠ TTL is garbage collection, not a security boundary. The reaper runs on a ~60 s
 * cycle, so a key whose `notAfter` has passed stays readable for up to a minute; every
 * read carries its own `notAfter` predicate. See `signing-key.store.ts`, the only
 * module that queries this collection.
 *
 * The TTL index is on `notAfter`, which is null for ACTIVE and NEXT keys — Mongo skips
 * documents whose indexed field is not a date, so the key currently signing can never
 * be reaped out from under the issuer.
 */
export interface IOAuthSigningKey {
  /** RFC 7638 JWK thumbprint. Derived from the key, never configured. */
  kid: string;
  alg: string;
  /** Public members only (`kty`, `n`, `e`). This is what JWKS serves verbatim. */
  publicJwk: Record<string, string>;
  /** AES-256-GCM envelope. A database dump alone must not be able to mint tokens. */
  encryptedPrivateKey: string;
  encryptionIv: string;
  encryptionAuthTag: string;
  status: SigningKeyStatus;
  createdAt: Date;
  activatedAt: Date | null;
  retiredAt: Date | null;
  /**
   * End of the overlap window: the key stays published and keeps verifying until this
   * passes. Null while the key is ACTIVE or NEXT.
   */
  notAfter: Date | null;
}

const oauthSigningKeySchema = new mongoose.Schema<IOAuthSigningKey>(
  {
    kid: { type: String, required: true, unique: true },
    alg: { type: String, required: true },
    publicJwk: { type: Object, required: true },
    encryptedPrivateKey: { type: String, required: true },
    encryptionIv: { type: String, required: true },
    encryptionAuthTag: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(SIGNING_KEY_STATUS),
      required: true,
    },
    createdAt: { type: Date, required: true },
    activatedAt: { type: Date, default: null },
    retiredAt: { type: Date, default: null },
    notAfter: { type: Date, default: null },
  },
  { timestamps: false, collection: COLLECTION_NAMES.OAUTH_SIGNING_KEY },
);

// "Which key signs, and which are still published" — the only two queries there are.
oauthSigningKeySchema.index({ status: 1 });
// Storage reclamation, with a retention margin past `notAfter` so an incident review can
// still answer "which key signed this token?". See the warning above.
oauthSigningKeySchema.index(
  { notAfter: 1 },
  { expireAfterSeconds: SIGNING_KEY.RETENTION_AFTER_NOT_AFTER_SECONDS },
);

export const OAuthSigningKey: Model<IOAuthSigningKey> =
  (mongoose.models[COLLECTIONS.OAUTH_SIGNING_KEY] as Model<IOAuthSigningKey>) ||
  mongoose.model<IOAuthSigningKey>(COLLECTIONS.OAUTH_SIGNING_KEY, oauthSigningKeySchema);
