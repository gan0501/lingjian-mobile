import { create } from 'zustand';
import api from '@/services/api';
import AppBadge from 'react-native-app-badge';

const updateAppBadge = (count: number) => {
  try {
    AppBadge.setCount(Math.max(0, count));
  } catch (e) {
    console.warn('[useMessageStore] 更新桌面角标失败:', e);
  }
};

interface Message {
  id: string;
  title: string;
  content: string;
  time: string;
  unread: boolean;
  category: 'system' | 'activity' | 'im' | 'member' | 'quota_reward';
  message_type?: number;
  status?: number;
  sender?: {
    id: number;
    name: string;
    avatar: string | null;
    phone_number: string | null;
  } | null;
}

interface MessageState {
  messages: Message[];
  loading: boolean;
  unreadCount: number;

  setMessages: (messages: Message[]) => void;
  fetchMessages: (force?: boolean) => Promise<void>;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearMessages: () => void;
  addLocalMessage: (message: { title: string; content: string; category: Message['category'] }) => void;
  respondToInvite: (messageId: string, action: 'accept' | 'reject') => Promise<boolean>;
}

const CATEGORY_MAP: Record<number, Message['category']> = {
  1: 'system',
  2: 'member',
  3: 'activity',
  4: 'activity',
  5: 'quota_reward',
};

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: [],
  loading: false,
  unreadCount: 0,

  setMessages: (messages) => {
    const unreadCount = messages.filter(m => m.unread).length;
    updateAppBadge(unreadCount);
    set({ messages, unreadCount });
  },

  fetchMessages: async (force = false) => {
    const { loading } = get();
    if (loading) return;

    set({ loading: true });

    try {
      const res: any = await api.get('/api/user/messages', {
        params: { page: 1, page_size: 50 },
      });

      const serverList = Array.isArray(res?.list) ? res.list : [];
      const formatDate = (raw: string): string => {
        if (!raw) return '';
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
        const y = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        const s = String(d.getSeconds()).padStart(2, '0');
        return `${y}-${mo}-${da} ${h}:${mi}:${s}`;
      };

      const serverMessages: Message[] = serverList.map((m: any) => ({
        id: String(m.id),
        title: m.title || '',
        content: m.content || '',
        time: formatDate(m.created_at),
        unread: !m.is_read,
        category: CATEGORY_MAP[m.message_type] || 'system',
        message_type: m.message_type,
        status: m.status,
        sender: m.sender || null,
      }));

      const { messages: currentMessages } = get();
      const localOnlyMessages = currentMessages.filter(
        (lm) => lm.id.startsWith('local_') && !serverMessages.some((sm) => sm.title === lm.title && sm.content === lm.content),
      );

      const merged = [...localOnlyMessages, ...serverMessages];
      const unreadCount = merged.filter(m => m.unread).length;
      updateAppBadge(unreadCount);
      set({ messages: merged, unreadCount, loading: false });
    } catch (error) {
      set({ loading: false });
    }
  },

  markAsRead: (id) => {
    const messages = get().messages.map(m =>
      m.id === id ? { ...m, unread: false } : m
    );
    const unreadCount = messages.filter(m => m.unread).length;
    updateAppBadge(unreadCount);
    set({ messages, unreadCount });

    if (!id.startsWith('local_')) {
      api.put(`/api/user/messages/${id}/read`).catch(() => {});
    }
  },

  markAllAsRead: () => {
    const messages = get().messages.map(m => ({ ...m, unread: false }));
    updateAppBadge(0);
    set({ messages, unreadCount: 0 });

    api.put('/api/user/messages/read-all').catch(() => {});
  },

  clearMessages: () => {
    updateAppBadge(0);
    set({ messages: [], unreadCount: 0 });
  },

  addLocalMessage: (message) => {
    const newMessage: Message = {
      id: `local_${Date.now()}`,
      title: message.title,
      content: message.content,
      time: '刚刚',
      unread: true,
      category: message.category,
    };
    const messages = [newMessage, ...get().messages];
    const unreadCount = messages.filter(m => m.unread).length;
    updateAppBadge(unreadCount);
    set({ messages, unreadCount });
  },

  respondToInvite: async (messageId, action) => {
    try {
      await api.post('/api/user/messages/respond-invite', { message_id: Number(messageId), action });

      const statusMap: Record<string, number> = { accept: 1, reject: 2 };
      const messages = get().messages.map(m =>
        m.id === messageId ? { ...m, status: statusMap[action] ?? m.status } : m
      );
      set({ messages });

      if (action === 'accept') {
        try {
          const { useFollowedProjectStore } = require('./useFollowedProjectStore');
          useFollowedProjectStore.getState().refresh();
        } catch (e) {
          console.warn('[MessageStore] 刷新项目列表失败:', e);
        }
      }

      return true;
    } catch {
      return false;
    }
  },
}));

export type { Message };
