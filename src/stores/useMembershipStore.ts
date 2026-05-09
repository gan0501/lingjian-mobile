import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import { API_CONFIG } from '@/constants/config';

const storage = new MMKV({ id: 'membership-storage' });

const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

export type MemberLevel = 1 | 2 | 3 | 4;

export type MemberStatus = 'none' | 'active' | 'expired';

export interface MembershipInfo {
  level: MemberLevel;
  status: MemberStatus;
  expiredAt?: string;
  plan?: 'trial' | 'month' | 'quarter' | 'year';
  trialUsed?: boolean;
  balance?: number;
}

export const MEMBER_NAMES: Record<MemberLevel, string> = {
  1: '普通用户',
  2: 'Plus会员',
  3: 'Pro会员',
  4: 'Max会员',
};

export const MEMBER_PRICES: Record<MemberLevel, { month?: number; quarter?: number; year?: number }> = {
  1: {},
  2: { month: 18, quarter: 48.8, year: 168 },
  3: { year: 0 },
  4: { year: 0 },
};

export const MEMBER_LIMITS: Record<MemberLevel, {
  maxFollowProjects: number;
  canCollaborate: boolean;
  canUseAI: boolean;
  canEnterpriseShow: boolean;
  canWorkbench: boolean;
}> = {
  1: { maxFollowProjects: 5, canCollaborate: false, canUseAI: false, canEnterpriseShow: false, canWorkbench: false },
  2: { maxFollowProjects: Infinity, canCollaborate: true, canUseAI: true, canEnterpriseShow: false, canWorkbench: false },
  3: { maxFollowProjects: Infinity, canCollaborate: true, canUseAI: true, canEnterpriseShow: true, canWorkbench: false },
  4: { maxFollowProjects: Infinity, canCollaborate: true, canUseAI: true, canEnterpriseShow: true, canWorkbench: true },
};

interface MembershipState {
  membership: MembershipInfo;
  followedProjectIds: string[];

  setMembership: (info: MembershipInfo) => void;
  fetchMembership: (token: string) => Promise<void>;
  addFollowedProject: (projectId: string) => boolean;
  removeFollowedProject: (projectId: string) => void;
  isProjectFollowed: (projectId: string) => boolean;
  canFollowMore: () => boolean;
  getLimits: () => typeof MEMBER_LIMITS[MemberLevel];
  isMember: () => boolean;
  isExpired: () => boolean;
  getMemberName: () => string;
}

export const useMembershipStore = create<MembershipState>()(
  persist(
    (set, get) => ({
      membership: { level: 1, status: 'none' },
      followedProjectIds: [],

      setMembership: (info) => set({ membership: info }),

      fetchMembership: async (token: string) => {
        try {
          const response = await fetch(`${API_CONFIG.BASE_URL}/api/membership/status`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await response.json();
          
          if (json.success && json.data) {
            const { membershipType, membershipEndDate, isActive, trialUsed, balance } = json.data;
            const level = (membershipType || 1) as MemberLevel;
            const status: MemberStatus = isActive ? 'active' : (membershipType > 1 ? 'expired' : 'none');
            
            set({
              membership: {
                level,
                status,
                expiredAt: membershipEndDate,
                trialUsed: !!trialUsed,
                balance: typeof balance === 'number' ? balance : undefined,
              },
            });
          }
        } catch (error) {
          console.error('[MembershipStore] fetchMembership error:', error);
        }
      },

      addFollowedProject: (projectId) => {
        const { followedProjectIds, membership } = get();
        if (followedProjectIds.includes(projectId)) return true;
        
        const limits = MEMBER_LIMITS[membership.level];
        if (followedProjectIds.length >= limits.maxFollowProjects) {
          return false;
        }
        
        set({ followedProjectIds: [...followedProjectIds, projectId] });
        return true;
      },

      removeFollowedProject: (projectId) => {
        const { followedProjectIds } = get();
        set({ followedProjectIds: followedProjectIds.filter(id => id !== projectId) });
      },

      isProjectFollowed: (projectId) => get().followedProjectIds.includes(projectId),

      canFollowMore: () => {
        const { membership, followedProjectIds } = get();
        const limits = MEMBER_LIMITS[membership.level];
        return followedProjectIds.length < limits.maxFollowProjects;
      },

      getLimits: () => {
        const { membership } = get();
        return MEMBER_LIMITS[membership.level];
      },

      isMember: () => get().membership.status === 'active',

      isExpired: () => get().membership.status === 'expired',

      getMemberName: () => {
        const { membership } = get();
        return MEMBER_NAMES[membership.level];
      },
    }),
    {
      name: 'membership-store',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        membership: state.membership,
        followedProjectIds: state.followedProjectIds,
      }),
    }
  )
);
