import { z } from 'zod';

/**
 * Self-service profile edit. Only these fields are editable — role, email, and
 * isVerified are intentionally absent, and unknown keys are stripped by Zod, so a
 * user can never escalate their own role or flip verification through this route.
 */
export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(50),
    profilePictureUrl: z.string().trim().max(2048),
    bio: z.string().trim().max(500),
    jobTitle: z.string().trim().max(100),
    company: z.string().trim().max(100),
    country: z.string().trim().max(2),
  })
  .partial();

export type ProfileInput = z.infer<typeof profileSchema>;
