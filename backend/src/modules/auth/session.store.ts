import mongoose from 'mongoose';
import { hashToken } from '../../common/utils/crypto.utils';
import {
  LAST_SEEN_THROTTLE_MS,
  MILLISECONDS,
  TTL_SECONDS,
} from '../../common/constants/index.constants';
import type { RevokeReason } from '../../common/constants/index.constants';
import { Session } from './session.model';
import type { ISession } from './session.model';

/**
 * The only module that queries the `sessions` collection.
 *
 * Two vocabulary rules, because conflating them would be a security bug:
 *
 *  - **sid** — the secret session id minted at sign-in and carried inside the
 *    access/refresh JWT. Never persisted.
 *  - **handle** — `sha256(sid)`, the document `_id`. This is what the sessions API
 *    exposes and accepts, so a value arriving from an HTTP path parameter is always a
 *    handle, and a value read out of a verified JWT is always a sid.
 *
 * Every read carries an explicit `expiresAt: { $gt: now }`: the TTL index is storage
 * reclamation on a ~60 s cycle, so an expired session remains readable without it.
 */

interface CreateSessionInput {
  sid: string;
  userId: string;
  role: string;
  disabled: boolean;
  userAgent?: string;
  ipAddress?: string;
}

/** Internal: the predicate that defines "this session may authenticate a request". */
const _activeFilter = (extra: Record<string, unknown> = {}) => ({
  revokedAt: null,
  expiresAt: { $gt: new Date() },
  ...extra,
});

export const SessionStore = {
  /** Derive the addressable handle for a sid. The one place this hash is computed. */
  handleOf(sid: string): string {
    return hashToken(sid);
  },

  async create(input: CreateSessionInput): Promise<ISession> {
    const now = new Date();
    const created = await Session.create({
      _id: this.handleOf(input.sid),
      userId: new mongoose.Types.ObjectId(input.userId),
      role: input.role,
      disabled: input.disabled,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      createdAt: now,
      lastSeenAt: now,
      revokedAt: null,
      expiresAt: new Date(now.getTime() + TTL_SECONDS.SESSION * MILLISECONDS.SECOND),
    });
    return created.toObject();
  },

  /** Resolve a live session. Scoped by user so a handle alone is never sufficient. */
  async findActive(userId: string, handle: string): Promise<ISession | null> {
    return Session.findOne(_activeFilter({ _id: handle, userId })).lean<ISession>();
  },

  /** Every live session for a user, most recently active first. One indexed read. */
  async listActive(userId: string): Promise<ISession[]> {
    return Session.find(_activeFilter({ userId })).sort({ lastSeenAt: -1 }).lean<ISession[]>();
  },

  /**
   * Advance `lastSeenAt` at most once per throttle window.
   *
   * A single conditional write, not read-compare-write: there is no race to lose, and
   * a filter that does not match produces no oplog entry at all — which matters
   * because this fires on every authenticated request.
   */
  async touch(userId: string, handle: string): Promise<void> {
    const now = new Date();
    await Session.updateOne(
      _activeFilter({
        _id: handle,
        userId,
        lastSeenAt: { $lt: new Date(now.getTime() - LAST_SEEN_THROTTLE_MS) },
      }),
      { $set: { lastSeenAt: now } },
    );
  },

  /** Revoke one session. False when it was already revoked, expired, or never existed. */
  async revoke(userId: string, handle: string, reason: RevokeReason): Promise<boolean> {
    const result = await Session.updateOne(_activeFilter({ _id: handle, userId }), {
      $set: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.modifiedCount > 0;
  },

  /**
   * Revoke every live session for one user, optionally sparing the caller's own.
   * Scoped by `userId`, so another user's sessions can never be caught in the blast.
   */
  async revokeAll(
    userId: string,
    options: { exceptHandle?: string | null; reason: RevokeReason },
  ): Promise<number> {
    const filter = _activeFilter({
      userId,
      ...(options.exceptHandle ? { _id: { $ne: options.exceptHandle } } : {}),
    });
    const result = await Session.updateMany(filter, {
      $set: { revokedAt: new Date(), revokedReason: options.reason },
    });
    return result.modifiedCount;
  },
};
