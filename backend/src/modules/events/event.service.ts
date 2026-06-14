import type { Request } from 'express';
import mongoose from 'mongoose';
import AuthEvent from './event.model';
import type { EventContext, EventType } from './event.types';

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

/**
 * Record an activity event. Fire-and-forget by design: this MUST NEVER throw into
 * the request path — monitoring failures cannot be allowed to break auth. The write
 * is attempted, and any failure is logged and swallowed.
 *
 * Returns the underlying promise so tests can await persistence; callers in the
 * request path should NOT await it.
 */
export const record = (type: EventType, ctx: EventContext = {}): Promise<void> =>
  AuthEvent.create({
    type,
    actorUserId: ctx.actorUserId ?? undefined,
    actorRole: ctx.actorRole ?? undefined,
    clientId: ctx.clientId ?? undefined,
    targetUserId: ctx.targetUserId ?? undefined,
    ip: ctx.ip ?? undefined,
    ua: ctx.ua ?? undefined,
    meta: ctx.meta,
  })
    .then(() => undefined)
    .catch((err: unknown) => {
      console.warn(`[events] failed to record ${type}:`, (err as Error)?.message);
    });

/** Extract ip + user-agent from a request (Express `trust proxy` resolves X-Forwarded-For). */
export const reqContext = (req: Request): Pick<EventContext, 'ip' | 'ua'> => ({
  ip: req.ip,
  ua: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 400) : undefined,
});

export interface EventQuery {
  actorUserId?: string;
  targetUserId?: string;
  clientId?: string;
  type?: EventType | EventType[];
  from?: Date;
  to?: Date;
  limit?: number;
}

/** Read the activity log, newest-first. Capped at 200 rows per call. */
export const query = async (f: EventQuery = {}) => {
  const filter: Record<string, unknown> = {};
  if (f.actorUserId) filter.actorUserId = f.actorUserId;
  if (f.targetUserId) filter.targetUserId = f.targetUserId;
  if (f.clientId) filter.clientId = f.clientId;
  if (f.type) filter.type = Array.isArray(f.type) ? { $in: f.type } : f.type;
  if (f.from || f.to) {
    filter.createdAt = {
      ...(f.from ? { $gte: f.from } : {}),
      ...(f.to ? { $lte: f.to } : {}),
    };
  }
  return AuthEvent.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(f.limit ?? 50, 1), 200))
    .lean();
};

/** Most recent moment a user touched a given client (token issue or userinfo hit). */
export const lastUsedByClient = async (
  actorUserId: string,
): Promise<Record<string, Date>> => {
  const rows = await AuthEvent.aggregate<{ _id: string; last: Date }>([
    {
      $match: {
        actorUserId: toObjectId(actorUserId),
        type: { $in: ['token.issued', 'userinfo.access'] },
        clientId: { $ne: null },
      },
    },
    { $group: { _id: '$clientId', last: { $max: '$createdAt' } } },
  ]);
  const out: Record<string, Date> = {};
  for (const r of rows) out[r._id] = r.last;
  return out;
};
