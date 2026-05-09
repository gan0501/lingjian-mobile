import api from './api';

// ─── 类型定义 ───

export interface Project {
  id: string;
  name: string;
  type: number;
  latitude: number;
  longitude: number;
  province?: string;
  city?: string;
  address?: string;
  status?: string;
  created_at?: string;
}

export interface ProjectCluster {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  type: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

interface ClusterQueryParams {
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
  zoom: number;
  search?: string;
  project_types?: string;
}

// ─── API ───

export const projectApi = {
  // 分类查询
  getPlanning: (params?: Record<string, any>) =>
    api.get<any>('/api/projects/planning', { params }),

  getLand: (params?: Record<string, any>) =>
    api.get<any>('/api/projects/land', { params }),

  getBidding: (params?: Record<string, any>) =>
    api.get<any>('/api/projects/bidding', { params }),

  getProcurement: (params?: Record<string, any>) =>
    api.get<any>('/api/projects/procurement', { params }),

  // 地图聚合查询（V2 地图核心 API）
  getProjectClusters: (params: ClusterQueryParams, signal?: AbortSignal) =>
    api.get<any>('/api/projects/map/clusters', { params, signal }),

  // 项目跟进
  follow: (data: { project_id: string; project_type: number; project_name: string; project_data?: any }) => {
    // 后端 FollowedProjectCreate.project_type 是字符串，需要从数字映射
    const typeMap: Record<number, string> = {
      1: 'planning',
      2: 'land_auction',
      3: 'tender_notice',
      4: 'procurement',
      5: 'custom',
    };
    return api.post('/api/user/followed-projects', {
      project_id: data.project_id,
      project_type: typeMap[data.project_type] || 'land_auction',
      project_name: data.project_name,
      project_data: data.project_data,
      follow_status: 'active',
    });
  },

  unfollow: (projectId: string) =>
    api.delete(`/api/user/followed-projects/${projectId}`),

  getFollowed: () =>
    api.get<Project[]>('/api/user/followed-projects/all'),

  // 获取所有跟进项目（不分页，地图缓存用）
  getAllFollowedProjects: async () => {
    const resp = await api.get<any>('/api/user/followed-projects/all', {
      params: { limit: 1000 },
    });
    const result = Array.isArray(resp) ? resp : (resp?.result ?? []);
    return result;
  },

  // 老兼容（简单cluster查询）
  getClusters: (params: {
    min_lat: number;
    max_lat: number;
    min_lon: number;
    max_lon: number;
    zoom: number;
    search?: string;
    project_types?: string;
  }) =>
    api.get<{ clusters: ProjectCluster[]; totals: { total: number; [key: string]: number } }>(
      '/api/projects/map/clusters',
      { params }
    ),
};
