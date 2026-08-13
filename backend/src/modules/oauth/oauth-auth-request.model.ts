import mongoose from 'mongoose';
import type { Model } from 'mongoose';
import {
  CODE_CHALLENGE_METHODS,
  COLLECTIONS,
  COLLECTION_NAMES,
  TTL_EXPIRE_AT_DATE,
} from '../../common/constants/index.constants';

/**
 * A pending authorization request parked while the user decides on the consent screen.
 * Replaces the `auth_req:{transactionId}:{userId}` Redis keyspace.
 *
 * ⚠ TTL is garbage collection, not expiry enforcement — the reaper runs on a ~60 s
 * cycle, so every read must carry its own `expiresAt: { $gt: new Date() }` predicate.
 * See `auth-request.store.ts`, the only module that queries this collection.
 *
 * `transactionId` is stored in the clear, unlike the code/token/session hashes. It is
 * not a bearer credential: redeeming it requires the owning user's authenticated
 * session (every query is scoped by `userId`), and keeping it greppable is what makes a
 * stuck consent flow diagnosable from a log line.
 */
export interface IOAuthAuthRequest {
  transactionId: string;
  userId: mongoose.Types.ObjectId;
  clientId: string;
  redirectUri: string;
  /**
   * The scope the client **requested**. What the user actually approves is recorded on
   * the consent document, and issuance uses the intersection of the two — conflating
   * these two things is the scope-escalation bug (plan §2.3-12).
   */
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  nonce?: string;
  /** OIDC Core §3.1.2.1 `prompt`, carried across the consent round-trip. */
  prompt?: string;
  /** OIDC Core §3.1.2.1 `max_age`, in seconds. */
  maxAge?: number;
  consumedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
}

const oauthAuthRequestSchema = new mongoose.Schema<IOAuthAuthRequest>(
  {
    transactionId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: COLLECTIONS.USER, required: true },
    clientId: { type: String, required: true },
    redirectUri: { type: String, required: true },
    scope: { type: String, required: true },
    state: { type: String, required: true },
    codeChallenge: { type: String, required: true },
    codeChallengeMethod: {
      type: String,
      enum: Object.values(CODE_CHALLENGE_METHODS),
      required: true,
    },
    nonce: { type: String },
    prompt: { type: String },
    maxAge: { type: Number },
    consumedAt: { type: Date, default: null },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, collection: COLLECTION_NAMES.OAUTH_AUTH_REQUEST },
);

oauthAuthRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: TTL_EXPIRE_AT_DATE });

export const OAuthAuthRequest: Model<IOAuthAuthRequest> =
  (mongoose.models[COLLECTIONS.OAUTH_AUTH_REQUEST] as Model<IOAuthAuthRequest>) ||
  mongoose.model<IOAuthAuthRequest>(COLLECTIONS.OAUTH_AUTH_REQUEST, oauthAuthRequestSchema);
