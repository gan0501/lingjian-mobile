import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { useMessageStore } from '@/stores';
import type { Message } from '@/stores';

const STALE_TIME = 10 * 1000;

const fetchMessagesFromApi = async (): Promise<Message[]> => {
  const res: any = await api.get('/api/user/messages', {
    params: { page: 1, page_size: 50 },
  });

  const categoryMap: Record<number, Message['category']> = {
    1: 'system',
    2: 'member',
    3: 'activity',
    4: 'activity',
    5: 'quota_reward',
  };

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

  const list = Array.isArray(res?.list) ? res.list : [];
  return list.map((m: any) => ({
    id: String(m.id),
    title: m.title || '',
    content: m.content || '',
    time: formatDate(m.created_at),
    unread: !m.is_read,
    category: categoryMap[m.message_type] || 'system',
    message_type: m.message_type,
    status: m.status,
    sender: m.sender || null,
  }));
};

export const useMessages = () => {
  const { setMessages } = useMessageStore.getState();

  return useQuery({
    queryKey: ['messages'],
    queryFn: async () => {
      const messages = await fetchMessagesFromApi();
      setMessages(messages);
      return messages;
    },
    staleTime: STALE_TIME,
  });
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();
  const { markAsRead } = useMessageStore.getState();

  return useMutation({
    mutationFn: async (messageId: string) => {
      if (!messageId.startsWith('local_')) {
        await api.put(`/api/user/messages/${messageId}/read`);
      }
      return messageId;
    },
    onSuccess: (messageId) => {
      markAsRead(messageId);
      queryClient.setQueryData<Message[]>(['messages'], (old) => {
        if (!old) return old;
        return old.map((m) => m.id === messageId ? { ...m, unread: false } : m);
      });
    },
  });
};
