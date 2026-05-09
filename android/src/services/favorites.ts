import api from './api';

export interface FavoriteItem {
  id: number;
  target_id: string;
  target_type: string;
  target_name: string;
  target_data: any;
  created_at: string;
}

export interface AddFavoriteRequest {
  target_id: string;
  target_type: 'enterprise' | 'manufacturer' | 'project';
  target_name?: string;
  target_data?: any;
}

export interface LikeResult {
  liked: boolean;
  like_count: number;
}

export const favoritesApi = {
  add: (data: AddFavoriteRequest) =>
    api.post<any, any>('/api/user/favorites', data),

  remove: (targetId: string, targetType: string) =>
    api.delete<any, any>('/api/user/favorites', {
      params: { target_id: targetId, target_type: targetType },
    }),

  list: (targetType: string = 'enterprise') =>
    api.get<any, any>('/api/user/favorites', {
      params: { target_type: targetType },
    }),
};

export const likesApi = {
  toggle: (targetId: string, targetType: string) =>
    api.post<any, any>('/api/user/likes', {
      target_id: targetId,
      target_type: targetType,
    }),

  getCount: (targetId: string, targetType: string = 'enterprise') =>
    api.get<any, any>('/api/user/likes/count', {
      params: { target_id: targetId, target_type: targetType },
    }),

  check: (targetId: string, targetType: string = 'enterprise') =>
    api.get<any, any>('/api/user/likes/check', {
      params: { target_id: targetId, target_type: targetType },
    }),
};
