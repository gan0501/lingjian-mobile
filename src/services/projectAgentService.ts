/**
 * projectAgentService.ts - V2 项目跟进智能体 API 服务
 *
 * 完整对接 V1 的 24 个 API 端点，保持 1:1 功能覆盖。
 */
import api from './api';
import { API_CONFIG } from '@/constants/config';
import EventSource from 'react-native-sse';

// ─── 类型定义 ───

export interface ConversationPair {
  id: string;
  user_message_id: string;
  user_message: string;
  assistant_message_id: string;
  assistant_message: string;
  timestamp: string;
  is_system_message?: boolean;
}

export interface Note {
  id: string;
  user_id?: number;
  project_id: number | string;
  knowledge_type?: string;
  title?: string;
  content: string;
  metadata?: {
    source?: string;
    file_type?: string;
    file_path?: string;
    file_url?: string;
    original_filename?: string;
    summary?: string;
    tags?: string[];
    priority?: string;
    created_by?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface FollowupData {
  pending_nodes: any[];
  confirmed_records: any[];
  total: number;
}

export interface RelationshipGraphData {
  entities: {
    companies: any[];
    persons: any[];
    projects?: any[];
  };
  relationships: any[];
  updated_at?: string;
  company_graph?: { nodes: any[]; edges: any[] };
  personnel_graph?: { nodes: any[]; edges: any[] };
}

export interface AgentStatusData {
  chat: { active: boolean; message: string };
  followup: { active: boolean; pending_count: number; message: string };
  note: { active: boolean; draft_count: number; message: string };
  summary: { active: boolean; has_new_summary: boolean; message: string };
}

export interface SummaryData {
  project?: any;
  project_type?: number;
  agent_a?: { summary: string };
  agent_b?: any;
  agent_c?: { status: string; notes: any[]; daily_report: { date: string | null; content: string } };
  agent_d?: { relationship_graph: any; enterprise_info: { enterprises: any[] } };
}

export interface ProcessUserInputResult {
  agent_a_response: string;
  agent_b_triggered?: boolean;
  agent_b_result?: any;
  agent_c_triggered?: boolean;
  agent_c_result?: any;
  timestamp: string;
  user_message_id?: string;
  assistant_message_id?: string;
}

// ─── API 实例 ───

export const projectAgentApi = {

  // ─── 对话 ───

  /** 获取对话历史 */
  getConversationHistory: (project_id: string) =>
    api.get<any, { success: boolean; data: ConversationPair[] }>(
      '/api/project-agent/conversation-history',
      { params: { project_id } },
    ),

  /** 发送消息给AI智能体 */
  processUserInput: (data: {
    message: string;
    project_id: string;
    project_type: number;
    conversation_history?: any[];
    file_urls?: { name: string; url: string; type: string }[];
  }) =>
    api.post<any, { success: boolean; data: ProcessUserInputResult }>(
      '/api/project-agent/process-user-input', data,
    ),

  // ─── 摘要/状态 ───

  /** 检查&生成摘要 */
  checkAndGenerateSummary: (data: {
    project_id: string;
    project_type: number;
    project_name?: string;
  }) =>
    api.post<any, { success: boolean; data: SummaryData }>(
      '/api/project-agent/check-and-generate-summary', data,
    ),

  /** 获取各Agent状态（气泡提示） */
  getAgentStatus: (project_id: string) =>
    api.get<any, { success: boolean; data: AgentStatusData }>(
      '/api/project-agent/agent-status',
      { params: { project_id } },
    ),

  // ─── 跟进 ───

  /** 获取跟进记录（待确认 + 已确认） */
  getFollowups: (project_id: string) =>
    api.get<any, { success: boolean; data: FollowupData }>(
      '/api/project-agent/followups',
      { params: { project_id } },
    ),

  /** 创建跟进 */
  createFollowup: (data: {
    project_id: string;
    content: string;
    title?: string;
    source?: string;
    status?: string;
  }) =>
    api.post<any, { success: boolean }>('/api/project-agent/followups', data),

  /** 更新跟进 */
  updateFollowup: (data: {
    followup_id: string;
    project_id: string;
    content: string;
  }) =>
    api.put<any, any>('/api/project-agent/followups', data),

  /** 确认跟进（待确认→已确认） */
  confirmFollowup: (data: { followup_id: string; project_id: string }) =>
    api.put<any, any>('/api/project-agent/followups/confirm', data),

  /** 删除跟进 */
  deleteFollowup: (data: { followup_id: string; project_id: string }) =>
    api.delete<any, any>('/api/project-agent/followups', { data }),

  // ─── 笔记 ───

  /** 获取笔记列表 */
  getNotes: (project_id: string) =>
    api.get<any, { success: boolean; data: Note[] }>(
      '/api/project-agent/notes',
      { params: { project_id } },
    ),

  /** 创建笔记 */
  createNote: (data: {
    project_id: string;
    content: string;
    title?: string;
    tags?: string[];
  }) =>
    api.post<any, any>('/api/project-agent/notes', data),

  /** 更新笔记 */
  updateNote: (data: {
    note_id: string;
    project_id: string;
    content: string;
    tags?: string[];
  }) =>
    api.put<any, any>('/api/project-agent/notes', data),

  /** 删除笔记 */
  deleteNote: (data: { note_id: string; project_id: string }) =>
    api.delete<any, any>('/api/project-agent/notes', { data }),

  // ─── 关系图/总结 ───

  /** 获取企业/人物关系图 */
  getRelationshipGraph: (project_id: string) =>
    api.get<any, { success: boolean; data: RelationshipGraphData }>(
      '/api/project-agent/relationship-graph',
      { params: { project_id } },
    ),

  /** 获取里程碑 */
  getMilestones: (project_id: string) =>
    api.get<any, { success: boolean; data: any[] }>(
      '/api/project-agent/summary/milestones',
      { params: { project_id } },
    ),

  /** 触发总结分析 */
  analyzeSummary: (data: { project_id: string }) =>
    api.post<any, { success: boolean; message: string }>(
      '/api/project-agent/summary/analyze', data,
    ),

  /** 触发项目全量分析（异步长程任务） */
  triggerFullAnalysis: (data: { project_id: string }) =>
    api.post<any, { success: boolean; message: string; task_id?: string }>(
      '/api/project-agent/summary/full-analysis', data,
    ),

  /** 获取全量分析任务状态 */
  getFullAnalysisStatus: (project_id: string) =>
    api.get<any, { success: boolean; data: any }>(
      '/api/project-agent/summary/full-analysis/status',
      { params: { project_id } },
    ),

  /** 获取全量分析报告，支持通过report_id获取指定报告 */
  getFullAnalysisReport: (project_id: string, report_id?: string) =>
    api.get<any, { success: boolean; data: any }>(
      '/api/project-agent/summary/full-analysis/report',
      { params: { project_id, ...(report_id ? { report_id } : {}) } },
    ),

  /** 获取全量分析报告列表，支持按project_id过滤 */
  listFullAnalysisReports: (project_id?: string) =>
    api.get<any, { success: boolean; data: any[] }>(
      '/api/project-agent/summary/full-analysis/list',
      { params: project_id ? { project_id } : undefined },
    ),

  // ─── LLM 驱动的关系图重建 + 里程碑 ───

  /** LLM驱动的关系图全局重建 */
  rebuildRelationshipGraph: (data: { project_id: string }) =>
    api.post<any, { success: boolean; message: string; data: any; has_uncertainties?: boolean }>(
      '/api/project-agent/summary/rebuild-graph', data,
    ),

  /** 获取LLM重建的关系图缓存 */
  getGraphCache: (project_id: string) =>
    api.get<any, { success: boolean; data: any; version?: string; source?: string }>(
      '/api/project-agent/summary/graph-cache',
      { params: { project_id } },
    ),

  /** 用户确认关系图中的歧义 */
  confirmAmbiguity: (data: { project_id: string; confirmation_id: string; answers: any[] }) =>
    api.post<any, { success: boolean; message: string; data: any }>(
      '/api/project-agent/summary/confirm-ambiguity', data,
    ),

  /** LLM驱动的里程碑自主生成 */
  generateMilestones: (data: { project_id: string }) =>
    api.post<any, { success: boolean; message: string; data: any[] }>(
      '/api/project-agent/summary/generate-milestones', data,
    ),

  /** 获取日报 */
  getDailyReport: (project_id: string, report_date?: string) =>
    api.get<any, any>('/api/project-agent/daily-report', {
      params: { project_id, report_date },
    }),

  /** 提交日报 */
  submitDailyReport: (data: { project_id: string; report_date: string }) =>
    api.post<any, any>('/api/project-agent/submit-daily-report', data),

  // ─── 周报 ───

  /** 生成并推送周报 */
  sendWeeklyReport: (project_id: string) =>
    api.post<any, { success: boolean; message: string; data?: any }>(
      `/api/project-agent/send-weekly-report?project_id=${project_id}`,
    ),

  /** 生成并推送月报 */
  sendMonthlyReport: (project_id: string) =>
    api.post<any, { success: boolean; message: string; data?: any }>(
      `/api/project-agent/send-monthly-report?project_id=${project_id}`,
    ),

  /** 生成并推送季报 */
  sendQuarterlyReport: (project_id: string) =>
    api.post<any, { success: boolean; message: string; data?: any }>(
      `/api/project-agent/send-quarterly-report?project_id=${project_id}`,
    ),

  /** 知识压缩（生成周报摘要+项目Skill） */
  compressKnowledge: (project_id: string) =>
    api.post<any, { success: boolean; message: string; data?: any }>(
      `/api/project-agent/compress-knowledge?project_id=${project_id}`,
    ),

  // ─── 文件上传 ───

  /**
   * 上传文件（存储到Supabase + 自动解析为笔记）
   * 后端自动解析PDF/Excel/Word/TXT/Image内容，生成LLM一句话摘要
   */
  uploadFile: (projectId: string, file: {
    uri: string;
    name: string;
    type: string;
  }) => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    return api.post<any, any>(
      `/api/project-agent/upload-file?project_id=${projectId}`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000, // 文件上传60秒超时
      },
    );
  },

