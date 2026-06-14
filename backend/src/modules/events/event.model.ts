import mongoose from 'mongoose';
import type { Document, Model } from 'mongoose';
import { EVENT_TYPES } from './event.types';
import type { EventType } from './event.types';

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

/** Retention window for the activity log. TTL index drops events past this age. */
const RETENTION_DAYS = Number(process.env.EVENT_RETENTION_DAYS ?? 90);
const RETENTION_SECONDS = Math.max(1, RETENTION_DAYS) * 24 * 60 * 60;

const authEventSchema = new mongoose.Schema<IAuthEvent>(
  {
    type: { type: String, enum: EVENT_TYPES, required: true, index: true },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    actorRole: { type: String },
    clientId: { type: String, index: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    ip: { type: String },
    ua: { type: String },
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

export const AuthEvent: Model<IAuthEvent> =
  (mongoose.models.AuthEvent as Model<IAuthEvent>) ||
  mongoose.model<IAuthEvent>('AuthEvent', authEventSchema);

export default AuthEvent;
