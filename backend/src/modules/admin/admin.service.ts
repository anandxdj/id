import { ApiError } from '../../common/utils/ApiError';
import {
  ERROR_CODES,
  HTTP_STATUS,
  REVOKE_REASONS,
} from '../../common/constants/index.constants';
import type { UserRole } from '../../common/constants/index.constants';
import * as authService from '../auth/auth.service';
import * as accountService from '../account/account.service';
import * as clientService from '../oauth-client/oauth-client.service';
import * as events from '../events/event.service';
import type { EventContext, EventType } from '../events/event.types';
import { buildClientConfigPrompt, isPromptStack } from './client-prompt.util';
import type { PromptStack } from './client-prompt.util';
import User from '../auth/auth.model';
import type { IUser } from '../auth/auth.model';
import OAuthClient from '../oauth-client/oauth-client.model';
import AuthEvent from '../events/event.model';
import type { CreateClientInput } from './dto/create-client.schema';
import type { UpdateClientInput } from './dto/update-client.schema';

/** Context for an admin-performed action (the admin is the actor; a user/client is the target). */
export type AdminActionCtx = Pick<EventContext, 'actorUserId' | 'actorRole' | 'ip' | 'ua'>;

const since = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toAdminUser = (u: IUser) => ({
  id: u._id.toString(),
  name: u.name,
  email: u.email,
  role: u.role,
  isVerified: u.isVerified,
  disabled: u.disabled,
  disabledReason: u.disabledReason ?? '',
  disabledAt: u.disabledAt ?? null,
  createdAt: u.createdAt,
});

// ── Users ──────────────────────────────────────────────────────────────────────
export const listUsers = async ({
  search,
  page = 1,
  limit = 20,
}: {
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const lim = Math.min(Math.max(limit, 1), 100);
  const pg = Math.max(page, 1);
  const filter = search
    ? { $or: [{ name: new RegExp(escapeRegex(search), 'i') }, { email: new RegExp(escapeRegex(search), 'i') }] }
    : {};
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim),
    User.countDocuments(filter),
  ]);
  return { items: items.map(toAdminUser), total, page: pg, limit: lim };
};

/** Full picture of one user: profile, sessions, authorized apps, recent activity. */
export const getUser = async (id: string) => {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  const [sessions, apps, activity] = await Promise.all([
    authService.listSessions(id),
    accountService.listApps(id),
    events.query({ actorUserId: id, limit: 50 }),
  ]);
  return { user: toAdminUser(user), sessions, apps, activity };
};

/**
 * Suspend an account.
 *
 * The user document is written first — it is what login gates on — and every credential
 * the account holds is revoked after it. That fan-out is `revokeAllCredentials` rather
 * than a session sweep because refresh tokens became durable records in M3: revoking the
 * session alone would leave the suspended user holding a token that mints a new one. That
 * is the reference's §2.3-15 exactly.
 *
 * The snapshot re-stamp matters for a second reason since M3: `auth.middleware` reads
 * `disabled` from the session document instead of the user, so a suspension has to reach
 * the sessions or it does not take effect until they expire.
 */
export const suspendUser = async (id: string, reason: string | undefined, ctx: AdminActionCtx) => {
  const user = await User.findByIdAndUpdate(
    id,
    { $set: { disabled: true, disabledReason: reason ?? '', disabledAt: new Date() } },
    { new: true },
  );
  if (!user) throw ApiError.notFound('User not found');

  const revoked = await authService.applyAccountSnapshotChange(
    id,
    { disabled: true },
    REVOKE_REASONS.USER_SUSPENDED,
  );
  events.record('admin.user.suspended', { ...ctx, targetUserId: id, meta: { reason, ...revoked } });
  return toAdminUser(user);
};

export const unsuspendUser = async (id: string, ctx: AdminActionCtx) => {
  const user = await User.findByIdAndUpdate(
    id,
    { $set: { disabled: false }, $unset: { disabledReason: '', disabledAt: '' } },
    { new: true },
  );
  if (!user) throw ApiError.notFound('User not found');
  // No sessions should exist to re-stamp — suspension revoked them all — but a session
  // created in the window between the two writes would otherwise carry `disabled: true`
  // forever, and the middleware now believes that field.
  await authService.applySessionSnapshot(id, { disabled: false });
  events.record('admin.user.unsuspended', { ...ctx, targetUserId: id });
  return toAdminUser(user);
};

/**
 * Change a user's role, and end every session they hold.
 *
 * Revoking rather than merely re-stamping is what makes the denormalised `sessions.role`
 * safe to trust: no session survives a role change, so no session can carry a role its
 * user no longer has. A demotion that let the session live would leave a demoted admin
 * holding admin authority until the session expired — the exact privilege bug that kept
 * `auth.middleware` re-reading the user until M3.
 *
 * Self-targeting is refused. An admin demoting themselves would revoke the session the
 * request is being made on, which is a footgun rather than a feature; the broader
 * admin-protects-admin and last-admin guards belong to M5.
 */
