import type { Request } from 'express';
import mongoose from 'mongoose';
import AuthEvent from './event.model';
import type { EventContext, EventType } from './event.types';
import { Logger } from '../../common/logger/index.logger';
import { OBJECT_ID, PAGINATION } from '../../common/constants/index.constants';

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
      Logger.warn('Failed to record activity event', {
        type,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    });

/** Extract ip + user-agent from a request (Express `trust proxy` resolves X-Forwarded-For). */
export const reqContext = (req: Request): { ip?: string; ua?: string } => ({
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
  /** Keyset cursor: the `_id` of the last row from the previous page. */
  after?: string;
  /** Reverse keyset cursor: the `_id` of the first row on the following page. */
  before?: string;
}

export interface EventPage {
  items: Array<{
    _id: mongoose.Types.ObjectId;
    type: EventType;
    createdAt: Date;
    actorUserId?: mongoose.Types.ObjectId;
    actorRole?: string;
    clientId?: string;
    targetUserId?: mongoose.Types.ObjectId;
    ip?: string;
    ua?: string;
    meta?: Record<string, unknown>;
  }>;
  nextCursor: string | null;
  previousCursor: string | null;
}

/** Read the activity log, newest-first. Capped; keyset via `after`, never OFFSET. */
export const query = async (f: EventQuery = {}): Promise<EventPage> => {
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
  if (f.after && OBJECT_ID.PATTERN.test(f.after)) {
    filter._id = { $lt: toObjectId(f.after) };
  } else if (f.before && OBJECT_ID.PATTERN.test(f.before)) {
    filter._id = { $gt: toObjectId(f.before) };
  }
  const lim = Math.min(Math.max(f.limit ?? PAGINATION.DEFAULT_LIMIT, 1), PAGINATION.ACTIVITY_MAX_LIMIT);
  const movingNewer = Boolean(f.before);
  const rows = await AuthEvent.find(filter)
    .sort({ _id: movingNewer ? 1 : -1 })
    .limit(lim + 1)
    .lean();
  const hasMore = rows.length > lim;
  const pageRows = hasMore ? rows.slice(0, lim) : rows;
  const items = movingNewer ? pageRows.reverse() : pageRows;
  const first = items[0];
  const last = items[items.length - 1];
  const hasNewer = movingNewer ? hasMore : Boolean(f.after && items.length);
  const hasOlder = movingNewer ? Boolean(items.length) : hasMore;
  return {
    items: items as EventPage['items'],
    nextCursor: hasOlder && last ? String(last._id) : null,
    previousCursor: hasNewer && first ? String(first._id) : null,
  };
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
