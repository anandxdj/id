import mongoose from 'mongoose';
import type { Model } from 'mongoose';
import {
  ACTION_TOKEN_TYPES,
  COLLECTIONS,
  COLLECTION_NAMES,
  FIELD_LIMITS,
  TTL_EXPIRE_AT_DATE,
} from '../../common/constants/index.constants';
import type { ActionTokenRevokeReason, ActionTokenType } from '../../common/constants/index.constants';

/**
 * Single-use, type-discriminated tokens for the two flows that authenticate a mailbox
 * rather than a password: email verification and password reset.
 *
 * ⚠ TTL IS GARBAGE COLLECTION, NOT A SECURITY BOUNDARY. Mongo's reaper runs on a ~60 s
 * cycle and never runs on a secondary, so a token whose `expiresAt` has passed stays
 * readable for up to a minute. Every read path therefore carries its own
 * `expiresAt: { $gt: new Date() }` predicate — see `action-token.store.ts`, the only
 * module allowed to query this collection.
 *
 * Three properties the schema exists to guarantee, each fixing a specific reference bug:
 *
 *  1. **Only a digest is stored.** `tokenHash` is `sha256(token)`; the token itself lives
 *     exclusively in the email. A database dump yields no usable link.
 *  2. **`type` is part of the redemption filter**, so a verification token can never be
 *     spent as a password reset.
 *  3. **`consumedAt` and `revokedAt` are separate.** Overloading one field would make
 *     "you already used this link" and "you clicked an older link" the same state, and
 *     those are different events with different responses to a support question. The
 *     revoke path is what makes re-issuing invalidate prior tokens (§2.3-9): the
 *     reference re-issues without revoking, so N reset requests leave N live tokens.
 *
 * `sentToEmail` binds a token to the address it was mailed to. If the account's address
 * changes — including the tombstone written by account closure — every outstanding token
 * for the old address stops resolving, without a sweep.
 */
export interface IAuthActionToken {
  /** SHA-256 of the token in the email. The token itself is never stored. */
  tokenHash: string;
  userId: mongoose.Types.ObjectId;
  type: ActionTokenType;
  /** The address this token was mailed to, normalised. Re-checked at redemption. */
  sentToEmail: string;
  consumedAt: Date | null;
  revokedAt: Date | null;
  revokedReason?: ActionTokenRevokeReason;
  createdAt: Date;
  expiresAt: Date;
}

const authActionTokenSchema = new mongoose.Schema<IAuthActionToken>(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: COLLECTIONS.USER, required: true },
    type: { type: String, enum: Object.values(ACTION_TOKEN_TYPES), required: true },
    sentToEmail: { type: String, required: true, lowercase: true, maxlength: FIELD_LIMITS.EMAIL },
    // Explicit `null` defaults: the claim filter is `{ consumedAt: null, revokedAt: null }`,
    // which would not match a document where the field is merely absent.
    consumedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, collection: COLLECTION_NAMES.AUTH_ACTION_TOKEN },
);

// "Revoke every outstanding token of this type for this user" on re-issue — one cheap
// indexed `updateMany` rather than a scan.
authActionTokenSchema.index({ userId: 1, type: 1, consumedAt: 1, revokedAt: 1 });
// Storage reclamation only. See the warning above.
authActionTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: TTL_EXPIRE_AT_DATE });

export const AuthActionToken: Model<IAuthActionToken> =
  (mongoose.models[COLLECTIONS.AUTH_ACTION_TOKEN] as Model<IAuthActionToken>) ||
  mongoose.model<IAuthActionToken>(COLLECTIONS.AUTH_ACTION_TOKEN, authActionTokenSchema);
