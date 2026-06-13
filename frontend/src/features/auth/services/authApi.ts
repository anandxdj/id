import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, User } from '@/types';

export async function loginRequest(email: string, password: string) {
  const res = await apiClient.post<ApiEnvelope<{ user: User; accessToken: string }>>('/api/auth/login', {
    email,
    password,
  });
  return res.data;
}

export async function registerRequest(name: string, email: string, password: string) {
  const res = await apiClient.post<ApiEnvelope<{ user: User }>>('/api/auth/register', {
    name,
    email,
    password,
  });
  return res.data;
}

export async function refreshRequest() {
  const res = await apiClient.post<ApiEnvelope<{ accessToken: string }>>('/api/auth/refresh-token');
  return res.data;
}

export async function meRequest() {
  const res = await apiClient.get<ApiEnvelope<User>>('/api/auth/me');
  return res.data;
}

export async function logoutRequest() {
  await apiClient.post('/api/auth/logout');
}
