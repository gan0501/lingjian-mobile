import api from './api';
import { useAuthStore } from '@/stores';

export interface LoginResponse {
  user: { id: number; nickname?: string; avatar?: string; phone?: string };
  token: string;
  refresh_token: string;
  expires_at: number;
}

export const authApi = {
  sendCode: (phone: string) =>
    api.post('/api/auth/send-code', { phone_number: phone }),

  loginWithCode: (phone: string, code: string) =>
    api.post<LoginResponse>('/api/auth/login-with-code', { phone_number: phone, verification_code: code }),

  refreshToken: (refreshToken: string) =>
    api.post('/api/auth/refresh-token', { refresh_token: refreshToken }),

  getUser: () =>
    api.get('/api/auth/user'),

  updateProfile: (data: { nickname?: string; avatar?: string }) =>
    api.put('/api/auth/profile', data),

  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {}
    useAuthStore.getState().logout();
  },
};
