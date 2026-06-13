import type { OAuthConnector } from './types';
import { googleConnector } from './google.connector';
import { githubConnector } from './github.connector';

const ALL: OAuthConnector[] = [googleConnector, githubConnector];

/**
 * Optional allowlist toggle. AUTH_CONNECTORS="google,github" restricts to those even if
 * others are configured. Unset → every connector whose credentials are present is enabled.
 */
const allowlist = (): Set<string> | null => {
  const raw = process.env.AUTH_CONNECTORS;
  if (!raw) return null;
  return new Set(raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
};

/** Connectors that are both configured (creds present) and permitted by the allowlist. */
export const listEnabled = (): OAuthConnector[] => {
  const allowed = allowlist();
  return ALL.filter((c) => c.isConfigured() && (!allowed || allowed.has(c.provider)));
};

export const getEnabledConnector = (provider: string): OAuthConnector | undefined =>
  listEnabled().find((c) => c.provider === provider.toLowerCase());