export const changeUserRole = async (id: string, role: UserRole, ctx: AdminActionCtx) => {
  if (ctx.actorUserId && ctx.actorUserId === id) {
    throw ApiError.fromCode(HTTP_STATUS.FORBIDDEN, ERROR_CODES.CANNOT_TARGET_SELF);
  }

  const user = await User.findByIdAndUpdate(id, { $set: { role } }, { new: true });
  if (!user) throw ApiError.notFound('User not found');

  const revoked = await authService.applyAccountSnapshotChange(
    id,
    { role },
    REVOKE_REASONS.ROLE_CHANGED,
    ctx,
  );
  events.record('admin.user.role_changed', { ...ctx, targetUserId: id, meta: { role, ...revoked } });
  return toAdminUser(user);
};

// ── Metrics + activity feed ──────────────────────────────────────────────────────
export const metrics = async () => {
  const [totalUsers, disabledUsers, totalClients, suspendedClients, activeUserIds, logins24h] =
    await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ disabled: true }),
      OAuthClient.countDocuments({}),
      OAuthClient.countDocuments({ suspended: true }),
      AuthEvent.distinct('actorUserId', { type: 'login.success', createdAt: { $gte: since(7) } }),
      AuthEvent.countDocuments({ type: 'login.success', createdAt: { $gte: since(1) } }),
    ]);
  return {
    totalUsers,
    disabledUsers,
    activeUsers7d: activeUserIds.length,
    logins24h,
    totalClients,
    suspendedClients,
  };
};

export const activity = ({
  type,
  clientId,
  actorUserId,
  limit,
}: {
  type?: EventType | EventType[];
  clientId?: string;
  actorUserId?: string;
  limit?: number;
}) => events.query({ type, clientId, actorUserId, limit: limit ?? 100 });

// ── OAuth clients ──────────────────────────────────────────────────────────────
const toAdminClient = (c: {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  description: string;
  logoUrl: string;
  suspended: boolean;
  suspendedReason?: string;
  createdAt: Date;
}) => ({
  clientId: c.clientId,
  clientName: c.clientName,
  redirectUris: c.redirectUris,
  description: c.description,
  logoUrl: c.logoUrl,
  suspended: c.suspended,
  suspendedReason: c.suspendedReason ?? '',
  createdAt: c.createdAt,
});

export const listClients = async () => (await clientService.list()).map(toAdminClient);

/** Create a client and return its one-time secret + a ready-to-paste config-prompt. */
export const createClient = async (input: CreateClientInput, ctx: AdminActionCtx) => {
  const created = await clientService.create({
    clientName: input.clientName,
    redirectUris: input.redirectUris,
    description: input.description,
    logoUrl: input.logoUrl,
  });
  events.record('admin.client.created', { ...ctx, clientId: created.clientId, meta: { clientName: created.clientName } });
  const configPrompt = buildClientConfigPrompt(
    { clientId: created.clientId, clientName: created.clientName, redirectUris: created.redirectUris },
    { stack: input.stack },
  );
  return { ...created, configPrompt };
};

export const updateClient = async (clientId: string, input: UpdateClientInput, ctx: AdminActionCtx) => {
  const updated = await clientService.update(clientId, input);
  if (!updated) throw ApiError.notFound('Client not found');
  events.record('admin.client.updated', { ...ctx, clientId, meta: { fields: Object.keys(input) } });
  return toAdminClient(updated);
};

export const rotateClientSecret = async (clientId: string, ctx: AdminActionCtx) => {
  const result = await clientService.rotateSecret(clientId);
  if (!result) throw ApiError.notFound('Client not found');
  events.record('admin.client.secret_rotated', { ...ctx, clientId });
  return { clientId, clientSecret: result.clientSecret };
};

export const setClientSuspended = async (
  clientId: string,
  suspended: boolean,
  reason: string | undefined,
  ctx: AdminActionCtx,
) => {
  const updated = await clientService.setSuspended(clientId, suspended, reason);
  if (!updated) throw ApiError.notFound('Client not found');
  events.record(suspended ? 'admin.client.suspended' : 'admin.client.unsuspended', {
    ...ctx,
    clientId,
    meta: { reason },
  });
  return toAdminClient(updated);
};

export const getClientConfigPrompt = async (clientId: string, stack?: string) => {
  const client = await clientService.findByClientId(clientId);
  if (!client) throw ApiError.notFound('Client not found');
  const chosen: PromptStack | undefined = isPromptStack(stack) ? stack : undefined;
  return buildClientConfigPrompt(
    { clientId: client.clientId, clientName: client.clientName, redirectUris: client.redirectUris },
    { stack: chosen },
  );
};
