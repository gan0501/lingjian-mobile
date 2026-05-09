/**
 * 指尖标书 API 服务
 */
import api from './api';
import { API_CONFIG } from '@/constants';

// ==================== 类型定义 ====================

/** 标书状态 */
export type BidStatus = 
  | 'draft'              // 草稿
  | 'parsing'            // 正在解析
  | 'parsed'             // 解析完成
  | 'generating_outline' // 正在生成大纲
  | 'outline_editing'    // 大纲编辑中
  | 'outline_confirmed'  // 大纲已确认
  | 'generating'         // 正在生成
  | 'reviewing'          // 审稿中
  | 'completed'          // 已完成
  | 'exported';          // 已导出

/** 项目概况 */
export interface ProjectOverview {
  project_name: string;
  project_type: string;
  budget: string;
  deadline: string;
  location: string;
  requirements: string;
  raw_text?: string;
  detailed_analysis?: string;  // AI详细分析内容（Markdown格式）
}

/** 评分要点项 */
export interface ScoringItem {
  name: string;
  score: number;
  criteria: string;
}

/** 评分要点 */
export interface ScoringCriteria {
  items: ScoringItem[];
  raw_text?: string;
}

/** 条目（三级） */
export interface Section {
  id: string;
  title: string;
  description: string;
  content?: string;
  status?: string;
  need_image?: boolean;
  image_keywords?: string;
  word_count?: number;
}

/** 节（二级） */
export interface SubChapter {
  id: string;
  title: string;
  description?: string;
  sections: Section[];
}

/** 章（一级） */
export interface Chapter {
  id: string;
  title: string;
  description?: string;
  sub_chapters: SubChapter[];
  status?: string;
}

/** 大纲结构 */
export interface Outline {
  chapters: Chapter[];
}

/** 用户配置 */
export interface UserConfig {
  user_id: number;
  model_provider: string;
  model_code: string;
  default_word_count: number;
  default_dark_bid_mode: boolean;
  auto_web_image: boolean;
  generate_flowchart: boolean;
  auto_proofread: boolean;
  default_cover_style: string;
  default_layout_style: string;
  default_color_scheme: string;
  default_knowledge_files: string[];
}

/** 标书文档 */
export interface BidDocument {
  id: string;
  user_id: number;
  title: string;
  status: BidStatus;
  source_file_url?: string;
  source_file_name?: string;
  project_overview?: ProjectOverview;
  scoring_criteria?: ScoringCriteria;
  outline?: Outline;
  model_provider: string;
  model_code: string;
  target_word_count: number;
  dark_bid_mode: boolean;
  knowledge_files: string[];
  total_tokens_used: number;
  total_word_count: number;
  total_images: number;
  created_at: string;
  updated_at: string;
}

/** 上传响应 */
export interface UploadResponse {
  bid_id: string;
  status: string;
  message: string;
}

/** 审稿建议 */
export interface ReviewSuggestion {
  section_id: string;
  section_title: string;
  issue_type: string;
  description: string;
  suggestion: string;
  severity: string;
}

/** 审稿结果 */
export interface ReviewResult {
  bid_id: string;
  suggestions: ReviewSuggestion[];
  overall_score: number;
  summary: string;
}

/** 账单明细 */
export interface BillingDetail {
  bid_id: string;
  word_count: number;
  tokens_used: number;
  generation_duration: number;
  image_search_count: number;
  image_count: number;
  token_cost: number;
  service_fee: number;
  maintenance_fee: number;
  management_fee: number;
  tax: number;
  discount: number;
  total_price: number;
}

/** 生成配置 */
export interface GenerationConfig {
  model_provider?: string;
  model_code?: string;
  target_word_count?: number;
  dark_bid_mode?: boolean;
  layout_style?: string;
  has_images?: boolean;
  has_page_border?: boolean;
  cover_style?: string;
  color_scheme?: string;
  knowledge_files?: string[];
  auto_proofread?: boolean;
  auto_web_image?: boolean;
  review_checklist?: any;
}

