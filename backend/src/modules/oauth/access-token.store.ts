import mongoose from 'mongoose';
import { hashToken } from '../../common/utils/crypto.utils';
import { MILLISECONDS, TTL_SECONDS } from '../../common/constants/index.constants';
import type { RevokeReason } from '../../common/constants/index.constants';
import { OAuthAccessToken } from './oauth-access-token.model';
import type { IOAuthAccessToken } from './oauth-access-token.model';

/**
 * The only module that queries `oauthAccessTokens`.
 *
 * Revocation is a `revokedAt` write, not a delete, so "this token was revoked" stays
 * distinguishable from "this token never existed" for as long as the row is retained.
 */

interface CreateAccessTokenInput {
  token: string;
  userId: string;
  clientId: string;
  scope: string;
}

// Internal: the predicate that defines "this token may authorize a request".
const _liveFilter = (extra: Record<string, unknown>) => ({
  revokedAt: null,
  expiresAt: { $gt: new Date() },
  ...extra,
});

export const AccessTokenStore = {
  /** Persist a token by hash and return that hash, so callers never re-derive it. */
  async create(input: CreateAccessTokenInput): Promise<{ tokenHash: string; expiresIn: number }> {
    const now = new Date();
    const tokenHash = hashToken(input.token);
    await OAuthAccessToken.create({
      tokenHash,
      userId: new mongoose.Types.ObjectId(input.userId),
      clientId: input.clientId,
      scope: input.scope,
      revokedAt: null,
      createdAt: now,
      expiresAt: new Date(now.getTime() + TTL_SECONDS.ACCESS_TOKEN * MILLISECONDS.SECOND),
    });
    return { tokenHash, expiresIn: TTL_SECONDS.ACCESS_TOKEN };
  },

  /**
   * Resolve a bearer token. The explicit `expiresAt` predicate is what actually enforces
   * expiry — the TTL index only reclaims space, on a ~60 s cycle.
   */
  async findLive(token: string): Promise<IOAuthAccessToken | null> {
    return OAuthAccessToken.findOne(_liveFilter({ tokenHash: hashToken(token) })).lean<IOAuthAccessToken>();
  },

  /** Revoke one token by its stored hash — `tokenHash` is unique, so this is one document. */
  async revokeByHash(tokenHash: string, reason: RevokeReason): Promise<number> {
    const result = await OAuthAccessToken.updateOne(_liveFilter({ tokenHash }), {
      $set: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.modifiedCount;
  },

  /**
   * Revoke every live token a user holds for one client — one indexed `updateMany` over
   * `{ userId, clientId }`, which is what replaced the Redis index set entirely.
   */
  async revokeForUserClient(userId: string, clientId: string, reason: RevokeReason): Promise<number> {
    const result = await OAuthAccessToken.updateMany(
      _liveFilter({ userId: new mongoose.Types.ObjectId(userId), clientId }),
      { $set: { revokedAt: new Date(), revokedReason: reason } },
    );
    return result.modifiedCount;
  },

  /**
   * Revoke every live token a user holds, across all clients.
   *
   * Needed by password reset and account closure. The reference implementation revokes
   * only the session row on both (§2.3-15), so a third party's access token outlives the
   * reset that was supposed to end the intruder's access — which defeats the entire point
   * of the flow.
   */
  async revokeAllForUser(userId: string, reason: RevokeReason): Promise<number> {
    const result = await OAuthAccessToken.updateMany(
      _liveFilter({ userId: new mongoose.Types.ObjectId(userId) }),
      { $set: { revokedAt: new Date(), revokedReason: reason } },
    );
    return result.modifiedCount;
  },
};
