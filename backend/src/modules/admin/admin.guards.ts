import { ApiError } from '../../common/utils/ApiError';
import {
  ADMIN_ROLES,
  ERROR_CODES,
  HTTP_STATUS,
  USER_ROLES,
} from '../../common/constants/index.constants';
import type { UserRole } from '../../common/constants/index.constants';
import { UserStore } from '../auth/user.store';
import type { IUser } from '../auth/auth.model';

/**
 * Admin mutation gates. Three rules, always in this order:
 *
 *  1. **Self-protection.** An admin cannot suspend, unsuspend, or re-role themselves.
 *     Doing so would revoke the session the request is running on, or lock the last
 *     operator out of the console.
 *  2. **Admin-protects-admin.** A peer `admin` cannot touch another privileged account.
 *     Suspend and unsuspend of a privileged target are refused outright — demote first.
 *     Role changes of an `admin` are superadmin-only. Superadmins cannot be targeted
 *     for role changes by anyone who is not themselves a superadmin, and nobody can
 *     mint a superadmin without already being one.
 *  3. **Last-admin.** Demoting or closing the last live privileged account is refused.
 *     A disabled admin still counts: they can be reinstated, which is the recovery path.
 */
export const AdminGuards = {
  isPrivileged(role: string | undefined): boolean {
    return role !== undefined && (ADMIN_ROLES as readonly string[]).includes(role);
  },

  assertNotSelf(actorUserId: string | null | undefined, targetId: string): void {
    if (actorUserId && actorUserId === targetId) {
      throw ApiError.fromCode(HTTP_STATUS.FORBIDDEN, ERROR_CODES.CANNOT_TARGET_SELF);
    }
  },

  /**
   * Suspend / unsuspend: privileged targets are off-limits. Demote them to `user` first.
   * Superadmin is not a loophole here — an operator who wants to lock an admin out
   * still goes through a role change, which is the audited, last-admin-checked path.
   */
  assertNotPrivilegedTarget(target: Pick<IUser, 'role'>): void {
    if (this.isPrivileged(target.role)) {
      throw ApiError.fromCode(HTTP_STATUS.FORBIDDEN, ERROR_CODES.CANNOT_TARGET_ADMIN);
    }
  },

  /**
   * Role assignment. Caller has already asserted not-self. Returns after throwing, or
   * after confirming the last-admin invariant still holds post-change.
   */
  async assertCanChangeRole(
    actorRole: string | null | undefined,
    target: Pick<IUser, '_id' | 'role'>,
    nextRole: UserRole,
  ): Promise<void> {
    const actorIsSuper = actorRole === USER_ROLES.SUPERADMIN;
    const targetIsSuper = target.role === USER_ROLES.SUPERADMIN;

    if (targetIsSuper && !actorIsSuper) {
      throw ApiError.fromCode(HTTP_STATUS.FORBIDDEN, ERROR_CODES.CANNOT_TARGET_ADMIN);
    }
    if (this.isPrivileged(target.role) && !actorIsSuper) {
      throw ApiError.fromCode(HTTP_STATUS.FORBIDDEN, ERROR_CODES.CANNOT_TARGET_ADMIN);
    }
    if (nextRole === USER_ROLES.SUPERADMIN && !actorIsSuper) {
      throw ApiError.fromCode(HTTP_STATUS.FORBIDDEN, ERROR_CODES.CANNOT_TARGET_ADMIN);
    }

    const losingPrivilege = this.isPrivileged(target.role) && !this.isPrivileged(nextRole);
    if (!losingPrivilege) return;

    const remaining = await UserStore.countLiveByRoles(ADMIN_ROLES, target._id.toString());
    if (remaining === 0) {
      throw ApiError.fromCode(HTTP_STATUS.FORBIDDEN, ERROR_CODES.LAST_ADMIN_PROTECTED);
    }
  },

  /** Account self-delete: the last live admin cannot close the console behind them. */
  async assertNotLastAdmin(user: Pick<IUser, '_id' | 'role'>): Promise<void> {
    if (!this.isPrivileged(user.role)) return;
    const remaining = await UserStore.countLiveByRoles(ADMIN_ROLES, user._id.toString());
    if (remaining === 0) {
      throw ApiError.fromCode(HTTP_STATUS.FORBIDDEN, ERROR_CODES.LAST_ADMIN_PROTECTED);
    }
  },
};
