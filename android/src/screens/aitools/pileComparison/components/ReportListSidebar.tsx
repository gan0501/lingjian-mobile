import React, { FC, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Pressable,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassSidebar } from '@/components/common';
import { Trash2 } from 'lucide-react-native';

export type ReportListItem = {
  id: string;
  title: string;
  status: 'generating' | 'done' | 'failed';
  created_at: string;
  updated_at: string;
  error?: string;
  markdown?: string;
};

interface ReportListSidebarProps {
  visible: boolean;
  loading?: boolean;
  items: ReportListItem[];
  onClose: () => void;
  onSelect: (item: ReportListItem) => void;
  onDelete?: (item: ReportListItem) => void;
}

export const ReportListSidebar: FC<ReportListSidebarProps> = ({
  visible,
  loading = false,
  items,
  onClose,
  onSelect,
  onDelete,
}) => {

  const formatLocalDateTime = (raw: string) => {
    const s = String(raw || '').trim();
    if (!s) return '';
    const d = new Date(s);
    const t = d.getTime();
    if (!Number.isFinite(t)) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  };

  const data = useMemo(() => {
    const rows = Array.isArray(items) ? items : [];
    return [...rows].sort((a, b) => {
      const ta = new Date(a.updated_at || a.created_at || 0).getTime();
      const tb = new Date(b.updated_at || b.created_at || 0).getTime();
      return tb - ta;
    });
  }, [items]);

  return (
    <GlassSidebar
      visible={visible}
      onClose={onClose}
      title="对比报告"
      theme="day"
    >

          {loading ? (
            <View style={styles.loadingWrap}>
              <Loading size="large" color="#fff" />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : data.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>暂无对比报告</Text>
            </View>
          ) : (
            <FlatList
              data={data}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const statusText =
                  item.status === 'generating' ? '生成中' : item.status === 'failed' ? '失败' : '已完成';
                const statusColor =
                  item.status === 'generating'
                    ? '#F59E0B'
                    : item.status === 'failed'
                      ? '#EF4444'
                      : '#10B981';

                const handleDelete = () => {
                  if (!onDelete) return;
                  Alert.alert(
                    '确认删除',
                    `确定要删除报告"${item.title || '未命名'}"吗？`,
                    [
                      { text: '取消', style: 'cancel' },
                      { text: '删除', style: 'destructive', onPress: () => onDelete(item) },
                    ]
                  );
                };

                return (
                  <TouchableOpacity
                    style={styles.item}
                    activeOpacity={0.8}
                    onPress={() => onSelect(item)}
                  >
                    <View style={styles.itemRowTop}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.title || '未命名对比报告'}
                      </Text>
                      <View style={styles.itemRight}>
                        <Text style={[styles.itemStatus, { color: statusColor }]}>{statusText}</Text>
                        {item.status === 'failed' && onDelete && (
                          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                            <Trash2 size={16} color="#FF6B6B" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <View style={styles.itemMetaRow}>
                      <Text style={styles.itemMetaText} numberOfLines={1}>
                        {formatLocalDateTime(item.updated_at || item.created_at)}
                      </Text>
                      {item.status === 'failed' ? (
                        <Text style={[styles.itemMetaText, styles.itemMetaError]} numberOfLines={1}>
                          {item.error || '生成失败'}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
              showsVerticalScrollIndicator={false}
            />
      )}
    </GlassSidebar>
  );
};

const styles = StyleSheet.create({
  headerBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerBtnTextDisabled: {
    opacity: 0.4,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
    marginTop: 12,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 18,
  },
  item: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  itemRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  itemTitle: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    marginRight: 10,
  },
  itemStatus: {
    fontSize: 12,
    fontWeight: '700',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.15)',
    borderRadius: 14,
  },
  itemMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  itemMetaText: {
    color: '#6B7280',
    fontSize: 12,
    flexShrink: 1,
  },
  itemMetaError: {
    color: 'rgba(255,107,107,0.9)',
  },
});

export default ReportListSidebar;
