import { z } from 'zod';

export const suspendUserSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type SuspendUserInput = z.infer<typeof suspendUserSchema>;
