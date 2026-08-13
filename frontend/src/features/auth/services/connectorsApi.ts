import { apiClient } from '@/lib/api-client';
import { AppConfig } from '@/lib/config';
import { API_PATHS } from '@/lib/constants';
import type { ApiEnvelope } from '@/types';

export interface Connector {
  provider: string;
  displayName: string;
}

export async function getConnectors(): Promise<Connector[]> {
  const res = await apiClient.get<ApiEnvelope<Connector[]>>(API_PATHS.CONNECTORS);
  return res.data;
}

/** Top-level URL that kicks off a social login (must be a full-page navigation). */
export function connectorStartUrl(provider: string, returnTo?: string | null): string {
  const url = new URL(`${AppConfig.apiBase}${API_PATHS.oauthStart(provider)}`);
  if (returnTo) url.searchParams.set('return_to', returnTo);
  return url.toString();
}
