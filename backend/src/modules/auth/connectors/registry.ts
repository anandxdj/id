import type { OAuthConnector } from './types';
import { Config } from '../../../common/config/config';
import { googleConnector } from './google.connector';
import { githubConnector } from './github.connector';

const ALL: OAuthConnector[] = [googleConnector, githubConnector];

/**
 * Optional allowlist toggle. AUTH_CONNECTORS="google,github" restricts to those even if
 * others are configured. Unset → every connector whose credentials are present is enabled.
 */
const allowlist = (): Set<string> | null => {
  const configured = Config.connectors.enabled;
  if (configured.length === 0) return null;
  return new Set(configured.map((provider) => provider.toLowerCase()));
};

/** Connectors that are both configured (creds present) and permitted by the allowlist. */
export const listEnabled = (): OAuthConnector[] => {
  const allowed = allowlist();
  return ALL.filter((c) => c.isConfigured() && (!allowed || allowed.has(c.provider)));
};

export const getEnabledConnector = (provider: string): OAuthConnector | undefined =>
  listEnabled().find((c) => c.provider === provider.toLowerCase());
