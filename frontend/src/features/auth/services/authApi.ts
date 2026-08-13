import { apiClient } from '@/lib/api-client';
import { API_PATHS } from '@/lib/constants';
import type { ApiEnvelope, User } from '@/types';

export const AuthApi = {
  async login(email: string, password: string) {
    const res = await apiClient.post<ApiEnvelope<{ user: User; accessToken: string }>>(API_PATHS.LOGIN, {
      email,
      password,
    });
    return res.data;
  },

  async register(name: string, email: string, password: string) {
    const res = await apiClient.post<ApiEnvelope<null>>(API_PATHS.REGISTER, {
      name,
      email,
      password,
    });
    return res.data;
  },

  async refresh() {
    const res = await apiClient.post<ApiEnvelope<{ accessToken: string }>>(API_PATHS.REFRESH);
    return res.data;
  },

  async me() {
    const res = await apiClient.get<ApiEnvelope<User>>(API_PATHS.ME);
    return res.data;
  },

  async logout() {
    await apiClient.post(API_PATHS.LOGOUT);
  },

  async verifyEmail(token: string) {
    const res = await apiClient.post<ApiEnvelope<null>>(API_PATHS.VERIFY_EMAIL, { token });
    return res.data;
  },

  async resendVerification(email: string) {
    const res = await apiClient.post<ApiEnvelope<null>>(API_PATHS.RESEND_VERIFICATION, { email });
    return res.data;
  },

  async forgotPassword(email: string) {
    const res = await apiClient.post<ApiEnvelope<null>>(API_PATHS.FORGOT_PASSWORD, { email });
    return res.data;
  },

  async resetPassword(token: string, password: string) {
    const res = await apiClient.post<ApiEnvelope<null>>(API_PATHS.RESET_PASSWORD, { token, password });
    return res.data;
  },
};

/** Named aliases so existing `authApi.loginRequest` call sites keep compiling during the cutover. */
export const loginRequest = AuthApi.login;
export const registerRequest = AuthApi.register;
export const refreshRequest = AuthApi.refresh;
export const meRequest = AuthApi.me;
export const logoutRequest = AuthApi.logout;
