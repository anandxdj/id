import { z } from 'zod';
import { OBJECT_ID, PAGINATION } from '../../../common/constants/index.constants';

export const listUsersQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).optional(),
  /** Keyset cursor: the `_id` of the last row from the previous page. Prefers over `page`. */
  after: z.string().regex(OBJECT_ID.PATTERN).optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const listClientsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).optional(),
});

export const activityQuerySchema = z
  .object({
    type: z.string().trim().max(200).optional(),
    clientId: z.string().trim().max(80).optional(),
    userId: z.string().regex(OBJECT_ID.PATTERN).optional(),
    limit: z.coerce.number().int().min(1).max(PAGINATION.ACTIVITY_MAX_LIMIT).optional(),
    after: z.string().regex(OBJECT_ID.PATTERN).optional(),
    before: z.string().regex(OBJECT_ID.PATTERN).optional(),
  })
  .refine((query) => !(query.after && query.before), {
    message: 'Use either after or before, not both',
    path: ['before'],
  });

export type ActivityQuery = z.infer<typeof activityQuerySchema>;
