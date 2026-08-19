import { z } from 'zod';
import { FIELD_LIMITS, OBJECT_ID, PAGINATION } from '../../common/constants/index.constants';
import { ADMIN_ACCESS_REQUEST_STATUS } from './admin-access-request.model';

export const createAdminAccessRequestSchema = z.object({
  justification: z.string().trim().max(FIELD_LIMITS.ADMIN_ACCESS_JUSTIFICATION).optional().default(''),
});

export const decideAdminAccessRequestSchema = z.object({
  decision: z.enum([ADMIN_ACCESS_REQUEST_STATUS.APPROVED, ADMIN_ACCESS_REQUEST_STATUS.REJECTED]),
  note: z.string().trim().max(FIELD_LIMITS.ADMIN_ACCESS_DECISION_NOTE).optional().default(''),
});

export const adminAccessRequestIdSchema = z.object({
  id: z.string().regex(OBJECT_ID.PATTERN, 'Invalid request id'),
});

export const listAdminAccessRequestsSchema = z.object({
  status: z
    .enum([
      ADMIN_ACCESS_REQUEST_STATUS.PENDING,
      ADMIN_ACCESS_REQUEST_STATUS.APPROVED,
      ADMIN_ACCESS_REQUEST_STATUS.REJECTED,
    ])
    .optional()
    .default(ADMIN_ACCESS_REQUEST_STATUS.PENDING),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).optional(),
});

export type AdminAccessDecisionInput = z.infer<typeof decideAdminAccessRequestSchema>;