export type KnowledgeType = 'doc' | 'image' | 'table' | 'other';

export interface KnowledgeListItem {
  name: string;
  file_path: string;
  content_type?: string | null;
}

export interface KnowledgeListResponse {
  doc: KnowledgeListItem[];
  image: KnowledgeListItem[];
  table: KnowledgeListItem[];
  other: KnowledgeListItem[];
}

/** 可用模型 */
export interface AvailableModel {
  provider: string;
  code: string;
  name: string;
}

/** LLM 错误代码 */
export type LLMErrorCode =
  | 'auth_invalid_key'
  | 'auth_expired_key'
  | 'auth_missing_key'
  | 'quota_exceeded'
  | 'rate_limit'
  | 'model_not_found'
  | 'model_overloaded'
  | 'model_unavailable'
  | 'context_too_long'
  | 'invalid_request'
  | 'timeout'
  | 'network_error'
  | 'connection_refused'
  | 'content_filter'
  | 'empty_response'
  | 'unknown';

/** 归一化的 LLM 错误 */
export interface NormalizedLLMError {
  code: LLMErrorCode;
  message: string;
  detail: string;
  retryable: boolean;
  retry_after?: number;
}

/** WebSocket LLM 错误消息 */
export interface LLMErrorMessage {
  type: 'llm_error';
  error: NormalizedLLMError;
  context: string;
}

// ==================== WebSocket 管理 ====================

type WebSocketCallback = (data: any) => void;

type WebSocketConnectionEvent = 'open' | 'close' | 'error';

class BidWriterWebSocket {
  private ws: WebSocket | null = null;
  private bidId: string = '';
  private callbacks: Map<string, WebSocketCallback[]> = new Map();
  private connectionCallbacks: Map<WebSocketConnectionEvent, Array<() => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 30;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastNetworkAbortLogAt = 0;

  private emitConnectionEvent(event: WebSocketConnectionEvent) {
    const handlers = this.connectionCallbacks.get(event) || [];
    handlers.forEach(cb => {
      try {
        cb();
      } catch {}
    });
  }

  connect(bidId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.bidId = bidId;

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.ws) {
        try {
          this.ws.close();
        } catch {}
        this.ws = null;
      }

      const wsUrl = API_CONFIG.BASE_URL.replace('http', 'ws');
      this.ws = new WebSocket(`${wsUrl}/api/bid-writer/ws/${bidId}`);

