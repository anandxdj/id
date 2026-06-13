import { z } from 'zod';

export const consentDecisionSchema = z.object({
  transaction_id: z.string().min(1),
  decision: z.enum(['allow', 'deny']),
});

export type ConsentDecisionInput = z.infer<typeof consentDecisionSchema>;
