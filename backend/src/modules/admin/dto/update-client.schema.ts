import { z } from 'zod';

export const updateClientSchema = z.object({
  clientName: z.string().trim().min(2).max(120).optional(),
  redirectUris: z.array(z.string().trim().url()).min(1, 'At least one redirect URI').optional(),
  description: z.string().trim().max(2000).optional(),
  logoUrl: z.string().trim().max(2048).optional(),
});

export type UpdateClientInput = z.infer<typeof updateClientSchema>;