      this.ws.onopen = () => {
        if (__DEV__) {
          console.log('[BidWriter WS] 连接成功');
        }
        this.reconnectAttempts = 0;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.emitConnectionEvent('open');
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const type = data.type || 'message';

          // 心跳 ping — 回复 pong 保持连接
          if (type === 'ping') {
            try {
              this.ws?.send(JSON.stringify({ type: 'pong' }));
            } catch {}
            return;
          }

          const handlers = this.callbacks.get(type) || [];
          handlers.forEach(cb => cb(data));
          
          // 也触发通用的 'all' 回调
          const allHandlers = this.callbacks.get('all') || [];
          allHandlers.forEach(cb => cb(data));
        } catch (e) {
          console.error('[BidWriter WS] 解析消息失败:', e);
        }
      };

      this.ws.onerror = (error) => {
        const rawMsg = String((error as any)?.message || (error as any)?.nativeEvent?.message || '');
        const fallback = (() => {
          try {
            return JSON.stringify(error);
          } catch {
            return String(error);
          }
        })();
        const msg = rawMsg || fallback;
        const msgLower = msg.toLowerCase();
        const msgCompact = msgLower.replace(/\s+/g, '');

        const isExpectedNetworkAbort =
          msgLower.includes('connection abort') ||
          msgCompact.includes('connectionabort') ||
          msgLower.includes('econnreset') ||
          msgLower.includes('connection reset') ||
          msgLower.includes('failed to connect') ||
          msgLower.includes('software caused') ||
          msgCompact.includes('softwarecausedconnectionabort') ||
          msgLower.includes('unexpected end of stream') ||
          msgLower.includes('end of stream');

        if (!isExpectedNetworkAbort) {
          console.error('[BidWriter WS] 连接错误:', error);
        } else {
          const now = Date.now();
          this.lastNetworkAbortLogAt = now;
        }
        this.emitConnectionEvent('error');
        this.tryReconnect();
        reject(error);
      };

      this.ws.onclose = () => {
        if (__DEV__) {
          console.log('[BidWriter WS] 连接关闭');
        }
        this.emitConnectionEvent('close');
        this.tryReconnect();
      };
    });
  }

  onConnection(event: WebSocketConnectionEvent, callback: () => void) {
    if (!this.connectionCallbacks.has(event)) {
      this.connectionCallbacks.set(event, []);
    }
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

  private tryReconnect() {
    if (__DEV__) {
      console.log(`[BidWriter WS] 尝试重连检查: reconnectAttempts=${this.reconnectAttempts}, maxAttempts=${this.maxReconnectAttempts}, bidId=${this.bidId}`);
    }
    if (this.reconnectTimer) {
      return;
    }
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.bidId) {
      this.reconnectAttempts++;
      if (__DEV__) {
        console.log(`[BidWriter WS] 开始重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      }
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect(this.bidId).catch(() => {});
      }, Math.min(2000 * this.reconnectAttempts, 30000));
    } else {
      if (__DEV__) {
        console.log(`[BidWriter WS] 不重连: reconnectAttempts=${this.reconnectAttempts}, maxAttempts=${this.maxReconnectAttempts}, bidId=${this.bidId}`);
      }
    }
  }

  on(event: string, callback: WebSocketCallback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
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

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    // 不清除回调，保留事件监听器
    // 这样重连后事件监听器仍然有效
    this.bidId = '';
  }

  // 完全清理（包括回调）
  cleanup() {
    this.disconnect();
    this.callbacks.clear();
    this.connectionCallbacks.clear();
  }
}

// 导出WebSocket实例
export const bidWriterWs = new BidWriterWebSocket();

// ==================== API 接口 ====================

export const bidWriterApi = {
  // ==================== 用户配置 ====================
  
  /**
   * 获取用户配置
   */
  getConfig: (userId: number) =>
    api.get<any, UserConfig>(`/api/bid-writer/config/${userId}`),

  /**
   * 更新用户配置
   */
  updateConfig: (userId: number, config: Partial<UserConfig>) =>
    api.put<any, { code: number; message: string; config: UserConfig }>(
      `/api/bid-writer/config/${userId}`,
      config
    ),

  // ==================== 文件上传 ====================

  /**
   * 上传招标文件
   * 后端会直接从配置表读取模型配置
   */
  uploadFile: async (
    file: { uri: string; name: string; type: string },
    userId: number
  ): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
    formData.append('user_id', String(userId));

    return api.post('/api/bid-writer/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },


  /**
   * 从用户提供的目录/大纲创建标书
   * 支持上传目录文件或直接输入文本
   */
  createFromOutline: async (
    userId: number,
    options: { file?: { uri: string; name: string; type: string }; outlineText?: string }
  ): Promise<{ bid_id: string; status: string; message: string }> => {
    const formData = new FormData();
    formData.append('user_id', String(userId));
    if (options.file) {
      formData.append('file', {
        uri: options.file.uri,
        name: options.file.name,
        type: options.file.type,
      } as any);
    }
    if (options.outlineText) {
      formData.append('outline_text', options.outlineText);
    }
    return api.post('/api/bid-writer/create-from-outline', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /**
   * 获取标书状态
   */
  getStatus: (bidId: string) =>
    api.get<any, {
      bid_id: string;
      status: BidStatus;
      title: string;
      has_overview: boolean;
      has_scoring: boolean;
      has_outline: boolean;
    }>(`/api/bid-writer/${bidId}/status`),

  /**
   * 获取项目概况和评分要点
   */
  getOverview: (bidId: string) =>
    api.get<any, {
      bid_id: string;
      project_overview: ProjectOverview | null;
      scoring_criteria: ScoringCriteria | null;
    }>(`/api/bid-writer/${bidId}/overview`),

  /**
   * 获取大纲
   */
  getOutline: (bidId: string) =>
    api.get<any, {
      bid_id: string;
      outline: Outline;
      status: BidStatus;
    }>(`/api/bid-writer/${bidId}/outline`),

  /**
   * 获取大纲思路流式内容（用于打字机效果）
   */
  getOutlineStream: (bidId: string) =>
    api.get<any, {
      bid_id: string;
      content: string;
      error?: string;
      is_timeout?: boolean;
      complete: boolean;
      has_outline: boolean;
    }>(`/api/bid-writer/${bidId}/outline-stream`),

  /**
   * 重新生成大纲（当生成失败或超时时）
   */
  regenerateOutline: (bidId: string) =>
    api.post<any, { success: boolean; message: string }>(
      `/api/bid-writer/${bidId}/regenerate-outline`
    ),

  /**
   * 更新大纲
   */
  updateOutline: (bidId: string, outline: Outline) =>
    api.put<any, { success: boolean; message: string }>(
      `/api/bid-writer/${bidId}/outline`,
      { outline }
    ),

  /**
   * 确认大纲（进入第三步）
   */
  confirmOutline: (bidId: string) =>
    api.post<any, { success: boolean; message: string }>(
      `/api/bid-writer/${bidId}/confirm-outline`
    ),

  /**
   * 开始生成标书内容
   */
  startGeneration: (bidId: string, config?: GenerationConfig) =>
    api.post<any, { success: boolean; message: string }>(
      `/api/bid-writer/${bidId}/start-generation`,
      config || {}
    ),

  // ==================== 知识库 ====================

  knowledgeList: (params?: { type?: KnowledgeType }) =>
    api.get<any, KnowledgeListResponse>('/api/bid-writer/knowledge/list', { params }),

  knowledgeUpload: async (
    file: { uri: string; name: string; type: string },
    knowledgeType: KnowledgeType,
  ): Promise<KnowledgeListItem> => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
    formData.append('knowledge_type', knowledgeType);

    return api.post('/api/bid-writer/knowledge/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  knowledgeDelete: (filePath: string) =>
    api.delete<any, { success: boolean }>('/api/bid-writer/knowledge/delete', {
      data: { file_path: filePath },
    }),

  knowledgeRename: (filePath: string, newTitle: string) =>
    api.put<any, { success: boolean }>('/api/bid-writer/knowledge/rename', {
      file_path: filePath,
      title: newTitle,
    }),

  updateBidKnowledgeFiles: (bidId: string, knowledgeFiles: string[]) =>
    api.put<any, { success: boolean; knowledge_files: string[] }>(
      `/api/bid-writer/${bidId}/knowledge-files`,
      { knowledge_files: knowledgeFiles },
    ),

  getBidKnowledgeFiles: (bidId: string) =>
    api.get<any, { knowledge_files: string[] }>(
      `/api/bid-writer/${bidId}/knowledge-files`,
    ),

  /**
   * 处理审稿操作
   */
  reviewAction: (bidId: string, action: 'continue' | 'complete', editedSuggestions?: ReviewSuggestion[]) =>
    api.post<any, { success: boolean; message: string }>(
      `/api/bid-writer/${bidId}/review-action`,
      {
        action,
        edited_suggestions: editedSuggestions,
      }
    ),

  /**
   * 导出标书
   */
  exportDocument: (bidId: string, format: 'docx' | 'pdf' = 'docx', styleOptions?: {
    cover_style?: string;
    color_scheme?: string;
    layout_style?: string;
    has_images?: boolean;
    has_page_border?: boolean;
  }) =>
    api.get<any, any>(`/api/bid-writer/${bidId}/export`, {
      params: { format, ...styleOptions },
      responseType: 'arraybuffer',
      timeout: 120000,
    }),

  previewHtml: (bidId: string, styleOptions?: {
    cover_style?: string;
    layout_style?: string;
    color_scheme?: string;
    has_page_border?: boolean;
    dark_bid_mode?: boolean;
  }) =>
    api.get<any, string>(`/api/bid-writer/${bidId}/preview-html`, {
      params: styleOptions,
      timeout: 15000,
    }),

  /**
   * 获取可用的AI模型列表
   */
  getModels: () =>
    api.get<any, { models: AvailableModel[] }>('/api/bid-writer/models'),

  /**
   * 删除标书
   */
  deleteBid: (bidId: string) =>
    api.delete<any, { success: boolean; message: string }>(`/api/bid-writer/${bidId}`),

  /**
   * 获取用户的标书列表
   */
  listBids: (params?: { limit?: number; offset?: number }) =>
    api.get<any, Array<{
      id: string;
      title: string;
      status: BidStatus;
      created_at: string;
      updated_at: string;
      total_word_count: number;
    }>>('/api/bid-writer/list', { params }),

  // ==================== 图片配置 (Step.2) ====================

  /**
   * 获取所有需要配图的位置
   */
  getImagePositions: (bidId: string) =>
    api.get<any, {
      image_positions: Array<{
        section_id: string;
        section_title: string;
        chapter_title: string;
        keywords: string;
        position: number;
      }>;
      total: number;
    }>(`/api/bid-writer/${bidId}/image-positions`),

  /**
   * 搜索图片
   */
  searchImages: (bidId: string, keywords: string, sectionId?: string) =>
    api.post<any, {
      keywords: string;
      images: string[];
      section_id?: string;
    }>(`/api/bid-writer/${bidId}/search-images`, {
      keywords,
      section_id: sectionId,
    }),

  /**
   * 保存用户选择的图片
   */
  selectImage: (bidId: string, sectionId: string, keywords: string, imageUrl: string) =>
    api.post<any, { success: boolean; message: string }>(`/api/bid-writer/${bidId}/select-image`, {
      section_id: sectionId,
      keywords,
      image_url: imageUrl,
    }),

  /**
   * 获取知识库图片URL列表
   */
  getKnowledgeImageUrls: () =>
    api.get<any, {
      images: Array<{
        name: string;
        file_path: string;
        url: string;
      }>;
    }>('/api/bid-writer/knowledge/image-urls'),

  clientLog: (data: {
    level: 'error' | 'info' | 'warn';
    event: string;
    bid_id?: string | null;
    ts?: string;
    platform?: string;
    app_version?: string;
    payload?: any;
  }) => api.post<any, { success: boolean }>(`/api/bid-writer/client-log`, data),

  // ==================== 桩基比选 ====================
  confirmProfile: (bidId: string, overviewMarkdown?: string) =>
    api.post<any, { success: boolean; message: string }>(
      `/api/pile-comparison/${bidId}/confirm-profile`,
      { overview_markdown: overviewMarkdown }
    ),

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

  confirmBearing: (bidId: string) =>
    api.post<any, { success: boolean }>(`/api/pile-comparison/${bidId}/confirm-bearing`, {}),

  startPileCalculation: (bidId: string) =>
    api.post<any, { success: boolean }>(`/api/pile-comparison/${bidId}/start-calculation`, {}),

  getSoilLayers: (bidId: string) =>
    api.get<any, { layers: Array<{ id: string; name: string; index: number; thickness: number; color?: string }> }>(
      `/api/pile-comparison/${bidId}/soil-layers`
    ),
};

export default bidWriterApi;
