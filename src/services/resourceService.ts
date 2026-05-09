import api from './api';

export interface Norm {
  id: number;
  name: string;
  code: string;
  publish_date: string;
  status: string;
  pid: number;
  path: string;
  content_type: number;
}

export interface Atlas {
  id: number;
  name: string;
  code: string;
  publish_date: string;
  status: string;
  pid: string;
  path: string;
  content_type: number;
  pdf_url: string;
  area: string;
}

export interface PriceInfo {
  id: number;
  material_name: string;
  specification: string;
  unit: string;
  price: number;
  region: string;
  year: number;
  month: number;
  category: string;
}

export interface ResourceQuery {
  page?: number;
  page_size?: number;
  search?: string;
  type?: number;
}

export const resourceApi = {
  getNorms: (params?: ResourceQuery) =>
    api.get<any>('/api/resource/norms', { params }),

  getNormDetail: (id: number) =>
    api.get<any>(`/api/resource/norms/${id}`),

  getAtlas: (params?: ResourceQuery) =>
    api.get<any>('/api/resource/standards', { params }),

  getAtlasDetail: (id: number) =>
    api.get<any>(`/api/resource/standards/${id}`),

  getPrices: (params?: ResourceQuery) =>
    api.get<any>('/api/market/prices', { params }),

  getLatest: (signal?: AbortSignal) =>
    api.get<any>('/api/resource/latest', { signal }),
};
