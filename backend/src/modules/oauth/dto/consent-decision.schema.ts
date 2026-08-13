import { z } from 'zod';

export const consentDecisionSchema = z.object({
  transaction_id: z.string().min(1),
  decision: z.enum(['allow', 'deny']),
  /**
   * The subset of the requested scope the user actually approved.
   *
   * Optional, and omitting it means "everything that was requested" — which keeps the
   * existing all-or-nothing consent screen working unchanged. Supplying it is what lets
   * a screen offer per-scope checkboxes, and the service rejects anything that is not a
   * subset of the parked request, so a tampered form cannot grant more than was shown.
   */
  scope: z.union([z.string(), z.array(z.string())]).optional(),
});

export type ConsentDecisionInput = z.infer<typeof consentDecisionSchema>;
