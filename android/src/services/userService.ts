import api from './api';

export interface UserProfile {
  id: number;
  nickname?: string;
  avatar?: string;
  phone?: string;
  role?: string;
}

export interface MembershipStatus {
  level: number;
  status: 'none' | 'active' | 'expired';
  expired_at?: string;
}

export const userApi = {
  getCurrent: () =>
    api.get<UserProfile>('/api/user/profile'),

  updateProfile: (data: { nickname?: string; avatar?: string; profession?: string; company?: string; area?: string }) =>
    api.put('/api/user/profile', data),

  getMembership: () =>
    api.get<MembershipStatus>('/api/user/membership'),

  deleteAccount: () =>
    api.delete('/api/user/account'),

  getMarkerSettings: () =>
    api.get('/api/user/marker-settings'),

  updateMarkerSettings: (data: { flag_style?: string; flag_color?: string; flag_icon?: string }) =>
    api.put('/api/user/marker-settings', data),

  createFollowedProject: (data: {
    project_id: string;
    project_name: string;
    project_type: string;
    project_data?: any;
  }) => api.post('/api/user/followed-projects', data),
};