  /**
   * 解析文件用于对话上下文（不存储）
   * 轻量级解析，用于用户在对话中引用文件内容
   */
  parseFileForChat: (projectId: string, file: {
    uri: string;
    name: string;
    type: string;
  }) => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    return api.post<any, any>(
      `/api/project-agent/parse-file-for-chat?project_id=${projectId}`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      },
    );
  },

  // ─── 流式对话 ───

  /**
   * 流式发送消息给AI智能体（SSE）
   *
   * 后端返回 text/event-stream，每个 delta 实时推送。
   * 前端通过 onDelta 回调逐字追加，天然"打字机"效果，零延迟。
   *
   * SSE 事件格式：
   *   data: {"type":"start","user_message_id":"xxx","assistant_message_id":"xxx"}
   *   data: {"type":"delta","content":"建筑"}
   *   data: {"type":"done","content":"完整回复",...}
   *   data: {"type":"error","message":"错误信息"}
   */
  processUserInputStream: async (
    data: {
      message: string;
      project_id: string;
      project_type: number;
      conversation_history?: any[];
      file_urls?: { name: string; url: string; type: string }[];
    },
    callbacks: {
      onStart?: (ids: { user_message_id: string; assistant_message_id: string }) => void;
      onDelta?: (delta: string) => void;
      onDone?: (result: { content: string; user_message_id: string; assistant_message_id: string; agent_b_triggered?: boolean; agent_c_triggered?: boolean }) => void;
      onError?: (error: string) => void;
      onGraphIncrement?: (data: any) => void;
      onFollowupCreated?: (data: any) => void;
      onNoteCreated?: (data: any) => void;
      onRecordFeedback?: (data: any) => void;
      onMilestoneCreated?: (data: any) => void;
      onWikiUpdated?: (data: any) => void;
    },
  ): Promise<void> => {
    const { useAuthStore } = require('@/stores');
    const { token, refreshToken, setTokens } = useAuthStore.getState();
    const API_BASE = API_CONFIG.BASE_URL;

    let completed = false;

    const refreshTokenAndRetry = async (): Promise<string | null> => {
      if (!refreshToken) return null;
      try {
        const axios = require('axios').default;
        const response = await axios.post(`${API_BASE}/api/auth/refresh-token`, {
          refresh_token: refreshToken,
        });
        if (response.data?.code === 200 && response.data?.result) {
          const { token: newToken, refresh_token: newRefreshToken, expires_at } = response.data.result;
          setTokens(newToken, newRefreshToken, expires_at);
          return newToken;
        }
      } catch (e) {
        console.log('[SSE] Token刷新失败:', e);
      }
      return null;
    };

    console.log('[SSE] 开始连接:', `${API_BASE}/api/project-agent/process-user-input-stream`);
    console.log('[SSE] 请求数据:', JSON.stringify(data).substring(0, 200));

    const es = new EventSource(`${API_BASE}/api/project-agent/process-user-input-stream`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      method: 'POST',
      body: JSON.stringify(data),
      pollingInterval: 86400000,
    });

    es.addEventListener('open', () => {
      console.log('[SSE] 连接已建立 (open event)');
    });

    es.addEventListener('message', (event) => {
      if (!event.data) {
        console.log('[SSE] message event: data 为空');
        return;
      }
      const jsonStr = event.data;
      console.log('[SSE] message event:', jsonStr.substring(0, 150));
      if (jsonStr === '[DONE]') {
        completed = true;
        console.log('[SSE] 收到 [DONE]，关闭连接');
        es.close();
        return;
      }

      try {
        const parsed = JSON.parse(jsonStr);

        switch (parsed.type) {
          case 'start':
            console.log('[SSE] start 事件:', parsed.user_message_id, parsed.assistant_message_id);
            callbacks.onStart?.({
              user_message_id: parsed.user_message_id,
              assistant_message_id: parsed.assistant_message_id,
            });
            break;
          case 'delta':
            if (parsed.content) callbacks.onDelta?.(parsed.content);
            break;
          case 'done':
            completed = true;
            console.log('[SSE] done 事件, 内容长度:', parsed.content?.length);
            callbacks.onDone?.({
              content: parsed.content,
              user_message_id: parsed.user_message_id,
              assistant_message_id: parsed.assistant_message_id,
              agent_b_triggered: parsed.agent_b_triggered,
              agent_c_triggered: parsed.agent_c_triggered,
            });
            es.close();
            break;
          case 'error':
            completed = true;
            console.log('[SSE] 服务端 error 事件:', parsed.message);
            callbacks.onError?.(parsed.message || '未知错误');
            es.close();
            break;
          case 'graph_increment':
            callbacks.onGraphIncrement?.(parsed);
            break;
          case 'followup_created':
            callbacks.onFollowupCreated?.(parsed);
            break;
          case 'note_created':
            callbacks.onNoteCreated?.(parsed);
            break;
          case 'record_feedback':
            callbacks.onRecordFeedback?.(parsed);
            break;
          case 'milestone_created':
            callbacks.onMilestoneCreated?.(parsed);
            break;
          case 'wiki_updated':
            callbacks.onWikiUpdated?.(parsed);
            break;
          default:
            console.log('[SSE] 未知 type:', parsed.type);
        }
      } catch (e) {
        console.log('[SSE] JSON 解析失败:', jsonStr.substring(0, 100));
      }
    });

    es.addEventListener('error', async (event: any) => {
      console.log('[SSE] error 事件触发, completed=', completed, 'event=', JSON.stringify(event?.message || ''), 'xhrStatus=', event?.xhrStatus, 'readyState=', event?.xhr?.readyState, 'status=', event?.xhr?.status);
      if (completed) return;
      completed = true;

      const xhrStatus = event?.xhrStatus || 0;
      const errMsg = event?.message || '';
      if (xhrStatus === 401 || xhrStatus === 403 || errMsg.includes('Unauthorized') || errMsg.includes('Forbidden')) {
        const newToken = await refreshTokenAndRetry();
        if (newToken) {
          callbacks.onError?.('TOKEN_REFRESHED:请重试');
        } else {
          callbacks.onError?.(`AUTH_EXPIRED:${errMsg || xhrStatus}`);
        }
      } else {
        callbacks.onError?.(errMsg || '网络异常，请检查网络后重试');
      }
      es.close();
    });
  },
};
