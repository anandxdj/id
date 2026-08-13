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
  /** SHA-256 of the token. A database dump must not yield a usable bearer credential. */
  tokenHash: string;
  /**
   * The `jti` carried in the token's own claims (M4). Cross-checked against this row on
   * every use, so a token whose claims were somehow substituted for another live token's
   * body fails rather than authorising as whichever record its hash happened to find.
   */
  jti?: string;
  userId: mongoose.Types.ObjectId;
  clientId: string;
  /**
   * The **granted** scope, decided at issuance as requested ∩ consented ∩ client
   * allowlist. Resource endpoints read scope from here, never from the token body.
   */
  scope: string;
  /**
   * The authorization grant this token was minted under — shared with every other token
   * from the same authorization code. RFC 7009 §2.1 asks revocation to cascade across a
   * grant; without a shared identifier there is nothing to cascade along.
   */
  grantId?: string;
  /** When the end user authenticated, propagated into `auth_time`. */
  authTime?: Date;
  revokedAt: Date | null;
  revokedReason?: RevokeReason;
  createdAt: Date;
  expiresAt: Date;
}

const oauthAccessTokenSchema = new mongoose.Schema<IOAuthAccessToken>(
  {
    tokenHash: { type: String, required: true, unique: true },
    jti: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: COLLECTIONS.USER, required: true },
    clientId: { type: String, required: true },
    scope: { type: String, required: true },
    grantId: { type: String },
    authTime: { type: Date },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, collection: COLLECTION_NAMES.OAUTH_ACCESS_TOKEN },
);

// "Revoke this app's access" — the query the Redis index set was standing in for.
oauthAccessTokenSchema.index({ userId: 1, clientId: 1 });
// RFC 7009 cascade: revoking one token revokes everything from the same grant.
oauthAccessTokenSchema.index({ grantId: 1 });
oauthAccessTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: TTL_EXPIRE_AT_DATE });

export const OAuthAccessToken: Model<IOAuthAccessToken> =
  (mongoose.models[COLLECTIONS.OAUTH_ACCESS_TOKEN] as Model<IOAuthAccessToken>) ||
  mongoose.model<IOAuthAccessToken>(COLLECTIONS.OAUTH_ACCESS_TOKEN, oauthAccessTokenSchema);
