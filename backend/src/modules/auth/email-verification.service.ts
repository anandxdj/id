import { EmailService } from '../../common/config/email';
import { EmailTemplates } from '../../common/email/index.email';
import { ACTION_TOKEN_TYPES } from '../../common/constants/index.constants';
import * as events from '../events/event.service';
import type { EventContext } from '../events/event.types';
import { AccountState } from './account-state';
import { ActionTokenRedemption } from './action-token.redemption';
import { ActionTokenStore } from './action-token.store';
import { UserStore } from './user.store';
import type { IUser } from './auth.model';

/**
 * Email verification: issue, verify, resend.
 *
 * The ordering rule that runs through all three: **persist the token, then attempt
 * delivery, and never wait on the provider.** The token is durable the moment it is
 * written, so an outage at Resend cannot lose the only verification link a user will get —
 * it just means they press resend. That is also why there is no queue here: ordering plus
 * a user-triggered retry gets the same guarantee with no worker to operate.
 */
type ActionCtx = Pick<EventContext, 'ip' | 'ua'>;

/**
 * Internal: mint a token for a user and put the mail in flight.
 *
 * Shared by registration and resend so the two cannot drift — in particular so that both
 * inherit the prior-token revocation `ActionTokenStore.issue` performs, which is what makes
 * an older link in an older inbox stop working.
 */
const _issueAndSend = async (user: IUser, ctx: ActionCtx = {}): Promise<void> => {
  const { token } = await ActionTokenStore.issue({
    userId: user._id.toString(),
    type: ACTION_TOKEN_TYPES.EMAIL_VERIFICATION,
    sentToEmail: user.email,
  });

  // Calls out to the mail transport, fire-and-forget: the token is already durable, and
  // the response must not be held open by a third party.
  EmailService.dispatch({
    to: user.email,
    ...EmailTemplates.verifyEmail({ name: user.name, token }),
  });

  // Note what is absent from the event: the token. The activity log is queryable by
  // support and by the admin surface, which makes it exactly as unsuitable a place for a
  // live credential as a log line.
  events.record('email.verification.sent', { actorUserId: user._id.toString(), ...ctx });
};

export const EmailVerificationService = {
  /** Issue the first verification token for a freshly registered account. */
  async issueForNewUser(user: IUser, ctx: ActionCtx = {}): Promise<void> {
    await _issueAndSend(user, ctx);
  },

  /**
   * Re-issue a verification token for an address.
   *
   * Returns nothing and throws nothing for an unknown or already-verified address: the
   * controller answers identically in every case, because a different status, message, or
   * field here would be a working account-existence oracle on an unauthenticated endpoint.
   * Every branch that ends in "no mail sent" is silent by design.
   */
  async resend(email: string, ctx: ActionCtx = {}): Promise<void> {
    const user = await UserStore.findLiveByEmail(email);
    if (!user) return;
    if (!AccountState.isUsable(user)) return;
    // Already verified: nothing to confirm, and re-sending would let anyone mail-bomb a
    // verified address through a public endpoint.
    if (user.isVerified) return;

    await _issueAndSend(user, ctx);
  },

  /**
   * Redeem a verification token.
   *
   * Two things this deliberately does not do. It does not mint a session — verifying an
   * address is not authenticating a person, and conflating them is what makes the
   * reference's missing account-state check (§2.3-11) escalate from "wrong flag set" to
   * "suspended user holds a live session". And it does not tell the caller *why* a token
   * failed beyond expired-versus-not.
   */
  async verify(token: string, ctx: ActionCtx = {}): Promise<{ email: string }> {
    // Every guard — atomic claim, live account, usable account, address still bound — lives in
    // one place, so neither flow can drift out of agreement with the other.
    const { user } = await ActionTokenRedemption.redeem(
      token,
      ACTION_TOKEN_TYPES.EMAIL_VERIFICATION,
      ctx,
    );
    const userId = user._id.toString();

    // Calls out to the user store, which owns every credential-flow write.
    await UserStore.markEmailVerified(userId);
    events.record('email.verified', { actorUserId: userId, actorRole: user.role, ...ctx });

    return { email: user.email };
  },
};
