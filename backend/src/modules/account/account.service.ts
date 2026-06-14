import { ApiError } from '../../common/utils/ApiError';
import * as authService from '../auth/auth.service';
import * as oauthService from '../oauth/oauth.service';
import * as clientService from '../oauth-client/oauth-client.service';
import * as events from '../events/event.service';
import type { EventContext } from '../events/event.types';
import Consent from '../oauth/consent.model';
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

export const listSessions = (userId: string, currentSid?: string | null) =>
  authService.listSessions(userId, currentSid);

export const revokeSession = async (
  userId: string,
  sid: string,
  ctx: ActionCtx = {},
): Promise<void> => {
  const ok = await authService.revokeSession(userId, sid, ctx);
  if (!ok) throw ApiError.notFound('No such session');
};

export const revokeAllSessions = (userId: string, exceptSid?: string | null, ctx: ActionCtx = {}) =>
  authService.revokeAllSessions(userId, exceptSid, ctx);

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
