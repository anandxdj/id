/**
 * Admin mutation gates. Pure assertions — no datastore. Last-admin counting is
 * covered by the admin integration suite, where a live user row exists to count.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ApiError } from '../../common/utils/ApiError';
import { ERROR_CODES, USER_ROLES } from '../../common/constants/index.constants';
import { AdminGuards } from './admin.guards';
import { UserStore } from '../auth/user.store';
import type { IUser } from '../auth/auth.model';

const asUser = (role: string, id = new mongoose.Types.ObjectId().toString()) =>
  ({ _id: new mongoose.Types.ObjectId(id), role }) as Pick<IUser, '_id' | 'role'>;

test('self-target is refused for any mutation', () => {
  const id = new mongoose.Types.ObjectId().toString();
  assert.throws(
    () => AdminGuards.assertNotSelf(id, id),
    (err: unknown) => err instanceof ApiError && err.code === ERROR_CODES.CANNOT_TARGET_SELF,
  );
  assert.doesNotThrow(() => AdminGuards.assertNotSelf(id, new mongoose.Types.ObjectId().toString()));
});

test('suspend/unsuspend refuse a privileged target — demote first', () => {
  assert.throws(
    () => AdminGuards.assertNotPrivilegedTarget(asUser(USER_ROLES.ADMIN) as IUser),
    (err: unknown) => err instanceof ApiError && err.code === ERROR_CODES.CANNOT_TARGET_ADMIN,
  );
  assert.throws(
    () => AdminGuards.assertNotPrivilegedTarget(asUser(USER_ROLES.SUPERADMIN) as IUser),
    (err: unknown) => err instanceof ApiError && err.code === ERROR_CODES.CANNOT_TARGET_ADMIN,
  );
  assert.doesNotThrow(() => AdminGuards.assertNotPrivilegedTarget(asUser(USER_ROLES.USER) as IUser));
});

test('an admin cannot re-role another admin; a superadmin can re-role an admin to user only after last-admin check', async () => {
  const admin = asUser(USER_ROLES.ADMIN);
  await assert.rejects(
    () => AdminGuards.assertCanChangeRole(USER_ROLES.ADMIN, admin, USER_ROLES.USER),
    (err: unknown) => err instanceof ApiError && err.code === ERROR_CODES.CANNOT_TARGET_ADMIN,
  );
  await assert.rejects(
    () => AdminGuards.assertCanChangeRole(USER_ROLES.ADMIN, asUser(USER_ROLES.USER), USER_ROLES.SUPERADMIN),
    (err: unknown) => err instanceof ApiError && err.code === ERROR_CODES.CANNOT_TARGET_ADMIN,
  );
  await assert.doesNotReject(() =>
    AdminGuards.assertCanChangeRole(USER_ROLES.ADMIN, asUser(USER_ROLES.USER), USER_ROLES.USER),
  );
});

test('last remaining privileged account cannot be demoted or closed', async () => {
  const orig = UserStore.countLiveByRoles;
  UserStore.countLiveByRoles = async () => 0;
  try {
    await assert.rejects(
      () => AdminGuards.assertNotLastAdmin(asUser(USER_ROLES.SUPERADMIN)),
      (err: unknown) => err instanceof ApiError && err.code === ERROR_CODES.LAST_ADMIN_PROTECTED,
    );
    await assert.rejects(
      () => AdminGuards.assertCanChangeRole(USER_ROLES.SUPERADMIN, asUser(USER_ROLES.ADMIN), USER_ROLES.USER),
      (err: unknown) => err instanceof ApiError && err.code === ERROR_CODES.LAST_ADMIN_PROTECTED,
    );
    await assert.doesNotReject(() => AdminGuards.assertNotLastAdmin(asUser(USER_ROLES.USER)));
  } finally {
    UserStore.countLiveByRoles = orig;
  }
});
