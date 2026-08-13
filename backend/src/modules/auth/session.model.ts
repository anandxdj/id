import mongoose from 'mongoose';
import type { Model } from 'mongoose';
import {
  COLLECTIONS,
  COLLECTION_NAMES,
  FIELD_LIMITS,
  TTL_EXPIRE_AT_DATE,
} from '../../common/constants/index.constants';
import type { RevokeReason } from '../../common/constants/index.constants';

/**
 * First-party sessions. Replaces the `session:{userId}:{sid}` Redis keyspace.
 *
 * ⚠ TTL IS GARBAGE COLLECTION, NOT A SECURITY BOUNDARY. Mongo's reaper runs on a
 * ~60 s cycle and never runs on a secondary, so a document whose `expiresAt` has
 * passed stays readable for up to a minute. Every read path must therefore carry its
 * own `expiresAt: { $gt: new Date() }` predicate — see `session.store.ts`, which is
 * the only module allowed to query this collection.
 *
 * Revocation is a soft `revokedAt` write rather than a delete: a revoked session is
 * evidence, and "when and why was I signed out" is unanswerable once the row is gone.
 * The TTL index reclaims the space either way.
 */
export interface ISession {
  /**
   * SHA-256 of the session id embedded in the access/refresh token — never the sid
   * itself, so a database dump yields no usable session handle. Doubling as `_id`
   * means every lookup is served by the primary key with no secondary index.
   */
  _id: string;
  userId: mongoose.Types.ObjectId;
  /**
   * Snapshot of the account state at sign-in, denormalised per plan §4.2 so the
   * per-request `User.findById` can eventually be dropped. NOT yet authoritative:
   * the middleware still re-reads the user, because trusting a stale snapshot is only
   * safe once every role/suspension change revokes sessions (M3).
   */
  role: string;
  disabled: boolean;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  revokedReason?: RevokeReason;
  expiresAt: Date;
}

const sessionSchema = new mongoose.Schema<ISession>(
  {
    _id: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: COLLECTIONS.USER, required: true },
    role: { type: String, required: true },
    disabled: { type: Boolean, default: false },
    deviceName: { type: String, maxlength: FIELD_LIMITS.DEVICE_NAME },
    userAgent: { type: String, maxlength: FIELD_LIMITS.USER_AGENT },
    ipAddress: { type: String, maxlength: FIELD_LIMITS.IP_ADDRESS },
    createdAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    // Explicit `null` default: the active-session filter is `revokedAt: null`, which
    // would not match a document where the field is simply absent.
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String },
    expiresAt: { type: Date, required: true },
  },
  // Declaring `_id` in the definition above replaces the default ObjectId with our
  // string key; no `_id: false` is needed or wanted here.
  { timestamps: false, collection: COLLECTION_NAMES.SESSION },
);

// "List my sessions" and "revoke all but this one" — the query that used to be a
// Redis SCAN over the entire keyspace.
sessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: -1 });
// Storage reclamation only. See the warning above.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: TTL_EXPIRE_AT_DATE });

export const Session: Model<ISession> =
  (mongoose.models[COLLECTIONS.SESSION] as Model<ISession>) ||
  mongoose.model<ISession>(COLLECTIONS.SESSION, sessionSchema);
