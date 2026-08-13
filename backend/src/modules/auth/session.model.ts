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
   * Snapshot of the account state at sign-in, denormalised per plan §4.2 — and, since
   * M3, **authoritative**: `auth.middleware` reads authority from here and no longer
   * re-reads the user on every request.
   *
   * That is only safe because the snapshot cannot go stale. Every mutation that would
   * invalidate it — role change, suspension, closure, password reset — revokes the
   * affected sessions before the change is observable, so a session that still resolves
   * is a session whose snapshot still matches. `disabled` is therefore belt-and-braces
   * rather than the gate: a suspended user has no live session to read it from.
   *
   * The ordering matters and it is the reason this flip happened in M3 and not M1: the
   * revocation had to exist and be tested first. Flip the read path before that and a
   * demoted admin keeps admin until their session expires.
   */
  role: string;
  disabled: boolean;
  /**
   * The live leaf of this session's refresh-token family. Points at `refreshTokens._id`.
   * Informational — rotation is a compare-and-set on the token itself, never on this
   * pointer, so a stale value can be wrong without being dangerous.
   */
  currentRefreshTokenId?: mongoose.Types.ObjectId | null;
  /** Human-readable label derived from the user agent. See `device-name.ts`. */
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
    currentRefreshTokenId: { type: mongoose.Schema.Types.ObjectId, default: null },
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
