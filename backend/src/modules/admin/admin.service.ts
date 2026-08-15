import mongoose from 'mongoose';
import { ApiError } from '../../common/utils/ApiError';
import {
  PAGINATION,
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
import { AdminGuards } from './admin.guards';
import { UserStore } from '../auth/user.store';
import User from '../auth/auth.model';
import type { IUser } from '../auth/auth.model';
import OAuthClient from '../oauth-client/oauth-client.model';
import type { IOAuthClient } from '../oauth-client/oauth-client.model';
import { ClientPolicy } from '../oauth/client-policy.service';
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
  page = PAGINATION.DEFAULT_PAGE,
  limit = PAGINATION.DEFAULT_LIMIT,
  after,
}: {
  search?: string;
  page?: number;
  limit?: number;
  after?: string;
}) => {
  const lim = Math.min(Math.max(limit, 1), PAGINATION.MAX_LIMIT);
  const pg = Math.max(page, PAGINATION.DEFAULT_PAGE);
  const match: Record<string, unknown> = { deletedAt: null };
  if (search) {
    match.$or = [
      { name: new RegExp(escapeRegex(search), 'i') },
      { email: new RegExp(escapeRegex(search), 'i') },
    ];
  }
  const cursor = after ? { ...match, _id: { $lt: new mongoose.Types.ObjectId(after) } } : match;
  const query = User.find(cursor).sort({ _id: -1 }).limit(lim + 1);
  if (!after) query.skip((pg - 1) * lim);

  const [rows, total] = await Promise.all([query, User.countDocuments(match)]);
  const hasMore = rows.length > lim;
  const pageRows = hasMore ? rows.slice(0, lim) : rows;
  const last = pageRows[pageRows.length - 1];
  return {
    items: pageRows.map(toAdminUser),
    total,
    page: pg,
    limit: lim,
    nextCursor: hasMore && last ? last._id.toString() : null,
  };
};

/** Full picture of one live user: profile, sessions, authorized apps, recent activity. */
export const getUser = async (id: string) => {
  const user = await UserStore.findLiveById(id);
  if (!user) throw ApiError.notFound('User not found');
  const [sessions, apps, activity] = await Promise.all([
    authService.listSessions(id),
    accountService.listApps(id),
    events.query({ actorUserId: id, limit: PAGINATION.DEFAULT_LIMIT }),
  ]);
  return { user: toAdminUser(user), sessions, apps, activity: activity.items };
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
  AdminGuards.assertNotSelf(ctx.actorUserId, id);
  const existing = await UserStore.findLiveById(id);
  if (!existing) throw ApiError.notFound('User not found');
  AdminGuards.assertNotPrivilegedTarget(existing);

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
  AdminGuards.assertNotSelf(ctx.actorUserId, id);
  const existing = await UserStore.findLiveById(id);
  if (!existing) throw ApiError.notFound('User not found');
  AdminGuards.assertNotPrivilegedTarget(existing);

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
 * request is being made on. Admin-protects-admin and last-admin are enforced before the
 * write so a race cannot drop the last operator.
 */
export const changeUserRole = async (id: string, role: UserRole, ctx: AdminActionCtx) => {
  AdminGuards.assertNotSelf(ctx.actorUserId, id);
  const existing = await UserStore.findLiveById(id);
  if (!existing) throw ApiError.notFound('User not found');
  await AdminGuards.assertCanChangeRole(ctx.actorRole, existing, role);

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
      User.countDocuments({ deletedAt: null }),
      User.countDocuments({ deletedAt: null, disabled: true }),
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
  after,
}: {
  type?: EventType | EventType[];
  clientId?: string;
  actorUserId?: string;
  limit?: number;
  after?: string;
}) =>
  events.query({
    type,
    clientId,
    actorUserId,
    limit: limit ?? PAGINATION.ACTIVITY_DEFAULT_LIMIT,
    after,
  });

// ── OAuth clients ──────────────────────────────────────────────────────────────
/**
 * Admin view of a client. The protocol metadata is projected through `ClientPolicy`
 * rather than read raw, so a client registered before M4 shows the policy actually in
 * force for it instead of a row of empty fields.
 */
const toAdminClient = (c: IOAuthClient) => {
  const policy = ClientPolicy.effective(c);
  return {
    clientId: c.clientId,
    clientName: c.clientName,
    redirectUris: c.redirectUris,
    description: c.description,
    logoUrl: c.logoUrl,
    suspended: c.suspended,
    suspendedReason: c.suspendedReason ?? '',
    createdAt: c.createdAt,
    scopes: policy.scopes,
    grantTypes: policy.grantTypes,
    responseTypes: policy.responseTypes,
    tokenEndpointAuthMethod: policy.tokenEndpointAuthMethod,
    postLogoutRedirectUris: policy.postLogoutRedirectUris,
    clientType: policy.clientType,
  };
};

export const listClients = async () => (await clientService.list()).map(toAdminClient);

/** Create a client and return its one-time secret + a ready-to-paste config-prompt. */
export const createClient = async (input: CreateClientInput, ctx: AdminActionCtx) => {
  const created = await clientService.create({
    clientName: input.clientName,
    redirectUris: input.redirectUris,
    description: input.description,
    logoUrl: input.logoUrl,
    scopes: input.scopes,
    grantTypes: input.grantTypes,
    responseTypes: input.responseTypes,
    tokenEndpointAuthMethod: input.tokenEndpointAuthMethod,
    postLogoutRedirectUris: input.postLogoutRedirectUris,
  });
  events.record('admin.client.created', { ...ctx, clientId: created.clientId, meta: { clientName: created.clientName } });
  const configPrompt = buildClientConfigPrompt(
    {
      clientId: created.clientId,
      clientName: created.clientName,
      redirectUris: created.redirectUris,
      tokenEndpointAuthMethod: created.tokenEndpointAuthMethod,
    },
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
  // Also null for a public client, which has no secret to rotate — minting one would
  // create a credential the token endpoint is obliged to reject.
  if (!result) throw ApiError.notFound('Client not found, or it is a public client');
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
    {
      clientId: client.clientId,
      clientName: client.clientName,
      redirectUris: client.redirectUris,
      tokenEndpointAuthMethod: client.tokenEndpointAuthMethod,
    },
    { stack: chosen },
  );
};
