import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope } from '@/types';

export interface Connector {
  provider: string;
  displayName: string;
}

export async function getConnectors(): Promise<Connector[]> {
  const res = await apiClient.get<ApiEnvelope<Connector[]>>('/api/auth/connectors');
  return res.data;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Top-level URL that kicks off a social login (must be a full-page navigation). */
export function connectorStartUrl(provider: string, returnTo?: string | null): string {
  const url = new URL(`${API_BASE}/api/auth/oauth/${provider}`);
  if (returnTo) url.searchParams.set('return_to', returnTo);
  return url.toString();
}
