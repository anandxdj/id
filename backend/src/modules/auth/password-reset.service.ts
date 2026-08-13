import { EmailService } from '../../common/config/email';
import { EmailTemplates } from '../../common/email/index.email';
import {
  ACTION_TOKEN_REVOKE_REASONS,
  ACTION_TOKEN_TYPES,
  REVOKE_REASONS,
} from '../../common/constants/index.constants';
import * as events from '../events/event.service';
import type { EventContext } from '../events/event.types';
import { AccountState } from './account-state';
import { ActionTokenRedemption } from './action-token.redemption';
import { ActionTokenStore } from './action-token.store';
import { PasswordService } from './password.service';
import { UserStore } from './user.store';
import { revokeAllCredentials } from './auth.service';

/**
 * Forgot / reset password.
 *
 * Same token discipline as verification — hashed at rest, type-discriminated, single-use
 * via an atomic claim, prior tokens revoked on re-issue — plus the one thing that makes a
 * reset flow worth having: **a completed reset revokes every session and every OAuth access
 * token the account holds.**
 *
 * That is not a nicety. The reason a user resets a password is usually that someone else
 * has it. A reset that leaves the intruder's session alive has changed a string and
 * achieved nothing, which is precisely the reference implementation's behaviour (§2.3-15):
 * it revokes the session row and leaves refresh tokens and third-party access tokens live.
 */
type ActionCtx = Pick<EventContext, 'ip' | 'ua'>;

export const PasswordResetService = {
  /**
   * Begin a reset.
   *
   * Silent on every failure branch — unknown address, suspended account, social-only
   * account with no password to reset — because the controller answers identically in all
   * of them. A 404 here, or a different message, is an account-existence oracle on an
   * unauthenticated endpoint, which is one of the four the reference leaks through
   * (§2.3-13).
   */
  async request(email: string, ctx: ActionCtx = {}): Promise<void> {
    const user = await UserStore.findLiveByEmail(email);
    if (!user) return;
    if (!AccountState.isUsable(user)) return;

    const { token } = await ActionTokenStore.issue({
      userId: user._id.toString(),
      type: ACTION_TOKEN_TYPES.PASSWORD_RESET,
      sentToEmail: user.email,
    });

    // Persisted first, dispatched second, never awaited: the token survives a provider
    // outage, and the caller is not made to wait on Resend.
    EmailService.dispatch({
      to: user.email,
      ...EmailTemplates.resetPassword({ name: user.name, token }),
    });

    events.record('password.reset.requested', { actorUserId: user._id.toString(), ...ctx });
  },

  /**
   * Complete a reset.
   *
   * Order is load-bearing:
   *
   *  1. Claim the token atomically — one winner, so two concurrent redemptions cannot both
   *     set a password (§2.3-8).
   *  2. Check account state, because a token minted before a suspension must not survive it
   *     (§2.3-11).
   *  3. Write the new digest.
   *  4. *Then* revoke everything. Revoking before the write would leave a window in which
   *     the old password still works and the user has been signed out; revoking after means
   *     the worst case is a successful reset whose revocation is retried by the next
   *     request that touches a dead session.
   */
  async reset(
    input: { token: string; password: string },
    ctx: ActionCtx = {},
  ): Promise<{ sessionsRevoked: number; accessTokensRevoked: number }> {
    // Step 1 and 2: the atomic claim and every account guard, single-sourced so this flow and
    // verification cannot disagree about what a redeemable token is.
    const { user } = await ActionTokenRedemption.redeem(
      input.token,
      ACTION_TOKEN_TYPES.PASSWORD_RESET,
      ctx,
    );
    const userId = user._id.toString();

    // Calls out to the password service — hashing policy lives there, not here.
    const passwordHash = await PasswordService.hash(input.password);
    await UserStore.setPasswordHash(userId, passwordHash);

    // Every other outstanding link is now stale: the mailbox has been used once to prove
    // control, and leaving a second reset token live would mean an attacker who requested
    // one in parallel still holds a working one.
    await ActionTokenStore.revokeAllForUser(userId, ACTION_TOKEN_REVOKE_REASONS.PASSWORD_RESET);

    // The whole point of the flow. Sessions and OIDC access tokens both, because either one
    // left alive keeps the intruder in.
    const revoked = await revokeAllCredentials(userId, REVOKE_REASONS.PASSWORD_RESET, ctx);

    EmailService.dispatch({
      to: user.email,
      ...EmailTemplates.passwordChanged({ name: user.name }),
    });

    events.record('password.reset.completed', {
      actorUserId: userId,
      actorRole: user.role,
      ...ctx,
      meta: revoked,
    });

    return revoked;
  },
};
