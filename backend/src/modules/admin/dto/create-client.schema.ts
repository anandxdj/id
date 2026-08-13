import { z } from 'zod';
import {
  SUPPORTED_GRANT_TYPES,
  SUPPORTED_RESPONSE_TYPES,
  SUPPORTED_SCOPES,
  SUPPORTED_TOKEN_ENDPOINT_AUTH_METHODS,
} from '../../../common/constants/index.constants';
import { PROMPT_STACKS } from '../client-prompt.util';

/**
 * M4 protocol metadata is validated against the same constants the enforcement paths
 * read, so a client cannot be registered for a capability this server does not
 * implement. Every field is optional — omitting them takes the model defaults, which is
 * what keeps the existing admin UI working untouched.
 */
export const clientProtocolMetadataSchema = {
  scopes: z.array(z.enum(SUPPORTED_SCOPES as [string, ...string[]])).min(1).optional(),
  grantTypes: z.array(z.enum(SUPPORTED_GRANT_TYPES as [string, ...string[]])).min(1).optional(),
  responseTypes: z
    .array(z.enum(SUPPORTED_RESPONSE_TYPES as [string, ...string[]]))
    .min(1)
    .optional(),
  tokenEndpointAuthMethod: z
    .enum(SUPPORTED_TOKEN_ENDPOINT_AUTH_METHODS as [string, ...string[]])
    .optional(),
  postLogoutRedirectUris: z.array(z.string().trim().url()).optional(),
};

export const createClientSchema = z.object({
  clientName: z.string().trim().min(2).max(120),
  redirectUris: z.array(z.string().trim().url()).min(1, 'At least one redirect URI'),
  description: z.string().trim().max(2000).optional(),
  logoUrl: z.string().trim().max(2048).optional(),
  // Tailors the initial config-prompt; the wizard can re-fetch for another stack.
  stack: z.enum(PROMPT_STACKS).optional(),
  ...clientProtocolMetadataSchema,
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
