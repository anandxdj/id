import { apiClient } from '@/lib/api-client';
import type {
  ApiEnvelope,
  AdminUser,
  AdminUserDetail,
  AdminClient,
  AdminMetrics,
  ActivityEvent,
  CreatedClient,
} from '@/types';

// ── Users ───────────────────────────────────────────────────────────────────
export async function listUsers(params: { search?: string; page?: number; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return (await apiClient.get<ApiEnvelope<{ items: AdminUser[]; total: number; page: number; limit: number }>>(
    `/api/admin/users${qs ? `?${qs}` : ''}`,
  )).data;
}

export async function getUser(id: string) {
  return (await apiClient.get<ApiEnvelope<AdminUserDetail>>(`/api/admin/users/${id}`)).data;
}

export async function suspendUser(id: string, reason?: string) {
  return (await apiClient.post<ApiEnvelope<AdminUser>>(`/api/admin/users/${id}/suspend`, { reason })).data;
}

export async function unsuspendUser(id: string) {
  return (await apiClient.post<ApiEnvelope<AdminUser>>(`/api/admin/users/${id}/unsuspend`)).data;
}

// ── Monitoring ──────────────────────────────────────────────────────────────
export async function getMetrics() {
  return (await apiClient.get<ApiEnvelope<AdminMetrics>>('/api/admin/metrics')).data;
}

export async function getActivity(params: { type?: string; clientId?: string; userId?: string; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (params.type) q.set('type', params.type);
  if (params.clientId) q.set('clientId', params.clientId);
  if (params.userId) q.set('userId', params.userId);
  if (params.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return (await apiClient.get<ApiEnvelope<ActivityEvent[]>>(`/api/admin/activity${qs ? `?${qs}` : ''}`)).data;
}

// ── Clients ─────────────────────────────────────────────────────────────────
export async function listClients() {
  return (await apiClient.get<ApiEnvelope<AdminClient[]>>('/api/admin/clients')).data;
}

export async function createClient(input: {
  clientName: string;
  redirectUris: string[];
  description?: string;
  logoUrl?: string;
  stack?: string;
}) {
  return (await apiClient.post<ApiEnvelope<CreatedClient>>('/api/admin/clients', input)).data;
}

export async function rotateSecret(clientId: string) {
  return (await apiClient.post<ApiEnvelope<{ clientId: string; clientSecret: string }>>(
    `/api/admin/clients/${clientId}/rotate-secret`,
  )).data;
}

export async function setClientSuspended(clientId: string, suspended: boolean, reason?: string) {
  const path = `/api/admin/clients/${clientId}/${suspended ? 'suspend' : 'unsuspend'}`;
  return (await apiClient.post<ApiEnvelope<AdminClient>>(path, suspended ? { reason } : undefined)).data;
}

export async function getConfigPrompt(clientId: string, stack: string) {
  return (await apiClient.get<ApiEnvelope<{ prompt: string }>>(
    `/api/admin/clients/${clientId}/config-prompt?stack=${encodeURIComponent(stack)}`,
  )).data.prompt;
}
