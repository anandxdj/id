import { ApiError } from '../../common/utils/ApiError';
import {
  ACTION_TOKEN_REVOKE_REASONS,
  REVOKE_REASONS,
} from '../../common/constants/index.constants';
import { Logger } from '../../common/logger/index.logger';
import * as authService from '../auth/auth.service';
import * as oauthService from '../oauth/oauth.service';
import * as clientService from '../oauth-client/oauth-client.service';
import * as events from '../events/event.service';
import type { EventContext } from '../events/event.types';
import { ActionTokenStore } from '../auth/action-token.store';
import { UserStore } from '../auth/user.store';
import Consent from '../oauth/consent.model';
import Identity from '../auth/identity.model';
import User from '../auth/auth.model';
import type { ProfileInput } from './dto/profile.schema';

type ActionCtx = Pick<EventContext, 'ip' | 'ua'>;

export interface AuthorizedApp {
  clientId: string;
  clientName: string;
  logoUrl: string;
  description: string;
  scope: string;
  authorizedAt: Date;
  lastUsedAt: Date | null;
}

/** Apps the user has consented to, enriched with display info + last-used time. */
export const listApps = async (userId: string): Promise<AuthorizedApp[]> => {
  const [consents, lastUsed] = await Promise.all([
    Consent.find({ userId }).sort({ updatedAt: -1 }).lean(),
    events.lastUsedByClient(userId),
  ]);
  return Promise.all(
    consents.map(async (c): Promise<AuthorizedApp> => {
      const client = await clientService.findByClientId(c.clientId);
      return {
        clientId: c.clientId,
        clientName: client?.clientName ?? c.clientId,
        logoUrl: client?.logoUrl ?? '',
        description: client?.description ?? '',
        scope: c.scope,
        authorizedAt: c.createdAt,
        lastUsedAt: lastUsed[c.clientId] ?? null,
      };
    }),
  );
};

/** Revoke an app: drop the consent and invalidate that app's live access tokens. */
export const revokeApp = async (
  userId: string,
  clientId: string,
  ctx: ActionCtx = {},
): Promise<{ revokedTokens: number }> => {
  const consent = await Consent.findOneAndDelete({ userId, clientId });
  if (!consent) throw ApiError.notFound('No such authorized app');
  const revokedTokens = await oauthService.revokeAccessTokensForClient(userId, clientId);
  events.record('consent.revoked', { actorUserId: userId, clientId, ...ctx, meta: { revokedTokens } });
  return { revokedTokens };
};

/**
 * Sessions are addressed by **handle** throughout this surface — the value the API
 * publishes as `sid`, and the value the middleware puts on `req.user.sessionId`. The raw
 * session id stays inside the token it was minted into and never reaches a controller.
 */
export const listSessions = (userId: string, currentHandle?: string | null) =>
  authService.listSessions(userId, currentHandle);

export const revokeSession = async (
  userId: string,
  handle: string,
  ctx: ActionCtx = {},
): Promise<void> => {
  const ok = await authService.revokeSession(userId, handle, ctx);
  if (!ok) throw ApiError.notFound('No such session');
};

export const revokeAllSessions = (
  userId: string,
  exceptHandle?: string | null,
  ctx: ActionCtx = {},
) => authService.revokeAllSessions(userId, exceptHandle, ctx);

const toProfile = (u: {
  _id: { toString(): string };
  name: string;
  email: string;
  role: string;
  isVerified: boolean;
  profilePictureUrl?: string;
  bio?: string;
  jobTitle?: string;
  company?: string;
  country?: string;
}) => ({
  id: u._id.toString(),
  name: u.name,
  email: u.email,
  role: u.role,
  isVerified: u.isVerified,
  profilePictureUrl: u.profilePictureUrl ?? '',
  bio: u.bio ?? '',
  jobTitle: u.jobTitle ?? '',
  company: u.company ?? '',
  country: u.country ?? '',
});

export const getProfile = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return toProfile(user);
};

/** Update editable profile fields only (the DTO already stripped role/email/etc). */
export const updateProfile = async (userId: string, input: ProfileInput) => {
  const user = await User.findByIdAndUpdate(userId, { $set: input }, { new: true });
  if (!user) throw ApiError.notFound('User not found');
  return toProfile(user);
};

export interface DeletionSummary {
  sessionsRevoked: number;
  /** M3: refresh tokens are durable records now, so they are revoked explicitly. */
  refreshTokensRevoked: number;
  accessTokensRevoked: number;
  consentsRevoked: number;
  identitiesUnlinked: number;
  actionTokensRevoked: number;
}

/**
 * Close an account, for real.
 *
 * The UI has been telling users their data is gone while the backend did nothing at all —
 * a ship blocker, and the reason this is here rather than in M7. What "for real" means
 * concretely, in the order it happens:
 *
 *  1. **Stamp the tombstone first.** `UserStore.softDelete` sets `deletedAt`, disables the
 *     account, drops the password digest, and moves the address to `deletedEmail` — which is
 *     what frees it for re-registration. Every credential lookup filters `deletedAt: null`,
 *     so this single write is what actually ends the account's ability to authenticate. It
 *     goes first deliberately: if anything after it fails, the account is already closed,
 *     and the remaining steps are cleanup that a retry or a support action can finish.
 *  2. **Revoke sessions and OIDC access tokens**, so nothing already issued keeps working.
 *  3. **Revoke outstanding action tokens**, so a verification or reset link mailed before
 *     closure cannot be redeemed against the closed account.
 *  4. **Drop consents and unlink identities.**
 *
 * Identities are *deleted* rather than flagged, because a soft flag would leave the unique
 * `{ provider, providerAccountId }` key occupied and the same Google account could never be
 * linked again — the identity-shaped version of the reference's "deletion burns the address
 * forever" bug (§2.3-16). The `account.deleted` event records which providers were unlinked,
 * so the audit trail survives the rows.
 *
 * No transaction, per D2: step 1 is a single-document write and is the authoritative gate, so
 * everything after it is fail-forward cleanup rather than part of an atomic set.
 */
export const deleteAccount = async (
  userId: string,
  ctx: ActionCtx = {},
): Promise<DeletionSummary> => {
  const user = await UserStore.findLiveById(userId);
  if (!user) throw ApiError.notFound('User not found');

  const providers = (await Identity.find({ userId }).lean()).map((i) => i.provider);

  const closed = await UserStore.softDelete(userId);
  if (!closed) throw ApiError.notFound('User not found');

  const { sessionsRevoked, refreshTokensRevoked, accessTokensRevoked } =
    await authService.revokeAllCredentials(userId, REVOKE_REASONS.USER_DELETED, ctx);

  const actionTokensRevoked = await ActionTokenStore.revokeAllForUser(
    userId,
    ACTION_TOKEN_REVOKE_REASONS.ACCOUNT_DELETED,
  );

  const [consents, identities] = await Promise.all([
    Consent.deleteMany({ userId }),
    Identity.deleteMany({ userId }),
  ]);

  const summary: DeletionSummary = {
    sessionsRevoked,
    refreshTokensRevoked,
    accessTokensRevoked,
    consentsRevoked: consents.deletedCount ?? 0,
    identitiesUnlinked: identities.deletedCount ?? 0,
    actionTokensRevoked,
  };

  events.record('account.deleted', {
    actorUserId: userId,
    targetUserId: userId,
    actorRole: user.role,
    ...ctx,
    meta: { ...summary, providers },
  });
  Logger.info('Account closed', { userId, ...summary });

  return summary;
};
