import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, AuthorizedApp, SessionView, ProfileData } from '@/types';

export async function listApps() {
  return (await apiClient.get<ApiEnvelope<AuthorizedApp[]>>('/api/me/apps')).data;
}

export async function revokeApp(clientId: string) {
  return (await apiClient.del<ApiEnvelope<{ revokedTokens: number }>>(`/api/me/apps/${encodeURIComponent(clientId)}`)).data;
}

export async function listSessions() {
  return (await apiClient.get<ApiEnvelope<SessionView[]>>('/api/me/sessions')).data;
}

export async function revokeSession(sid: string) {
  await apiClient.del(`/api/me/sessions/${encodeURIComponent(sid)}`);
}

export async function revokeAllSessions() {
  return (await apiClient.post<ApiEnvelope<{ revoked: number }>>('/api/me/sessions/revoke-all')).data;
}

export async function getProfile() {
  return (await apiClient.get<ApiEnvelope<ProfileData>>('/api/me/profile')).data;
}

export async function updateProfile(input: Partial<Pick<ProfileData, 'name' | 'bio' | 'jobTitle' | 'company' | 'country' | 'profilePictureUrl'>>) {
  return (await apiClient.patch<ApiEnvelope<ProfileData>>('/api/me/profile', input)).data;
}
