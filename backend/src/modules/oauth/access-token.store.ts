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
  /** M4: `jti`, grant identity and `auth_time` from the signed token. */
  jti?: string;
  grantId?: string;
  authTime?: Date;
  /** Explicit expiry so the record and the token's own `exp` claim cannot drift apart. */
  expiresAt?: Date;
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
      jti: input.jti,
      userId: new mongoose.Types.ObjectId(input.userId),
      clientId: input.clientId,
      scope: input.scope,
      grantId: input.grantId,
      authTime: input.authTime,
      revokedAt: null,
      createdAt: now,
      expiresAt:
        input.expiresAt ??
        new Date(now.getTime() + TTL_SECONDS.ACCESS_TOKEN * MILLISECONDS.SECOND),
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

  /**
   * Resolve a token without the liveness predicates, for RFC 7662 introspection.
   *
   * Introspection has to distinguish "revoked" from "never existed" *internally* while
   * answering both with the same `{ active: false }`, so it needs the row a live lookup
   * would hide. Nothing that authorises a request may use this.
   */
  async findAny(token: string): Promise<IOAuthAccessToken | null> {
    return OAuthAccessToken.findOne({ tokenHash: hashToken(token) }).lean<IOAuthAccessToken>();
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
   *
   * M3 widened the callers: the credential fan-out (role change, suspension, closure and
   * password reset) all route through here, so this is the user-wide half of revocation
   * and `revokeByGrant` below is the per-grant half. They compose — neither subsumes the
   * other, because a grant spans one client and this spans all of them.
   */
  async revokeAllForUser(userId: string, reason: RevokeReason): Promise<number> {
    const result = await OAuthAccessToken.updateMany(
      _liveFilter({ userId: new mongoose.Types.ObjectId(userId) }),
      { $set: { revokedAt: new Date(), revokedReason: reason } },
    );
    return result.modifiedCount;
  },

  /**
   * Revoke every live token minted under one authorization grant.
   *
   * This is the RFC 7009 §2.1 cascade: "if the particular token is a refresh token and
   * the authorization server supports the revocation of access tokens, then the
   * authorization server SHOULD also invalidate all access tokens based on the same
   * authorization grant". `grantId` is the join column that lets a revoked refresh token
   * take the access tokens minted beside it, without any further schema change.
   */
  async revokeByGrant(grantId: string, reason: RevokeReason): Promise<number> {
    const result = await OAuthAccessToken.updateMany(_liveFilter({ grantId }), {
      $set: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.modifiedCount;
  },
};
