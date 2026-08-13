import { apiClient } from '@/lib/api-client';
import { API_PATHS } from '@/lib/constants';
import type { ApiEnvelope, AuthorizedApp, SessionView, ProfileData } from '@/types';

export const AccountApi = {
  async listApps() {
    return (await apiClient.get<ApiEnvelope<AuthorizedApp[]>>(API_PATHS.APPS)).data;
  },

  async revokeApp(clientId: string) {
    return (await apiClient.del<ApiEnvelope<{ revokedTokens: number }>>(API_PATHS.app(clientId))).data;
  },

  async listSessions() {
    return (await apiClient.get<ApiEnvelope<SessionView[]>>(API_PATHS.SESSIONS)).data;
  },

  async revokeSession(sid: string) {
    await apiClient.del(API_PATHS.session(sid));
  },

  async revokeAllSessions() {
    return (await apiClient.post<ApiEnvelope<{ revoked: number }>>(API_PATHS.REVOKE_ALL_SESSIONS)).data;
  },

  async getProfile() {
    return (await apiClient.get<ApiEnvelope<ProfileData>>(API_PATHS.PROFILE)).data;
  },

  async updateProfile(
    input: Partial<Pick<ProfileData, 'name' | 'bio' | 'jobTitle' | 'company' | 'country' | 'profilePictureUrl'>>,
  ) {
    return (await apiClient.patch<ApiEnvelope<ProfileData>>(API_PATHS.PROFILE, input)).data;
  },

  async deleteAccount() {
    return (await apiClient.del<ApiEnvelope<{ sessionsRevoked: number }>>(API_PATHS.ACCOUNT)).data;
  },
};

export const listApps = AccountApi.listApps;
export const revokeApp = AccountApi.revokeApp;
export const listSessions = AccountApi.listSessions;
export const revokeSession = AccountApi.revokeSession;
export const revokeAllSessions = AccountApi.revokeAllSessions;
export const getProfile = AccountApi.getProfile;
export const updateProfile = AccountApi.updateProfile;
export const deleteAccount = AccountApi.deleteAccount;
