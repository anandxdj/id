import mongoose from 'mongoose';
import { hashToken } from '../../common/utils/crypto.utils';
import {
  CODE_REDEMPTION,
  MILLISECONDS,
  TTL_SECONDS,
} from '../../common/constants/index.constants';
import type { CodeRedemptionOutcome } from '../../common/constants/index.constants';
import { OAuthAuthCode } from './oauth-auth-code.model';
import type { IOAuthAuthCode } from './oauth-auth-code.model';

/**
 * The only module that queries `oauthAuthCodes`.
 *
 * Redemption is one atomic single-document compare-and-set. No transaction: a replica
 * set is available, but `findOneAndUpdate` is already atomic and adding a transaction
 * here would buy nothing but latency and new failure modes.
 */

interface CreateAuthCodeInput {
  code: string;
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string;
  nonce?: string;
}

export type CodeRedemption =
  | { outcome: typeof CODE_REDEMPTION.CLAIMED; code: IOAuthAuthCode }
  /** A genuine code presented a second time — revoke what the first redemption issued. */
  | { outcome: typeof CODE_REDEMPTION.REPLAYED; code: IOAuthAuthCode }
  | { outcome: typeof CODE_REDEMPTION.EXPIRED }
  | { outcome: typeof CODE_REDEMPTION.UNKNOWN };

export const AuthCodeStore = {
  async create(input: CreateAuthCodeInput): Promise<void> {
    const now = new Date();
    await OAuthAuthCode.create({
      codeHash: hashToken(input.code),
      userId: new mongoose.Types.ObjectId(input.userId),
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: input.codeChallengeMethod,
      scope: input.scope,
      nonce: input.nonce,
      consumedAt: null,
      createdAt: now,
      expiresAt: new Date(now.getTime() + TTL_SECONDS.AUTH_CODE * MILLISECONDS.SECOND),
    });
  },

  /**
   * Claim a code for redemption, atomically and exactly once.
   *
   * The `expiresAt` predicate is not redundant with the TTL index — the reaper runs on a
   * ~60 s cycle, so without it an expired code stays spendable for up to a minute.
   *
   * The update returns the pre-image (`returnDocument: 'before'`) rather than deleting
   * the row, because the pre-image is the only thing that can tell a replay of a real
   * code apart from a code that never existed.
   */
  async claim(code: string): Promise<CodeRedemption> {
    const codeHash = hashToken(code);
    const now = new Date();

    const claimed = await OAuthAuthCode.findOneAndUpdate(
      { codeHash, consumedAt: null, expiresAt: { $gt: now } },
      { $set: { consumedAt: now } },
      { returnDocument: 'before' },
    ).lean<IOAuthAuthCode>();

    if (claimed) return { outcome: CODE_REDEMPTION.CLAIMED, code: claimed };

    // Lost the claim: work out why. Deliberately a second read rather than part of the
    // update — this branch is the failure path, so an extra round trip costs nothing that
    // matters, and folding it into the CAS would weaken the CAS.
    const existing = await OAuthAuthCode.findOne({ codeHash }).lean<IOAuthAuthCode>();
    if (!existing) return { outcome: CODE_REDEMPTION.UNKNOWN };
    if (existing.consumedAt) return { outcome: CODE_REDEMPTION.REPLAYED, code: existing };
    return { outcome: CODE_REDEMPTION.EXPIRED };
  },

  /** Record which access token a redemption minted, so a later replay knows what to kill. */
  async linkIssuedAccessToken(codeHash: string, accessTokenHash: string): Promise<void> {
    await OAuthAuthCode.updateOne({ codeHash }, { $set: { issuedAccessTokenHash: accessTokenHash } });
  },
};

export type { CodeRedemptionOutcome };
