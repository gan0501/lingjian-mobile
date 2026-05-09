/**
 * 跟进项目缓存 Store (V2)
 *
 * 缓存用户所有跟进项目，确保地图中始终显示旗帜标记。
 * 支持 MMKV 持久化 + 5分钟缓存策略 + 并发请求锁。
 */
import { create } from 'zustand';
import { projectApi } from '@/services/projectService';
import { useAuthStore } from './useAuthStore';
import { MMKV } from 'react-native-mmkv';

// ─── 类型 ───

export interface FollowedProject {
  id: string | number;
  external_project_id?: string;
  project_id?: string;
  project_name?: string;
  project_type?: string;
  type?: number;
  section?: number;
  follow_status?: string;
  status?: string;
  lat?: number;
  lng?: number;
  created_at?: string;
  updated_at?: string;
  project_category?: 'followed' | 'collaborated';
  // 可扩展的详细字段
  [key: string]: any;
}

interface FollowedProjectState {
  followedProjects: FollowedProject[];
  lastUpdateTime: number;
  isLoading: boolean;

  getFollowedProjects: () => FollowedProject[];
  getCount: () => number;
  isCacheValid: () => boolean;
  loadFollowedProjects: (forceRefresh?: boolean) => Promise<FollowedProject[]>;
  refresh: () => Promise<FollowedProject[]>;
  clear: () => void;
  addProject: (project: FollowedProject) => void;
  removeProject: (projectId: string) => void;
}

// ─── 持久化 ───

const storage = new MMKV({ id: 'followed-projects-cache' });
const CACHE_KEY = 'followed_projects';
const CACHE_TIME_KEY = 'followed_projects_time';
const CACHE_VALIDITY = 5 * 60 * 1000; // 5分钟

let loadingPromise: Promise<FollowedProject[]> | null = null;

const loadPersistedCache = (): { projects: FollowedProject[]; time: number } => {
  try {
    const data = storage.getString(CACHE_KEY);
    const time = storage.getNumber(CACHE_TIME_KEY) || 0;
    if (data) return { projects: JSON.parse(data), time };
  } catch (e) { /* ignore */ }
  return { projects: [], time: 0 };
};

const savePersistedCache = (projects: FollowedProject[], time: number) => {
  try {
    storage.set(CACHE_KEY, JSON.stringify(projects));
    storage.set(CACHE_TIME_KEY, time);
  } catch (e) { /* ignore */ }
};

// ─── Store ───

const initialCache = loadPersistedCache();

export const useFollowedProjectStore = create<FollowedProjectState>((set, get) => ({
  followedProjects: initialCache.projects,
  lastUpdateTime: initialCache.time,
  isLoading: false,

  getFollowedProjects: () => {
    const { isLoggedIn } = useAuthStore.getState();
    if (!isLoggedIn) return [];
    return get().followedProjects;
  },

  getCount: () => {
    const { isLoggedIn } = useAuthStore.getState();
    if (!isLoggedIn) return 0;
    return get().followedProjects.length;
  },

  isCacheValid: () => {
    const state = get();
    if (!state.followedProjects.length) return false;
    return (Date.now() - state.lastUpdateTime) < CACHE_VALIDITY;
  },

  loadFollowedProjects: async (forceRefresh = false) => {
    const state = get();
    const { isLoggedIn } = useAuthStore.getState();

    if (!isLoggedIn) {
      if (state.followedProjects.length > 0) {
        set({ followedProjects: [], lastUpdateTime: 0 });
        savePersistedCache([], 0);
      }
      return [];
    }

    // 缓存有效 & 非强制刷新
    if (!forceRefresh && state.isCacheValid()) {
      return state.followedProjects;
    }

    // 并发请求锁
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      set({ isLoading: true });
      try {
        const result = await projectApi.getAllFollowedProjects();
        if (Array.isArray(result)) {
          const now = Date.now();
          set({ followedProjects: result, lastUpdateTime: now });
          savePersistedCache(result, now);
          return result;
        }
        return get().followedProjects;
      } catch (error) {
        return get().followedProjects;
      } finally {
        set({ isLoading: false });
        loadingPromise = null;
      }
    })();

    return loadingPromise;
  },

  refresh: async () => get().loadFollowedProjects(true),

  clear: () => {
    set({ followedProjects: [], lastUpdateTime: 0 });
    try {
      storage.delete(CACHE_KEY);
      storage.delete(CACHE_TIME_KEY);
    } catch (e) { /* ignore */ }
  },

  addProject: (project) => {
    const state = get();
    const exists = state.followedProjects.some(p =>
      String(p.id) === String(project.id) ||
      String(p.project_id) === String(project.project_id),
    );
    if (!exists) {
      const newProjects = [...state.followedProjects, project];
      const now = Date.now();
      set({ followedProjects: newProjects, lastUpdateTime: now });
      savePersistedCache(newProjects, now);
    }
  },

  removeProject: (projectId) => {
    const state = get();
    const newProjects = state.followedProjects.filter(p =>
      String(p.id) !== projectId && String(p.project_id) !== projectId,
    );
    if (newProjects.length !== state.followedProjects.length) {
      const now = Date.now();
      set({ followedProjects: newProjects, lastUpdateTime: now });
      savePersistedCache(newProjects, now);
    }
  },
}));
