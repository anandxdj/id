import mongoose from 'mongoose';
import { hashToken } from '../../common/utils/crypto.utils';
import { REFRESH_TOKEN_STATUS } from '../../common/constants/index.constants';
import type { RevokeReason } from '../../common/constants/index.constants';
import { RefreshToken } from './refresh-token.model';
import type { IRefreshToken } from './refresh-token.model';

/**
 * The only module that queries the `refreshTokens` collection.
 *
 * Same discipline as every other store here: concentrating the queries is what makes
 * "every read filters on expiry" reviewable rather than aspirational. Two reads break
 * that rule on purpose and say so at the call site — classifying a *failed* rotation has
 * to be able to see an expired or already-spent document, because that document is the
 * evidence. Filtering it out would collapse "a genuine token replayed" into "a token that
 * never existed", which is exactly how the reference ends up with lineage columns nothing
 * reads (§2.3-3).
 *
 * Nothing here decides policy. The store performs single-document atomic operations and
 * indexed bulk writes; whether a failed claim is theft or a client race is
 * `refresh-token.service.ts`'s judgement to make.
 */

export interface CreateRefreshTokenInput {
  _id: mongoose.Types.ObjectId;
  tokenHash: string;
  tokenJti: string;
  familyId: mongoose.Types.ObjectId;
  sessionId: string;
  userId: mongoose.Types.ObjectId;
  parentTokenId: mongoose.Types.ObjectId | null;
  issuedAt: Date;
  expiresAt: Date;
}

export const RefreshTokenStore = {
  /** Derive the stored lookup key for a token. The one place this hash is computed. */
  hashOf(token: string): string {
    return hashToken(token);
  },

  newId(): mongoose.Types.ObjectId {
    return new mongoose.Types.ObjectId();
  },

  async create(input: CreateRefreshTokenInput): Promise<IRefreshToken> {
    const created = await RefreshToken.create({
      ...input,
      status: REFRESH_TOKEN_STATUS.ACTIVE,
      replacedByTokenId: null,
      rotatedAt: null,
      revokedAt: null,
    });
    return created.toObject();
  },

  /**
   * The rotation claim: flip `active` → `rotated` and name the heir, atomically, returning
   * the **pre-image**.
   *
   * Exactly one concurrent caller can win; every other gets `null`. The pre-image is what
   * distinguishes a replay from an unknown token — `findOneAndDelete` would throw that
   * distinction away, and the distinction is the entire security value of rotation.
   *
   * `replacedByTokenId` is set in this same update rather than afterwards, and the child
   * row is inserted *before* this runs. Together those two facts give the loser a
   * guarantee it can act on: if it observes `status: 'rotated'`, the heir both exists and
   * is nameable, so the grace path can return it instead of asking for a retry.
   */
  async claimForRotation(
    tokenHash: string,
    childId: mongoose.Types.ObjectId,
    now: Date,
  ): Promise<IRefreshToken | null> {
    return RefreshToken.findOneAndUpdate(
      {
        tokenHash,
        status: REFRESH_TOKEN_STATUS.ACTIVE,
        expiresAt: { $gt: now },
      },
      {
        $set: {
          status: REFRESH_TOKEN_STATUS.ROTATED,
          rotatedAt: now,
          replacedByTokenId: childId,
        },
      },
      { returnDocument: 'before' },
    ).lean<IRefreshToken>();
  },

  /**
   * Read a token by hash **without** an expiry predicate.
   *
   * Deliberate, and the only safe way to classify a failed claim: an expired or rotated
   * document is precisely what the caller needs to see. Nothing authenticates off this
   * read — `claimForRotation` is the gate, and it carries the predicate.
   */
  async findByHashForClassification(tokenHash: string): Promise<IRefreshToken | null> {
    return RefreshToken.findOne({ tokenHash }).lean<IRefreshToken>();
  },

  /** Read a token by id, again unfiltered, to inspect the heir named by a rotated parent. */
  async findByIdForClassification(
    id: mongoose.Types.ObjectId,
  ): Promise<IRefreshToken | null> {
    return RefreshToken.findById(id).lean<IRefreshToken>();
  },

  /** Delete a child that lost the race for its parent and was therefore never handed out. */
  async deleteUnissued(id: mongoose.Types.ObjectId): Promise<void> {
    await RefreshToken.deleteOne({ _id: id, status: REFRESH_TOKEN_STATUS.ACTIVE });
  },

  /** Revoke one token, whatever state it is in. Used when a rotation cannot complete. */
  async revokeOne(id: mongoose.Types.ObjectId, reason: RevokeReason): Promise<void> {
    await RefreshToken.updateOne(
      { _id: id, status: { $ne: REFRESH_TOKEN_STATUS.REVOKED } },
      { $set: { status: REFRESH_TOKEN_STATUS.REVOKED, revokedAt: new Date(), revokedReason: reason } },
    );
  },

  /**
   * Kill an entire family. The blast radius of reuse detection.
   *
   * Deliberately *not* filtered on expiry: this is a write that closes things down, and
   * skipping already-expired rows would leave the family in a state the audit trail cannot
   * explain.
   */
  async revokeFamily(
    familyId: mongoose.Types.ObjectId,
    reason: RevokeReason,
  ): Promise<number> {
    const result = await RefreshToken.updateMany(
      { familyId, status: { $ne: REFRESH_TOKEN_STATUS.REVOKED } },
      { $set: { status: REFRESH_TOKEN_STATUS.REVOKED, revokedAt: new Date(), revokedReason: reason } },
    );
    return result.modifiedCount;
  },

  /**
   * Kill every token belonging to one session. Sign-out of a single device.
   *
   * Scoped by `userId` as well as by handle, because the handle is what the sessions API
   * accepts from a client: a value that arrived over HTTP must never be sufficient on its
   * own to revoke somebody else's credentials.
   */
  async revokeForSession(
    userId: string,
    sessionId: string,
    reason: RevokeReason,
  ): Promise<number> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return 0;
    const result = await RefreshToken.updateMany(
      {
        userId: new mongoose.Types.ObjectId(userId),
        sessionId,
        status: { $ne: REFRESH_TOKEN_STATUS.REVOKED },
      },
      { $set: { status: REFRESH_TOKEN_STATUS.REVOKED, revokedAt: new Date(), revokedReason: reason } },
    );
    return result.modifiedCount;
  },

  /**
   * Kill every token a user holds, optionally sparing one session's.
   *
   * One indexed `updateMany` because `userId` is denormalised onto the row. The reference
   * has to loop over sessions to achieve the same thing, which is part of why its
   * revocation paths miss refresh tokens entirely (§2.3-15).
   */
  async revokeAllForUser(
    userId: string,
    options: { reason: RevokeReason; exceptSessionId?: string | null },
  ): Promise<number> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return 0;
    const result = await RefreshToken.updateMany(
      {
        userId: new mongoose.Types.ObjectId(userId),
        status: { $ne: REFRESH_TOKEN_STATUS.REVOKED },
        ...(options.exceptSessionId ? { sessionId: { $ne: options.exceptSessionId } } : {}),
      },
      { $set: { status: REFRESH_TOKEN_STATUS.REVOKED, revokedAt: new Date(), revokedReason: options.reason } },
    );
    return result.modifiedCount;
  },

  /**
   * How many tokens a user could still present. Carries the expiry predicate that every
   * *read* here must; exists for the tests and for support.
   */
  async countActiveForUser(userId: string): Promise<number> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return 0;
    return RefreshToken.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      status: REFRESH_TOKEN_STATUS.ACTIVE,
      expiresAt: { $gt: new Date() },
    });
  },
};
