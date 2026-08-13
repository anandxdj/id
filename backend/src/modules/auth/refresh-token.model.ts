import mongoose from 'mongoose';
import type { Model } from 'mongoose';
import {
  COLLECTIONS,
  COLLECTION_NAMES,
  REFRESH_TOKEN,
  REFRESH_TOKEN_STATUS,
} from '../../common/constants/index.constants';
import type { RefreshTokenStatus, RevokeReason } from '../../common/constants/index.constants';

/**
 * Durable, rotating refresh tokens, grouped into a **family** — one family per login.
 *
 * Until M3 a refresh token was a bare JWT with no server-side record: nothing to revoke,
 * no rotation, and no way to notice that a token had been stolen. This collection is the
 * whole of that gap.
 *
 * ⚠ TTL IS GARBAGE COLLECTION, NOT A SECURITY BOUNDARY. Mongo's reaper runs on a ~60 s
 * cycle, so an expired token stays readable. Every read path carries its own
 * `expiresAt: { $gt: new Date() }` predicate — see `refresh-token.store.ts`, the only
 * module allowed to query this collection. The two reads that deliberately *omit* it are
 * marked as such: classifying a failed rotation has to be able to see an expired or
 * already-spent document, or a replay would degrade into "unknown token" and the attack
 * signal would be lost.
 *
 * Two deliberate departures from the reference design (§4.2):
 *
 *  - **`familyId` is a real field.** The reference records `parent_refresh_token_id` and
 *    expects a family to be found by walking it recursively — which is precisely why it
 *    never implemented family revocation. With a stored `familyId` that walk is one
 *    indexed `updateMany`.
 *  - **`userId` is denormalised.** Revoking or auditing by user needs no join, and the
 *    reference's per-session `UPDATE` loop collapses into a single statement.
 *
 * There is deliberately **no** partial unique index on `{ sessionId, status: 'active' }`.
 * It is tempting as a one-live-leaf invariant, but it would turn the benign
 * double-refresh race into a hard `E11000` at exactly the moment the grace window exists
 * to handle gracefully.
 */
export interface IRefreshToken {
  _id: mongoose.Types.ObjectId;
  /** SHA-256 of the signed JWT. The plaintext is never stored, logged, or recoverable. */
  tokenHash: string;
  /**
   * The JWT's `jti`. Public and safe to log, which is the point: it gives support and the
   * audit trail a way to name one token without ever naming the credential.
   */
  tokenJti: string;
  /** Every descendant of one login shares this. Reuse detection revokes by it. */
  familyId: mongoose.Types.ObjectId;
  /** The session *handle* (`sha256(sid)`), matching `sessions._id`. */
  sessionId: string;
  userId: mongoose.Types.ObjectId;
  parentTokenId: mongoose.Types.ObjectId | null;
  /** Set atomically with the flip to `rotated`, so a rotated token always names its heir. */
  replacedByTokenId: mongoose.Types.ObjectId | null;
  status: RefreshTokenStatus;
  /** Mirrors the JWT `iat` at second precision, so the token can be re-derived exactly. */
  issuedAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  revokedReason?: RevokeReason;
  /**
   * Mirrors the JWT `exp` at second precision. Inherited unchanged by every child, which
   * is what makes the refresh window absolute rather than sliding.
   */
  expiresAt: Date;
}

const refreshTokenSchema = new mongoose.Schema<IRefreshToken>(
  {
    tokenHash: { type: String, required: true, unique: true },
    tokenJti: { type: String, required: true, unique: true },
    familyId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sessionId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: COLLECTIONS.USER, required: true },
    parentTokenId: { type: mongoose.Schema.Types.ObjectId, default: null },
    replacedByTokenId: { type: mongoose.Schema.Types.ObjectId, default: null },
    status: {
      type: String,
      enum: Object.values(REFRESH_TOKEN_STATUS),
      default: REFRESH_TOKEN_STATUS.ACTIVE,
      required: true,
    },
    issuedAt: { type: Date, required: true },
    // Explicit `null` defaults: the compare-and-set filters match on `null`, which would
    // not match a document where the field is merely absent.
    rotatedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, collection: COLLECTION_NAMES.REFRESH_TOKEN },
);

// Reuse detection: revoke a whole family in one indexed write.
refreshTokenSchema.index({ familyId: 1, status: 1 });
// Sign-out of one device.
refreshTokenSchema.index({ sessionId: 1, status: 1 });
// Password reset, closure, suspension, role change — revoke everything a user holds.
refreshTokenSchema.index({ userId: 1, status: 1 });
// Storage reclamation, deliberately delayed past expiry so a late replay is still
// recognisable as a replay. See REFRESH_TOKEN.REPLAY_RETENTION_SECONDS.
refreshTokenSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: REFRESH_TOKEN.REPLAY_RETENTION_SECONDS },
);

export const RefreshToken: Model<IRefreshToken> =
  (mongoose.models[COLLECTIONS.REFRESH_TOKEN] as Model<IRefreshToken>) ||
  mongoose.model<IRefreshToken>(COLLECTIONS.REFRESH_TOKEN, refreshTokenSchema);
