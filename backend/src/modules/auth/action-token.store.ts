import mongoose from 'mongoose';
import { hashToken, randomBase64Url } from '../../common/utils/crypto.utils';
import {
  ACTION_TOKEN_OUTCOME,
  ACTION_TOKEN_REVOKE_REASONS,
  ACTION_TOKEN_TTL_SECONDS,
  CRYPTO,
  MILLISECONDS,
} from '../../common/constants/index.constants';
import type {
  ActionTokenOutcome,
  ActionTokenRevokeReason,
  ActionTokenType,
} from '../../common/constants/index.constants';
import { AuthActionToken } from './action-token.model';
import type { IAuthActionToken } from './action-token.model';

/**
 * The only module that queries `authActionTokens`.
 *
 * Concentrating the queries here is what makes the invariant reviewable rather than
 * aspirational: **every read filters `expiresAt: { $gt: now }` explicitly**, because the
 * TTL index is storage reclamation on a ~60 s cycle and an expired token stays readable
 * until the reaper reaches it.
 *
 * Redemption is a single-document compare-and-set that returns the **pre-image**, the
 * same shape M1 used for authorization codes and social-login state. No transaction is
 * involved or needed: one document, one atomic update, exactly one winner under
 * concurrency. The reference implementation instead does `SELECT … consumed_at IS NULL`
 * followed by a separate `UPDATE`, so two simultaneous redemptions both succeed (§2.3-8).
 *
 * The pre-image is what lets `claim` report *why* it failed. `findOneAndDelete` would
 * collapse "replayed a real token", "clicked yesterday's link", and "made it up" into a
 * single "not found" and throw the distinction away.
 */

export interface IssuedActionToken {
  /** The plaintext token. Goes in the email and nowhere else — never logged, never stored. */
  token: string;
  expiresAt: Date;
}

export interface ActionTokenClaim {
  outcome: ActionTokenOutcome;
  /** The pre-image, present for every outcome except `UNKNOWN`. */
  token?: IAuthActionToken;
}

/** Internal: the predicate that defines "this token may still be spent". */
const _claimableFilter = (extra: Record<string, unknown>) => ({
  consumedAt: null,
  revokedAt: null,
  expiresAt: { $gt: new Date() },
  ...extra,
});

/** Internal: classify a failed claim from whatever document does exist under that hash. */
const _classifyFailure = (existing: IAuthActionToken | null): ActionTokenClaim => {
  if (!existing) return { outcome: ACTION_TOKEN_OUTCOME.UNKNOWN };
  if (existing.consumedAt) return { outcome: ACTION_TOKEN_OUTCOME.CONSUMED, token: existing };
  if (existing.revokedAt) return { outcome: ACTION_TOKEN_OUTCOME.SUPERSEDED, token: existing };
  return { outcome: ACTION_TOKEN_OUTCOME.EXPIRED, token: existing };
};

export const ActionTokenStore = {
  /**
   * Mint a token of one type for one user, revoking every prior outstanding token of the
   * same type first.
   *
   * The revoke-then-issue order matters. Doing it the other way round leaves a window in
   * which the new token is revoked along with the old ones; doing it this way means the
   * worst case is a user with no valid token, which the resend endpoint fixes. And the
   * revocation is the whole point: an old link sitting in an old inbox must stop working
   * the moment a new one is issued (§2.3-9).
   */
  async issue(input: {
    userId: string;
    type: ActionTokenType;
    sentToEmail: string;
  }): Promise<IssuedActionToken> {
    await this.revokeOutstanding(
      input.userId,
      input.type,
      ACTION_TOKEN_REVOKE_REASONS.SUPERSEDED,
    );

    const token = randomBase64Url(CRYPTO.TOKEN_BYTES.ACTION_TOKEN);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + ACTION_TOKEN_TTL_SECONDS[input.type] * MILLISECONDS.SECOND,
    );

    await AuthActionToken.create({
      tokenHash: hashToken(token),
      userId: new mongoose.Types.ObjectId(input.userId),
      type: input.type,
      sentToEmail: input.sentToEmail,
      consumedAt: null,
      revokedAt: null,
      createdAt: now,
      expiresAt,
    });

    return { token, expiresAt };
  },

  /**
   * Atomically spend a token of a given type. One winner under concurrency.
   *
   * `type` is part of the filter rather than something the caller checks afterwards, so
   * a verification token presented to the reset endpoint is simply not found.
   */
  async claim(token: string, type: ActionTokenType): Promise<ActionTokenClaim> {
    const tokenHash = hashToken(token);
    const now = new Date();

    const claimed = await AuthActionToken.findOneAndUpdate(
      _claimableFilter({ tokenHash, type }),
      { $set: { consumedAt: now } },
      { returnDocument: 'before' },
    ).lean<IAuthActionToken>();

    if (claimed) return { outcome: ACTION_TOKEN_OUTCOME.CLAIMED, token: claimed };

    // Lost the claim. Read the row back — without the `type` predicate, so a token
    // presented to the wrong endpoint is reported as unknown rather than as a genuine
    // token in the wrong state.
    const existing = await AuthActionToken.findOne({ tokenHash, type }).lean<IAuthActionToken>();
    return _classifyFailure(existing);
  },

  /**
   * Kill every outstanding token of one type for one user. Returns the count.
   * Used on re-issue, on a completed password reset, and on account closure.
   */
  async revokeOutstanding(
    userId: string,
    type: ActionTokenType,
    reason: ActionTokenRevokeReason,
  ): Promise<number> {
    const result = await AuthActionToken.updateMany(
      // Deliberately *without* an `expiresAt` predicate: this is a write that closes
      // things down, and revoking an already-expired token costs nothing while filtering
      // on expiry would leave rows in a state the audit trail cannot explain.
      { userId: new mongoose.Types.ObjectId(userId), type, consumedAt: null, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: reason } },
    );
    return result.modifiedCount;
  },

  /** Kill every outstanding token of every type for one user. */
  async revokeAllForUser(userId: string, reason: ActionTokenRevokeReason): Promise<number> {
    const result = await AuthActionToken.updateMany(
      { userId: new mongoose.Types.ObjectId(userId), consumedAt: null, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: reason } },
    );
    return result.modifiedCount;
  },

  /**
   * Count the tokens a user could still spend. Exists for the tests and for support
   * ("how many live reset links exist for this account?"), and carries the explicit
   * expiry predicate that every read here must.
   */
  async countClaimable(userId: string, type: ActionTokenType): Promise<number> {
    return AuthActionToken.countDocuments(
      _claimableFilter({ userId: new mongoose.Types.ObjectId(userId), type }),
    );
  },
};
