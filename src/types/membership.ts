export type MembershipStatus = 'active' | 'expired' | 'none';

export interface MembershipInfo {
  status: MembershipStatus;
  expiredAt?: string;
  startedAt?: string;
  autoRenew?: boolean;
}

export interface UserQuota {
  maxFollowProjects: number;
  usedFollowProjects: number;
  canCollaborate: boolean;
  hasAIFeatures: boolean;
}

export const NON_MEMBER_LIMITS = {
  maxFollowProjects: 6,
  canCollaborate: false,
  hasAIFeatures: false,
} as const;

export const MEMBER_BENEFITS = {
  maxFollowProjects: Infinity,
  canCollaborate: true,
  hasAIFeatures: true,
} as const;

export type MembershipPlan = 'monthly' | 'quarterly' | 'yearly';

export const MEMBERSHIP_PLANS = {
  monthly: {
    id: 'monthly',
    name: '月度会员',
    price: 18.8,
    originalPrice: 18.8,
    duration: 1,
    durationUnit: 'month',
    badge: '',
    popular: false,
  },
  quarterly: {
    id: 'quarterly',
    name: '季度会员',
    price: 48.8,
    originalPrice: 56.4,
    duration: 3,
    durationUnit: 'month',
    badge: '省7.6元',
    popular: true,
  },
  yearly: {
    id: 'yearly',
    name: '年度会员',
    price: 168.8,
    originalPrice: 225.6,
    duration: 12,
    durationUnit: 'month',
    badge: '省56.8元',
    popular: false,
  },
} as const;

export type PaymentMethod = 'alipay' | 'wechat';

export interface PaymentRequest {
  method: PaymentMethod;
  amount: number;
  plan: MembershipPlan;
}

export interface PaymentResult {
  success: boolean;
  orderId?: string;
  expiredAt?: string;
  error?: string;
}

export const MEMBERSHIP_EXPIRED_MESSAGE = {
  title: '会员已过期',
  description: '若需要继续使用AI辅助、数据分析、决策支持等功能，请点击续费',
  buttonText: '点击续费',
};

export const canFollowNewProject = (quota: UserQuota): boolean => {
  return quota.usedFollowProjects < quota.maxFollowProjects;
};

export const canUseAIFeatures = (membership: MembershipInfo): boolean => {
  return membership.status === 'active';
};

export const getRemainingFollowSlots = (quota: UserQuota): number => {
  if (quota.maxFollowProjects === Infinity) return Infinity;
  return Math.max(0, quota.maxFollowProjects - quota.usedFollowProjects);
};
