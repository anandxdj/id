import mongoose from 'mongoose';
import type { Model } from 'mongoose';
import {
  AUTH_CODE_REPLAY_RETENTION_SECONDS,
  CODE_CHALLENGE_METHODS,
  COLLECTIONS,
  COLLECTION_NAMES,
} from '../../common/constants/index.constants';

/**
 * Authorization codes. Replaces the `auth_code:{hash}` Redis keyspace.
 *
 * ⚠ TTL is garbage collection, not expiry enforcement — the reaper runs on a ~60 s
 * cycle, so every read must carry its own `expiresAt: { $gt: new Date() }` predicate.
 * See `auth-code.store.ts`, the only module that queries this collection.
 *
 * Redemption is a `consumedAt` compare-and-set that returns the **pre-image**, never a
 * delete. That is the whole reason this is a document and not a Redis key: the pre-image
 * distinguishes a replay of a genuine code (an attack signal — the issued access token
 * must be revoked) from an unknown code (a plain client bug). A `findOneAndDelete`
 * would collapse both into "not found" and throw the signal away.
 *
 * `expiresAt` therefore governs *validity* while the TTL index adds a retention margin
 * on top of it, so a late replay is still detectable rather than silently reaped.
 */
export interface IOAuthAuthCode {
  /** SHA-256 of the code handed to the client. The code itself is never stored. */
  codeHash: string;
  userId: mongoose.Types.ObjectId;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  /**
   * The **granted** scope: requested ∩ consented ∩ the client's allowlist, computed at
   * authorize time. Never the raw request — a client that asks for more than the user
   * approved gets a code that cannot be exchanged for more than the user approved.
   */
  scope: string;
  nonce?: string;
  /** Identity of the authorization grant, inherited by every token minted from it. */
  grantId?: string;
  /** When the end user authenticated, for the `auth_time` claim and `max_age`. */
  authTime?: Date;
  consumedAt: Date | null;
  /** Set once redemption succeeds, so a later replay knows what to revoke. */
  issuedAccessTokenHash?: string;
  createdAt: Date;
  expiresAt: Date;
}

const oauthAuthCodeSchema = new mongoose.Schema<IOAuthAuthCode>(
  {
    codeHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: COLLECTIONS.USER, required: true },
    clientId: { type: String, required: true },
    redirectUri: { type: String, required: true },
    codeChallenge: { type: String, required: true },
    codeChallengeMethod: {
      type: String,
      enum: Object.values(CODE_CHALLENGE_METHODS),
      required: true,
    },
    scope: { type: String, required: true },
    nonce: { type: String },
    grantId: { type: String },
    authTime: { type: Date },
    consumedAt: { type: Date, default: null },
    issuedAccessTokenHash: { type: String },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, collection: COLLECTION_NAMES.OAUTH_AUTH_CODE },
);

oauthAuthCodeSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: AUTH_CODE_REPLAY_RETENTION_SECONDS },
);

export const OAuthAuthCode: Model<IOAuthAuthCode> =
  (mongoose.models[COLLECTIONS.OAUTH_AUTH_CODE] as Model<IOAuthAuthCode>) ||
  mongoose.model<IOAuthAuthCode>(COLLECTIONS.OAUTH_AUTH_CODE, oauthAuthCodeSchema);
