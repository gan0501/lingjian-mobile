import api from './api';

// ─── 类型定义 ───

export interface Enterprise {
  id: number;
  enterprise_id?: number;
  enterprise_name?: string;
  name: string;
  type: number;
  enterprise_type?: number;
  credit_code?: string;
  legal_person?: string;
  register_address?: string;
  register_capital?: string;
  contact_phone?: string;
  qualification?: string;
  province?: string;
  city?: string;
  lat?: number;
  lng?: number;
  lon?: number;
  logo_url?: string;
}

export interface EnterpriseCluster {
  id: number;
  latitude: number;
  longitude: number;
  type: number;
}

export interface MapTotals {
  total: number;
  type1: number;
  type2: number;
  type3: number;
  type4: number;
}

// ─── 建企 API（enterprise_type 8-16）───

export const enterpriseApi = {
  /** 地图聚合/散点查询（建企 + 厂家共���同一接口） */
  getMapClusters: (params: Record<string, any>) =>
    api.get<any>('/api/factory/enterprises/map/clusters', { params }),

  /** 兼容旧引用 */
  getClusters: (params: {
    min_lat: number;
    max_lat: number;
    min_lon: number;
    max_lon: number;
    zoom: number;
    enterprise_types?: string;
    search?: string;
  }) =>
    api.get<{ clusters: EnterpriseCluster[]; totals: { total: number; [key: string]: number } }>(
      '/api/factory/enterprises/map/clusters',
      { params }
    ),

  getDetail: (id: number, enterpriseType?: number) => {
    const baseUrl = enterpriseType && enterpriseType >= 8 ? '/api/manufacturers' : '/api/factory/enterprises';
    return api.get<Enterprise>(`${baseUrl}/${id}`);
  },

  submit: (data: {
    enterprise_name: string;
    enterprise_type_text?: string;
    qualification?: string;
    contact_phone?: string;
    lat: number;
    lon: number;
  }) =>
    api.post('/api/factory/enterprises/submit', data),

  claim: (data: { enterprise_id: number; license_url: string; contact_name: string; contact_phone: string }) =>
    api.post('/api/factory/enterprises/claim', data),

  getClaimStatus: (enterpriseId: number) =>
    api.get(`/api/factory/enterprises/claim/status/${enterpriseId}`),

  uploadFile: (formData: FormData) =>
    api.post('/api/factory/enterprises/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// ─── 厂家 API（enterprise_type 1-6，共用同一后端接口）───

export const manufacturerApi = {
  getMapClusters: enterpriseApi.getMapClusters,

  getDetail: (id: number, manufacturerType?: number) =>
    api.get<Enterprise>(`/api/factory/enterprises/${id}`, {
      params: manufacturerType ? { enterprise_type: manufacturerType } : undefined,
    }),

  submit: enterpriseApi.submit,
  claim: enterpriseApi.claim,
  getClaimStatus: enterpriseApi.getClaimStatus,
};
