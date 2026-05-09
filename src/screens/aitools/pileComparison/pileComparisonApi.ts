import api from '@/services/api';
import { API_CONFIG } from '@/constants';

export const pileComparisonApi = {
  upload: async (
    file: { uri: string; name: string; type: string },
    userId: number
  ): Promise<{ bid_id: string; status: string; message: string }> => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
    formData.append('user_id', String(userId));
    return api.post('/api/pile-comparison/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  uploadProfile: async (
    bidId: string,
    file: { uri: string; name: string; type: string },
    userId: number
  ): Promise<{ bid_id: string; status: string; message: string }> => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
    formData.append('user_id', String(userId));
    return api.post(`/api/pile-comparison/${bidId}/profile/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  uploadParameters: async (
    bidId: string,
    file: { uri: string; name: string; type: string },
  ): Promise<{ success: boolean; message?: string }> => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    return api.post(`/api/pile-comparison/${bidId}/parameters/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  uploadParametersInit: async (
    file: { uri: string; name: string; type: string },
    userId: number
  ): Promise<{ bid_id: string; success: boolean; message?: string }> => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
    formData.append('user_id', String(userId));
    return api.post(`/api/pile-comparison/parameters/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  confirmProfile: (bidId: string, overviewMarkdown?: string) =>
    api.post<any, { success: boolean; message: string; profile_review_status?: 'pending' | 'editing' | 'verified'; profile_version?: number }>(
      `/api/pile-comparison/${bidId}/confirm-profile`,
      { overview_markdown: overviewMarkdown }
    ),
  patchProfile: (
    bidId: string,
    payload: {
      base_version?: number;
      ops: Array<{ op: 'update_layer'; id: string; path: string; value: any }>;
      reason?: string;
    }
  ) =>
    api.post<
      any,
      {
        success: boolean;
        soil_layers: Array<{ id: string; name: string; index: number; thickness: number; color?: string; visible?: boolean; top_elevation?: number; bottom_elevation?: number }>;
        profile_review_status: 'editing' | 'pending' | 'verified';
        profile_version: number;
      }
    >(`/api/pile-comparison/${bidId}/profile/patch`, payload),

  chat: async (
    bidId: string,
    payload: {
      message: string;
      conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      request_id?: string;
    },
    options?: { timeoutMs?: number }
  ) => {
    const timeout = Number(options?.timeoutMs ?? API_CONFIG.TIMEOUT);
    const res = await api.post<
      any,
      {
        success: boolean;
        assistant_message: string;
        ops?: Array<{ op: 'update_layer'; id: string; path: string; value: any }>;
      }
    >(`/api/pile-comparison/${bidId}/chat`, payload, { timeout });
    return res;
  },

  patchHoleInfo: (
    bidId: string,
    payload: {
      hole_number?: string;
      ground_elevation?: number;
      hole_depth?: number;
      water_level?: number;
    }
  ) =>
    api.patch<
      any,
      {
        success: boolean;
        hole_info: { hole_number?: string; ground_elevation?: number; hole_depth?: number; water_level?: number };
        project_overview: { hole_number?: string; ground_elevation?: number; hole_depth?: number; water_level?: number };
      }
    >(`/api/pile-comparison/${bidId}/hole-info`, payload),

  chatRaw: async (
    bidId: string,
    payload: {
      message: string;
      conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      request_id?: string;
    },
    options?: { timeoutMs?: number }
  ): Promise<{ status: number; data: any; headers?: any }> => {
    const timeout = Number(options?.timeoutMs ?? API_CONFIG.TIMEOUT);
    const res = await api.post(`/api/pile-comparison/${bidId}/chat`, payload, { timeout });
    return { status: res.status, data: res.data, headers: res.headers };
  },
  updateParameters: (
    bidId: string,
    parameters: Array<{ layer: string; name?: string; side_friction_prefab?: number; end_bearing_prefab?: number; side_friction_drilled?: number; end_bearing_drilled?: number }>,
  ) => api.put<any, { success: boolean }>(`/api/pile-comparison/${bidId}/parameters`, { parameters }),
  confirmParameters: (bidId: string) =>
    api.post<any, { success: boolean }>(`/api/pile-comparison/${bidId}/confirm-parameters`, {}),
  updateBearing: (
    bidId: string,
    recommendations: Array<{ layer: string; reason?: string; compliance?: Array<string>; score?: number }>,
  ) => api.put<any, { success: boolean }>(`/api/pile-comparison/${bidId}/bearing`, { recommendations }),
  // 注意：generateBearing 已删除，推荐卡片现在由 generateBearingAdvice 统一生成
  generateBearingAdvice: (
    bidId: string,
    payload?: { load_level?: 'low' | 'mid' | 'high'; load_kn?: number; candidate_layers?: Array<{ key: string; layer: string; name: string; thickness?: number; end_bearing_prefab?: number; end_bearing_drilled?: number }> }
  ) => api.post<any, { success: boolean; advice_markdown?: string }>(
    `/api/pile-comparison/${bidId}/bearing/advice/generate`,
    payload || {},
    { timeout: 120000 },
  ),
  confirmBearing: (bidId: string) =>
    api.post<any, { success: boolean }>(`/api/pile-comparison/${bidId}/confirm-bearing`, {}),
  startPileCalculation: (bidId: string) =>
    api.post<any, { success: boolean }>(`/api/pile-comparison/${bidId}/start-calculation`, {}),
  getSoilLayers: (bidId: string) =>
    api.get<any, { layers: Array<{ id: string; name: string; index: number; thickness: number; color?: string }> }>(
      `/api/pile-comparison/${bidId}/soil-layers`
    ),

  getDocumentDetail: (bidId: string) =>
    api.get<
      any,
      {
        layers: Array<{ id: string; name: string; index: number; thickness: number; color?: string; visible?: boolean; top_elevation?: number; bottom_elevation?: number }>;
        parameters: Array<{ layer: string; name?: string; side_friction_prefab?: number; end_bearing_prefab?: number; side_friction_drilled?: number; end_bearing_drilled?: number }>;
        status: string;
        project_overview?: { hole_number?: string; ground_elevation?: number; hole_depth?: number; water_level?: number };
        profile_version?: number;
      }
    >(`/api/pile-comparison/${bidId}/detail`),

  getPrestressedPileParams: () =>
    api.get<
      any,
      {
        success: boolean;
        rows: Array<{
          reference_standard?: string;
          pile_type?: string;
          strength_grade?: string;
          outer_diameter?: number | string;
          wall_thickness?: number | string;
          pile_model?: string;
          specification?: string;
          reinforcement_image_url?: string;
          pile_connection_image_url?: string;
          platform_connection_image_url?: string;
          axial_compression_characteristic?: number | string;
          axial_tension_characteristic?: number | string;
        }>;
      }
    >(`/api/pile-comparison/prestressed-pile-params`),

  createStorageSignedUrl: (
    payload: { url: string; bucket?: string; expires_in?: number }
  ) =>
    api.post<
      any,
      {
        success: boolean;
        bucket: string;
        path: string;
        signed_url: string;
        expires_in: number;
      }
    >(`/api/pile-comparison/storage/signed-url`, payload),

  // ==================== 对比报告持久化 API ====================
  createComparisonReport: (
    bidId: string,
    payload: {
      id: string;
      title: string;
      markdown?: string;
      status?: string;
      error?: string;
    }
  ) =>
    api.post<
      any,
      {
        id: string;
        bid_id: string;
        user_id: number;
        title: string;
        markdown: string;
        status: string;
        error?: string;
        created_at: string;
        updated_at: string;
      }
    >(`/api/pile-comparison/${bidId}/reports`, payload),

  getComparisonReports: (bidId: string) =>
    api.get<
      any,
      Array<{
        id: string;
        bid_id: string;
        user_id: number;
        title: string;
        markdown: string;
        status: string;
        error?: string;
        created_at: string;
        updated_at: string;
      }>
    >(`/api/pile-comparison/${bidId}/reports`),

  getComparisonReport: (bidId: string, reportId: string) =>
    api.get<
      any,
      {
        id: string;
        bid_id: string;
        user_id: number;
        title: string;
        markdown: string;
        status: string;
        error?: string;
        created_at: string;
        updated_at: string;
      }
    >(`/api/pile-comparison/${bidId}/reports/${reportId}`),

  updateComparisonReport: (
    bidId: string,
    reportId: string,
    payload: {
      title?: string;
      markdown?: string;
      status?: string;
      error?: string;
    }
  ) =>
    api.put<
      any,
      {
        id: string;
        bid_id: string;
        user_id: number;
        title: string;
        markdown: string;
        status: string;
        error?: string;
        created_at: string;
        updated_at: string;
      }
    >(`/api/pile-comparison/${bidId}/reports/${reportId}`, payload),

  deleteComparisonReport: (bidId: string, reportId: string) =>
    api.delete<any, { success: boolean; message: string }>(
      `/api/pile-comparison/${bidId}/reports/${reportId}`
    ),

  exportComparisonReportPdf: async (payload: { title?: string; markdown: string }): Promise<ArrayBuffer> => {
    const timeout = Math.max(Number(API_CONFIG.TIMEOUT || 0), 120000);
    console.log('[pileComparisonApi] 请求PDF导出，payload长度:', payload?.markdown?.length);
    const res = await (api as any).post(`/api/pile-comparison/report/pdf`, payload, {
      timeout,
      responseType: 'arraybuffer',
      headers: {
        Accept: 'application/pdf',
      },
      validateStatus: () => true,
    });
    console.log('[pileComparisonApi] PDF响应类型:', typeof res, '是否有status:', 'status' in (res || {}), 'status:', (res as any)?.status);
    const status = Number((res as any)?.status);
    if (!Number.isFinite(status)) {
      console.log('[pileComparisonApi] 无效响应，res keys:', Object.keys(res || {}));
      throw new Error('export pdf failed: invalid response');
    }
    if (status < 200 || status >= 300) {
      let errMsg = `导出失败 (HTTP ${status})`;
      try {
        const errData = (res as any)?.data;
        if (errData instanceof ArrayBuffer || errData instanceof Uint8Array) {
          const decoder = new TextDecoder();
          const text = decoder.decode(new Uint8Array(errData));
          try {
            const parsed = JSON.parse(text);
            if (parsed?.detail?.message) errMsg = parsed.detail.message;
            else if (parsed?.message) errMsg = parsed.message;
          } catch { errMsg = text.slice(0, 200) || errMsg; }
        } else if (typeof errData === 'object' && errData !== null) {
          if (errData?.detail?.message) errMsg = errData.detail.message;
          else if (errData?.message) errMsg = errData.message;
        }
      } catch {}
      console.log('[pileComparisonApi] PDF导出HTTP错误:', errMsg);
      throw new Error(errMsg);
    }
    console.log('[pileComparisonApi] PDF导出成功，数据长度:', (res as any)?.data?.byteLength || 'unknown');
    return (res as any).data as ArrayBuffer;
  },

  // ==================== 信息价匹配 ====================
  getPileCities: () =>
    api.get<
      any,
      {
        code: number;
        message: string;
        result: {
          cities: Array<{ city_code: string; province: string; city: string }>;
        };
      }
    >(`/api/resource/info-price/pile-cities`),

  getPilePrice: (params: { city_code?: string; city_name?: string; spec_keyword?: string }) =>
    api.get<
      any,
      {
        code: number;
        message: string;
        result: {
          city: string;
          province: string;
          city_code: string;
          actual_period: string;
          total_count: number;
          data: Array<{
            id: number;
            material_name: string;
            spec_model: string;
            unit: string;
            tax_included_price: number | null;
            tax_excluded_price: number | null;
            year: number;
            month: number;
          }>;
        };
      }
    >(`/api/resource/info-price/pile-price`, { params }),
};

type WebSocketCallback = (data: any) => void;
type WebSocketConnectionEvent = 'open' | 'close' | 'error';

class PileComparisonWebSocket {
  private ws: WebSocket | null = null;
  private bidId: string = '';
  private callbacks: Map<string, WebSocketCallback[]> = new Map();
  private connectionCallbacks: Map<WebSocketConnectionEvent, Array<() => void>> = new Map();

  connect(bidId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.bidId = bidId;
      if (this.ws) {
        try { this.ws.close(); } catch {}
        this.ws = null;
      }
      const wsUrl = API_CONFIG.BASE_URL.replace('http', 'ws');
      this.ws = new WebSocket(`${wsUrl}/api/pile-comparison/ws/${bidId}`);
      this.ws.onopen = () => { this.emitConnectionEvent('open'); resolve(); };
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const type = data.type || 'message';
          const handlers = this.callbacks.get(type) || [];
          handlers.forEach(cb => cb(data));
          const allHandlers = this.callbacks.get('all') || [];
          allHandlers.forEach(cb => cb(data));
        } catch {}
      };
      this.ws.onerror = () => { this.emitConnectionEvent('error'); reject(new Error('ws error')); };
      this.ws.onclose = () => { this.emitConnectionEvent('close'); };
    });
  }

  on(event: string, callback: WebSocketCallback) {
    if (!this.callbacks.has(event)) this.callbacks.set(event, []);
    this.callbacks.get(event)!.push(callback);
  }

  off(event: string, callback?: WebSocketCallback) {
    if (callback) {
      const handlers = this.callbacks.get(event) || [];
      this.callbacks.set(event, handlers.filter(cb => cb !== callback));
    } else {
      this.callbacks.delete(event);
    }
  }

  onConnection(event: WebSocketConnectionEvent, callback: () => void) {
    if (!this.connectionCallbacks.has(event)) this.connectionCallbacks.set(event, []);
    this.connectionCallbacks.get(event)!.push(callback);
  }

  offConnection(event: WebSocketConnectionEvent, callback?: () => void) {
    if (callback) {
      const handlers = this.connectionCallbacks.get(event) || [];
      this.connectionCallbacks.set(event, handlers.filter(cb => cb !== callback));
    } else {
      this.connectionCallbacks.delete(event);
    }
  }

  private emitConnectionEvent(event: WebSocketConnectionEvent) {
    const handlers = this.connectionCallbacks.get(event) || [];
    handlers.forEach(cb => { try { cb(); } catch {} });
  }

  disconnect() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.bidId = '';
  }
}

export const pileComparisonWs = new PileComparisonWebSocket();
