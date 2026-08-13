import mongoose from 'mongoose';
import type { Document, Model } from 'mongoose';
import { EVENT_TYPES } from './event.types';
import type { EventType } from './event.types';
import { DEFAULT_EVENT_RETENTION_SECONDS, FIELD_LIMITS } from '../../common/constants/index.constants';

export interface IAuthEvent extends Document {
  type: EventType;
  actorUserId?: mongoose.Types.ObjectId;
  actorRole?: string;
  clientId?: string;
  targetUserId?: mongoose.Types.ObjectId;
  ip?: string;
  ua?: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Retention window for the activity log; the TTL index drops events past this age.
 *
 * A static default is baked in here rather than read from config, because model files
 * must stay side-effect free at import time (config is validated lazily). The
 * configured value is applied at boot by `IndexSync`, which issues a `collMod` —
 * necessary because Mongoose silently refuses to alter an existing TTL index, so
 * editing this number alone would appear to work and change nothing.
 */
const RETENTION_SECONDS = DEFAULT_EVENT_RETENTION_SECONDS;

const authEventSchema = new mongoose.Schema<IAuthEvent>(
  {
    type: { type: String, enum: EVENT_TYPES, required: true, index: true },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    actorRole: { type: String },
    clientId: { type: String, index: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    ip: { type: String, maxlength: FIELD_LIMITS.IP_ADDRESS },
    ua: { type: String, maxlength: FIELD_LIMITS.USER_AGENT },
    meta: { type: mongoose.Schema.Types.Mixed },
    // explicit createdAt so the TTL index has a stable field to expire on
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// TTL: Mongo's background reaper deletes documents `RETENTION_SECONDS` after createdAt.
authEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });
// Common read path: a user's activity feed, newest first.
authEventSchema.index({ actorUserId: 1, createdAt: -1 });
authEventSchema.index({ actorUserId: 1, clientId: 1, createdAt: -1 });
authEventSchema.index({ targetUserId: 1, createdAt: -1 });
authEventSchema.index({ type: 1, createdAt: -1 });
// Keyset pagination on the global feed: `{ createdAt, _id }` not OFFSET.
authEventSchema.index({ createdAt: -1, _id: -1 });

export const AuthEvent: Model<IAuthEvent> =
  (mongoose.models.AuthEvent as Model<IAuthEvent>) ||
  mongoose.model<IAuthEvent>('AuthEvent', authEventSchema);

export default AuthEvent;
