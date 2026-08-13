import mongoose from 'mongoose';
import type { Model } from 'mongoose';
import {
  COLLECTIONS,
  COLLECTION_NAMES,
  TTL_EXPIRE_AT_DATE,
} from '../../common/constants/index.constants';
import type { RevokeReason } from '../../common/constants/index.constants';

/**
 * Opaque OIDC access tokens. Replaces the `access_token:{hash}` Redis keyspace **and**
 * the `user_client_tokens:{userId}:{clientId}` set that indexed it — that set existed
 * only because Redis cannot answer "which tokens does this user hold for this client"
 * without a SCAN. Here it is a compound index, so the set has no reason to exist.
 *
 * ⚠ TTL is garbage collection, not expiry enforcement — the reaper runs on a ~60 s
 * cycle, so every read must carry its own `expiresAt: { $gt: new Date() }` predicate.
 * See `access-token.store.ts`, the only module that queries this collection.
 */
export interface IOAuthAccessToken {
  /** SHA-256 of the opaque token. A database dump must not yield a usable bearer token. */
  tokenHash: string;
  userId: mongoose.Types.ObjectId;
  clientId: string;
  scope: string;
  revokedAt: Date | null;
  revokedReason?: RevokeReason;
  createdAt: Date;
  expiresAt: Date;
}

const oauthAccessTokenSchema = new mongoose.Schema<IOAuthAccessToken>(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: COLLECTIONS.USER, required: true },
    clientId: { type: String, required: true },
    scope: { type: String, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, collection: COLLECTION_NAMES.OAUTH_ACCESS_TOKEN },
);

// "Revoke this app's access" — the query the Redis index set was standing in for.
oauthAccessTokenSchema.index({ userId: 1, clientId: 1 });
oauthAccessTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: TTL_EXPIRE_AT_DATE });

export const OAuthAccessToken: Model<IOAuthAccessToken> =
  (mongoose.models[COLLECTIONS.OAUTH_ACCESS_TOKEN] as Model<IOAuthAccessToken>) ||
  mongoose.model<IOAuthAccessToken>(COLLECTIONS.OAUTH_ACCESS_TOKEN, oauthAccessTokenSchema);
