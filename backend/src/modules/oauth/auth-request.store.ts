import mongoose from 'mongoose';
import { MILLISECONDS, TTL_SECONDS } from '../../common/constants/index.constants';
import { OAuthAuthRequest } from './oauth-auth-request.model';
import type { IOAuthAuthRequest } from './oauth-auth-request.model';

/**
 * The only module that queries `oauthAuthRequests`.
 *
 * Every read is scoped by `userId` as well as `transactionId`, preserving the guarantee
 * the old composite Redis key gave for free: one user can never load or complete
 * another user's pending consent.
 */

interface CreateAuthRequestInput {
  transactionId: string;
  userId: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  nonce?: string;
  prompt?: string;
  maxAge?: number;
}

// Internal: "this request is still awaiting a decision". The `expiresAt` predicate is
// explicit because the TTL reaper lags by up to a minute.
const _pendingFilter = (transactionId: string, userId: string) => ({
  transactionId,
  userId: new mongoose.Types.ObjectId(userId),
  consumedAt: null,
  expiresAt: { $gt: new Date() },
});

export const AuthRequestStore = {
  async create(input: CreateAuthRequestInput): Promise<void> {
    const now = new Date();
    await OAuthAuthRequest.create({
      ...input,
      userId: new mongoose.Types.ObjectId(input.userId),
      consumedAt: null,
      createdAt: now,
      expiresAt: new Date(now.getTime() + TTL_SECONDS.AUTH_REQUEST * MILLISECONDS.SECOND),
    });
  },

  /** Read without consuming — the consent screen may be rendered more than once. */
  async findPending(transactionId: string, userId: string): Promise<IOAuthAuthRequest | null> {
    return OAuthAuthRequest.findOne(_pendingFilter(transactionId, userId)).lean<IOAuthAuthRequest>();
  },

  /**
   * Atomically claim the request so one decision yields at most one authorization code.
   * Returns the pre-image, or `null` if it was already decided, expired, or never existed.
   */
  async consume(transactionId: string, userId: string): Promise<IOAuthAuthRequest | null> {
    return OAuthAuthRequest.findOneAndUpdate(
      _pendingFilter(transactionId, userId),
      { $set: { consumedAt: new Date() } },
      { returnDocument: 'before' },
    ).lean<IOAuthAuthRequest>();
  },
};
