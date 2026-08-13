import { z } from 'zod';
import { CLIENT_ID, OBJECT_ID } from '../../../common/constants/index.constants';

export const userIdParamSchema = z.object({
  id: z.string().regex(OBJECT_ID.PATTERN, 'must be a 24-character hex ObjectId'),
});

export const clientIdParamSchema = z.object({
  clientId: z
    .string()
    .min(CLIENT_ID.PREFIX.length + 1)
    .max(CLIENT_ID.MAX_LENGTH)
    .startsWith(CLIENT_ID.PREFIX),
});

export type UserIdParam = z.infer<typeof userIdParamSchema>;
export type ClientIdParam = z.infer<typeof clientIdParamSchema>;
