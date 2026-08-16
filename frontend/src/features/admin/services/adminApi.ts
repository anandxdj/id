import { apiClient } from '@/lib/api-client';
import { API_PATHS } from '@/lib/constants';
import type {
  ApiEnvelope,
  AdminUser,
  AdminUserDetail,
  AdminClient,
  AdminMetrics,
  ActivityEvent,
  CreatedClient,
  AdminClientDetail,
} from '@/types';

export const AdminApi = {
  async listUsers(params: { search?: string; page?: number; limit?: number; after?: string } = {}) {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.after) q.set('after', params.after);
    const qs = q.toString();
    return (
      await apiClient.get<
        ApiEnvelope<{ items: AdminUser[]; total: number; page: number; limit: number; nextCursor: string | null }>
      >(`${API_PATHS.ADMIN_USERS}${qs ? `?${qs}` : ''}`)
    ).data;
  },

  async getUser(id: string) {
    return (await apiClient.get<ApiEnvelope<AdminUserDetail>>(API_PATHS.adminUser(id))).data;
  },

  async suspendUser(id: string, reason?: string) {
    return (await apiClient.post<ApiEnvelope<AdminUser>>(`${API_PATHS.adminUser(id)}/suspend`, { reason })).data;
  },

  async unsuspendUser(id: string) {
    return (await apiClient.post<ApiEnvelope<AdminUser>>(`${API_PATHS.adminUser(id)}/unsuspend`)).data;
  },

  async changeUserRole(id: string, role: 'user' | 'admin' | 'superadmin') {
    return (await apiClient.patch<ApiEnvelope<AdminUser>>(`${API_PATHS.adminUser(id)}/role`, { role })).data;
  },

  async getMetrics() {
    return (await apiClient.get<ApiEnvelope<AdminMetrics>>(API_PATHS.ADMIN_METRICS)).data;
  },

  async getActivity(params: { type?: string; clientId?: string; userId?: string; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (params.type) q.set('type', params.type);
    if (params.clientId) q.set('clientId', params.clientId);
    if (params.userId) q.set('userId', params.userId);
    if (params.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return (
      await apiClient.get<ApiEnvelope<ActivityEvent[]>>(`${API_PATHS.ADMIN_ACTIVITY}${qs ? `?${qs}` : ''}`)
    ).data;
  },

  async listClients() {
    return (await apiClient.get<ApiEnvelope<AdminClient[]>>(API_PATHS.ADMIN_CLIENTS)).data;
  },

  async getClient(clientId: string) {
    return (await apiClient.get<ApiEnvelope<AdminClientDetail>>(API_PATHS.adminClient(clientId))).data;
  },

  async updateClient(clientId: string, input: Partial<AdminClient>) {
    return (await apiClient.patch<ApiEnvelope<AdminClient>>(API_PATHS.adminClient(clientId), input)).data;
  },

  async createClient(input: {
    clientName: string;
    redirectUris: string[];
    description?: string;
    logoUrl?: string;
    stack?: string;
    scopes?: string[];
    grantTypes?: string[];
    responseTypes?: string[];
    tokenEndpointAuthMethod?: 'client_secret_basic' | 'client_secret_post' | 'none';
    postLogoutRedirectUris?: string[];
  }) {
    return (await apiClient.post<ApiEnvelope<CreatedClient>>(API_PATHS.ADMIN_CLIENTS, input)).data;
  },

  async rotateSecret(clientId: string) {
    return (
      await apiClient.post<ApiEnvelope<{ clientId: string; clientSecret: string }>>(
        `${API_PATHS.adminClient(clientId)}/rotate-secret`,
      )
    ).data;
  },

  async setClientSuspended(clientId: string, suspended: boolean, reason?: string) {
    const path = `${API_PATHS.adminClient(clientId)}/${suspended ? 'suspend' : 'unsuspend'}`;
    return (await apiClient.post<ApiEnvelope<AdminClient>>(path, suspended ? { reason } : undefined)).data;
  },

  async deleteClient(clientId: string) {
    return (
      await apiClient.del<ApiEnvelope<{ clientId: string; clientName: string }>>(
        API_PATHS.adminClient(clientId),
      )
    ).data;
  },

  async getConfigPrompt(clientId: string, stack: string) {
    return (
      await apiClient.get<ApiEnvelope<{ prompt: string }>>(
        `${API_PATHS.adminClient(clientId)}/config-prompt?stack=${encodeURIComponent(stack)}`,
      )
    ).data.prompt;
  },
};

export const listUsers = AdminApi.listUsers;
export const getUser = AdminApi.getUser;
export const suspendUser = AdminApi.suspendUser;
export const unsuspendUser = AdminApi.unsuspendUser;
export const getMetrics = AdminApi.getMetrics;
export const getActivity = AdminApi.getActivity;
export const listClients = AdminApi.listClients;
export const getClient = AdminApi.getClient;
export const updateClient = AdminApi.updateClient;
export const createClient = AdminApi.createClient;
export const rotateSecret = AdminApi.rotateSecret;
export const setClientSuspended = AdminApi.setClientSuspended;
export const deleteClient = AdminApi.deleteClient;
export const changeUserRole = AdminApi.changeUserRole;
export const getConfigPrompt = AdminApi.getConfigPrompt;

