import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();
const HISTORY_KEY = 'resource_browsing_history';
const MAX_HISTORY_ITEMS = 20;

export interface BrowsingHistoryItem {
  id: number;
  type: 'norm' | 'atlas' | 'material';
  title: string;
  code?: string;
  timestamp: number;
}

export const addBrowsingHistory = (item: Omit<BrowsingHistoryItem, 'timestamp'>) => {
  try {
    const history = getBrowsingHistory();
    const filteredHistory = history.filter(h => !(h.id === item.id && h.type === item.type));
    const newHistory = [{ ...item, timestamp: Date.now() }, ...filteredHistory].slice(0, MAX_HISTORY_ITEMS);
    storage.set(HISTORY_KEY, JSON.stringify(newHistory));
  } catch (error) {
    console.error('保存浏览历史失败:', error);
  }
};

export const getBrowsingHistory = (): BrowsingHistoryItem[] => {
  try {
    const historyStr = storage.getString(HISTORY_KEY);
    if (historyStr) return JSON.parse(historyStr);
    return [];
  } catch (error) {
    console.error('获取浏览历史失败:', error);
    return [];
  }
};

export const getRecentHistory = (limit: number = 5): BrowsingHistoryItem[] => {
  return getBrowsingHistory().slice(0, limit);
};

export const clearBrowsingHistory = () => {
  try { storage.delete(HISTORY_KEY); } catch (error) { console.error('清空浏览历史失败:', error); }
};

export const formatTimeAgo = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
};
