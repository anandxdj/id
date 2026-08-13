import { hashToken } from '../../common/utils/crypto.utils';
import { MILLISECONDS, TTL_SECONDS } from '../../common/constants/index.constants';
import { OAuthState } from './oauth-state.model';
import type { IOAuthState } from './oauth-state.model';

/**
 * The only module that queries `oauthStates`.
 *
 * Consumption is a single-document compare-and-set with the pre-image returned, the
 * same shape used for authorization codes: exactly one caller can win the claim, and
 * the returned document is what tells a replay of a real state apart from a forged one.
 * No transaction is involved or needed.
 */
export const OAuthStateStore = {
  async create(input: { state: string; provider: string; returnTo?: string }): Promise<void> {
    const now = new Date();
    await OAuthState.create({
      stateHash: hashToken(input.state),
      provider: input.provider,
      returnTo: input.returnTo,
      consumedAt: null,
      createdAt: now,
      expiresAt: new Date(now.getTime() + TTL_SECONDS.OAUTH_STATE * MILLISECONDS.SECOND),
    });
  },

  /**
   * Atomically claim a state. Returns the pre-image on success and `null` when the
   * state is unknown, already consumed, or expired — the `expiresAt` predicate is
   * explicit because the TTL reaper lags by up to a minute.
   */
  async consume(state: string): Promise<IOAuthState | null> {
    const now = new Date();
    return OAuthState.findOneAndUpdate(
      { stateHash: hashToken(state), consumedAt: null, expiresAt: { $gt: now } },
      { $set: { consumedAt: now } },
      { returnDocument: 'before' },
    ).lean<IOAuthState>();
  },
};
