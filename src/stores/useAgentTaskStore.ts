/**
 * 智能体任务全局状态 Store (Zustand)
 *
 * 设计理念（从V1迁移）：
 * - 不维护 WebSocket 连接（节约服务器资源）
 * - 不做定时轮询（节约客户端资源）
 * - 只在关键时刻 fetch 一次（进入视窗、重进页面、App 回前台）
 * - 通过 DB 状态驱动机器人动画 + 前台通知
 */
import { create } from 'zustand';
import api from '@/services/api';
import { AGENT_REGISTRY, getAgentName } from '@/constants/agentConfig';

export type AgentStatus = 'idle' | 'working';

export type AgentTypeConfig = {
  name: string;
  icon: string;
  color: string;
  navRoute: string;
  createRoute: string;
};

export const AGENT_TYPE_MAP: Record<string, AgentTypeConfig> = Object.fromEntries(
  Object.entries(AGENT_REGISTRY).map(([key, cfg]) => [
    key,
    { name: cfg.name, icon: cfg.icon, color: cfg.color, navRoute: cfg.navRoute, createRoute: cfg.createRoute },
  ]),
);

// ── 统一状态分类 ──
export const WORKING_STATUSES = new Set([
  'generating', 'generating_content', 'generating_outline',
  'outline_editing', 'outline_confirmed',
  'parsing', 'running', 'pending', 'working',
  'reviewing', 'exporting', 'paused',
]);

export const FAILED_STATUSES = new Set([
  'failed', 'cancelled', 'timeout', 'error',
]);

export interface AgentTaskInfo {
  id: string;
  agent_type: string;
  name: string;
  role: string;
  status: AgentStatus;
  task: string;
  task_id: string;
  icon: string;
  color: string;
  completed_count: number;
  total_tokens: number;
  token_cost: number;
  value_per_task: number;
  progress?: number;
}

interface AgentTaskState {
  agents: AgentTaskInfo[];
  lastFetchedAt: number;
  loading: boolean;

  /** 拉取一次最新状态（5 秒内去重） */
  fetchLiveStatus: (force?: boolean) => Promise<void>;

  /** 标记某个智能体为 working（页面内发起任务时调用） */
  markWorking: (agentType: string, task: string, taskId?: string) => void;

  /** 标记某个智能体为 idle（任务完成/失败时调用） */
  markIdle: (agentType: string) => void;

  /** 获取指定智能体状态 */
  getAgent: (agentType: string) => AgentTaskInfo | undefined;
}

const DEBOUNCE_MS = 5000;

export const useAgentTaskStore = create<AgentTaskState>((set, get) => ({
  agents: [],
  lastFetchedAt: 0,
  loading: false,

  fetchLiveStatus: async (force = false) => {
    const now = Date.now();
    const { lastFetchedAt, loading } = get();
    if (loading || (!force && now - lastFetchedAt < DEBOUNCE_MS)) return;

    set({ loading: true });
    try {
      const res: any = await api.get('/api/agent-tasks/live-status');
      const data = res?.data ?? res;
      if (data?.success !== false && Array.isArray(data)) {
        set({ agents: data, lastFetchedAt: Date.now() });
      } else if (Array.isArray(data?.data)) {
        set({ agents: data.data, lastFetchedAt: Date.now() });
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('[AgentTaskStore] fetchLiveStatus failed:', err);
      }
    } finally {
      set({ loading: false });
    }
  },

  markWorking: (agentType, task, taskId) => {
    set(state => {
      const existing = state.agents.find(a => a.agent_type === agentType);
      if (existing) {
        return {
          agents: state.agents.map(a =>
            a.agent_type === agentType
              ? { ...a, status: 'working' as const, task, task_id: taskId || a.task_id }
              : a,
          ),
        };
      }
      const config = AGENT_TYPE_MAP[agentType];
      const newAgent: AgentTaskInfo = {
        id: agentType,
        agent_type: agentType,
        name: config?.name || agentType,
        role: config?.icon || '🤖',
        status: 'working' as const,
        task,
        task_id: taskId || '',
        icon: config?.icon || '🤖',
        color: config?.color || '#888888',
        completed_count: 0,
        total_tokens: 0,
        token_cost: 0,
        value_per_task: 0,
      };
      return { agents: [...state.agents, newAgent] };
    });
  },

  markIdle: (agentType) => {
    set(state => ({
      agents: state.agents.map(a =>
        a.agent_type === agentType
          ? { ...a, status: 'idle' as const, task: '', task_id: '' }
          : a,
      ),
    }));
  },

  getAgent: (agentType) => {
    return get().agents.find(a => a.agent_type === agentType);
  },
}));
