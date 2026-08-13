import mongoose from 'mongoose';
import type { Model } from 'mongoose';
import {
  COLLECTIONS,
  COLLECTION_NAMES,
  TTL_EXPIRE_AT_DATE,
} from '../../common/constants/index.constants';

/**
 * Social-login CSRF state. Replaces the `oauth_state:{state}` Redis keyspace.
 *
 * ⚠ TTL is garbage collection, not expiry enforcement — the reaper runs on a ~60 s
 * cycle, so every read must carry its own `expiresAt: { $gt: new Date() }` predicate.
 * See `oauth-state.store.ts`, the only module that queries this collection.
 *
 * Single-use is enforced by a `consumedAt` compare-and-set rather than a delete, so a
 * replayed state is distinguishable from one that never existed.
 */
export interface IOAuthState {
  /** SHA-256 of the state value handed to the provider. */
  stateHash: string;
  provider: string;
  returnTo?: string;
  consumedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
}

const oauthStateSchema = new mongoose.Schema<IOAuthState>(
  {
    stateHash: { type: String, required: true, unique: true },
    provider: { type: String, required: true },
    returnTo: { type: String },
    consumedAt: { type: Date, default: null },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, collection: COLLECTION_NAMES.OAUTH_STATE },
);

oauthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: TTL_EXPIRE_AT_DATE });

export const OAuthState: Model<IOAuthState> =
  (mongoose.models[COLLECTIONS.OAUTH_STATE] as Model<IOAuthState>) ||
  mongoose.model<IOAuthState>(COLLECTIONS.OAUTH_STATE, oauthStateSchema);
