import { z } from 'zod';
import { USER_ROLES } from '../../../common/constants/index.constants';

/**
 * Role assignment. The enum is derived from the constant rather than restated, so adding
 * a role cannot leave the validator silently rejecting it.
 */
export const changeRoleSchema = z.object({
  role: z.enum([USER_ROLES.USER, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]),
});

export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
