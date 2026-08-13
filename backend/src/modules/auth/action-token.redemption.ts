import { ApiError } from '../../common/utils/ApiError';
import {
  ACTION_TOKEN_OUTCOME,
  ERROR_CODES,
  HTTP_STATUS,
} from '../../common/constants/index.constants';
import type { ActionTokenOutcome, ActionTokenType } from '../../common/constants/index.constants';
import * as events from '../events/event.service';
import type { EventContext } from '../events/event.types';
import { AccountState } from './account-state';
import { ActionTokenStore } from './action-token.store';
import { UserStore } from './user.store';
import type { IUser } from './auth.model';

/**
 * The one path from "a token arrived over HTTP" to "here is the account it belongs to".
 *
 * Both mailbox-authenticated flows — verification and password reset — need the identical
 * sequence of guards, and this exists so there is exactly one copy of it. That is not tidiness
 * for its own sake: the reference implementation's §2.3-11 is precisely the bug that two copies
 * produce. It checks account state on login and forgets to on token redemption, so a suspended
 * user redeems a verification token minted before the suspension. One missing conditional, on
 * one of several call sites, and suspension is bypassable.
 *
 * Every guard, in order:
 *
 *  1. **Atomic single-use claim.** One winner under concurrency, no transaction (D2).
 *  2. **A live account.** Looked up through `UserStore`, so `deletedAt: null` applies here as
 *     on every other credential path.
 *  3. **A usable account.** Suspended and closed accounts are refused identically.
 *  4. **The address still matches.** A token is bound to the mailbox it was mailed to, so a
 *     link issued before an address change — including the tombstone written by account
 *     closure — resolves to nothing.
 *
 * A failure at step 2, 3, or 4 leaves the token **spent**, deliberately. It was a genuine
 * token and it has now been presented; leaving it replayable until somebody reinstates the
 * account would mean the token outlived the state that invalidated it.
 */
type ActionCtx = Pick<EventContext, 'ip' | 'ua'>;

export const ActionTokenRedemption = {
  /**
   * Claim a token and return the account it belongs to. Throws `ApiError` on every failure.
   *
   * The thrown error is `ACTION_TOKEN_EXPIRED` for an expired token and
   * `INVALID_ACTION_TOKEN` for everything else, so a replay of a real token is
   * indistinguishable from an invented one. The internal distinction survives in the
   * `action_token.rejected` event, which is the only place it is visible.
   */
  async redeem(
    token: string,
    type: ActionTokenType,
    ctx: ActionCtx = {},
  ): Promise<{ user: IUser; sentToEmail: string }> {
    const claim = await ActionTokenStore.claim(token, type);

    if (claim.outcome !== ACTION_TOKEN_OUTCOME.CLAIMED || !claim.token) {
      events.record('action_token.rejected', {
        ...ctx,
        actorUserId: claim.token?.userId.toString(),
        meta: { type, outcome: claim.outcome },
      });
      throw _rejection(claim.outcome);
    }

    const userId = claim.token.userId.toString();
    const user = await UserStore.findLiveById(userId);
    if (!user) throw _rejection(ACTION_TOKEN_OUTCOME.UNKNOWN);

    // Throws 403 `ACCOUNT_UNAVAILABLE`, which is a *different* answer from an invalid token on
    // purpose: reaching this point required a genuine token, so there is no oracle in
    // admitting that the account exists and cannot be used.
    AccountState.assertUsable(user);

    if (claim.token.sentToEmail !== user.email) {
      throw _rejection(ACTION_TOKEN_OUTCOME.UNKNOWN);
    }

    return { user, sentToEmail: claim.token.sentToEmail };
  },
};

/** Internal: map a claim outcome to the single client-facing answer it is allowed to have. */
const _rejection = (outcome: ActionTokenOutcome): ApiError =>
  ApiError.fromCode(
    HTTP_STATUS.BAD_REQUEST,
    outcome === ACTION_TOKEN_OUTCOME.EXPIRED
      ? ERROR_CODES.ACTION_TOKEN_EXPIRED
      : ERROR_CODES.INVALID_ACTION_TOKEN,
  );
