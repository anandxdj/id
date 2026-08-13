import mongoose from 'mongoose';
import { DELETED_ACCOUNT, REVOKE_REASONS } from '../../common/constants/index.constants';
import User from './auth.model';
import type { IUser } from './auth.model';

/**
 * Every query that backs a *credential* flow — registration, login, verification, reset,
 * closure — goes through here.
 *
 * The reason is the same one that put every `expiresAt` predicate behind a single store
 * module in M1: there is an invariant that has to hold on every single one of these reads,
 * and the only way to keep it honest is to make it impossible to write one of these
 * queries somewhere else. The invariant is **`deletedAt: null`**. Miss it once and a
 * closed account can log in, or reset its password, or block re-registration of an address
 * it no longer owns.
 *
 * This deliberately does *not* claim every `User` query in the codebase: profile reads and
 * the admin surface still query the model directly, and converting them is M5's business.
 * The credential paths are the ones where missing the predicate is a security bug rather
 * than a cosmetic one.
 */

/** Internal: the predicate that defines "this account may present credentials". */
const _liveFilter = (extra: Record<string, unknown>) => ({ deletedAt: null, ...extra });

/** Internal: normalise an address the same way the schema's `lowercase` would. */
const _normalizeEmail = (email: string): string => email.toLowerCase().trim();

export const UserStore = {
  /** The one place email normalisation happens for a lookup. */
  normalizeEmail: _normalizeEmail,

  /**
   * A tombstone address, replacing the real one on closure so the live unique index stops
   * reserving it. RFC 2606 reserves `.invalid`, so this can never collide with a real
   * mailbox, and the ObjectId makes it unique without a lookup.
   */
  tombstoneEmailFor(userId: string): string {
    return `${DELETED_ACCOUNT.EMAIL_PREFIX}${userId}@${DELETED_ACCOUNT.EMAIL_DOMAIN}`;
  },

  /**
   * Find a live account by address, with the password digest attached.
   *
   * `select('+password')` because the schema hides it, and the caller is about to verify
   * against it. Returns a document (not `lean`) so the caller can pass it to the session
   * builder, which wants `IUser`.
   */
  async findLiveByEmailWithPassword(email: string): Promise<IUser | null> {
    return User.findOne(_liveFilter({ email: _normalizeEmail(email) })).select('+password');
  },

  /** Find a live account by address, without the digest. */
  async findLiveByEmail(email: string): Promise<IUser | null> {
    return User.findOne(_liveFilter({ email: _normalizeEmail(email) }));
  },

  /** Find a live account by id. Used on every action-token redemption path. */
  async findLiveById(userId: string): Promise<IUser | null> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return null;
    return User.findOne(_liveFilter({ _id: new mongoose.Types.ObjectId(userId) }));
  },

  /** Create a credentials account. `passwordHash` is already hashed — see `auth.model.ts`. */
  async createWithPassword(input: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<IUser> {
    return User.create({
      name: input.name.trim(),
      email: _normalizeEmail(input.email),
      password: input.passwordHash,
    });
  },

  /**
   * Replace the stored digest. A targeted `updateOne` rather than `save()`, so a rehash
   * cannot accidentally persist any other in-memory field the caller happened to touch.
   */
  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await User.updateOne({ _id: userId }, { $set: { password: passwordHash } });
  },

  /** Mark the address confirmed. Idempotent — re-verifying is a no-op, not an error. */
  async markEmailVerified(userId: string): Promise<void> {
    await User.updateOne({ _id: userId, isVerified: false }, { $set: { isVerified: true } });
  },

  /**
   * Close an account: stamp `deletedAt`, disable it, drop the password digest, and move the
   * address aside so it can be registered again.
   *
   * Scoped to `deletedAt: null` so a double-submit cannot overwrite `deletedEmail` with an
   * already-written tombstone — which would destroy the only record of the real address.
   * Returns false when the account was already closed.
   */
  async softDelete(userId: string): Promise<boolean> {
    const user = await User.findOne(_liveFilter({ _id: userId })).select('+password');
    if (!user) return false;

    const result = await User.updateOne(_liveFilter({ _id: userId }), {
      $set: {
        deletedAt: new Date(),
        deletedEmail: user.email,
        email: this.tombstoneEmailFor(userId),
        disabled: true,
        disabledReason: REVOKE_REASONS.USER_DELETED,
        disabledAt: new Date(),
      },
      // The digest is not evidence of anything, and keeping it past closure is a liability
      // with no purpose — nothing will ever verify against it again.
      $unset: { password: '' },
    });
    return result.modifiedCount > 0;
  },
};
