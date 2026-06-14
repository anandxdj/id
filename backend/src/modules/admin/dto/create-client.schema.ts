import { z } from 'zod';
import { PROMPT_STACKS } from '../client-prompt.util';

export const createClientSchema = z.object({
  clientName: z.string().trim().min(2).max(120),
  redirectUris: z.array(z.string().trim().url()).min(1, 'At least one redirect URI'),
  description: z.string().trim().max(2000).optional(),
  logoUrl: z.string().trim().max(2048).optional(),
  // Tailors the initial config-prompt; the wizard can re-fetch for another stack.
  stack: z.enum(PROMPT_STACKS).optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
