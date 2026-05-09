import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BidStatus } from '@/services/bidWriter';
import { GlassSidebar } from '@/components/common';

type TabType = 'draft' | 'bid';

export type MyBidsListItem = {
  id: string;
  title: string;
  status: BidStatus;
  created_at: string;
  updated_at: string;
  total_word_count: number;
};

const getStatusLabel = (status: BidStatus): { text: string; color: string } => {
  switch (status) {
    case 'parsing': return { text: '解析中', color: '#FF9800' };
    case 'parsed': return { text: '已解析', color: '#4CAF50' };
    case 'generating_outline': return { text: '生成大纲', color: '#FF9800' };
    case 'outline_editing': return { text: '大纲编辑', color: '#2196F3' };
    case 'outline_confirmed': return { text: '大纲确认', color: '#4CAF50' };
    case 'generating': return { text: '编写中', color: '#FF9800' };
    case 'reviewing': return { text: '审阅中', color: '#FF9800' };
    case 'completed': return { text: '已完成', color: '#4CAF50' };
    case 'exported': return { text: '已导出', color: '#4CAF50' };
    default: return { text: '草稿', color: '#999' };
  }
};

interface MyBidsSidebarProps {
  visible: boolean;
  loading: boolean;
  draftBids: MyBidsListItem[];
  bidBids: MyBidsListItem[];
  onClose: () => void;
  onSelect: (bid: MyBidsListItem) => void;
  theme?: 'day' | 'night';
}

export const MyBidsSidebar: FC<MyBidsSidebarProps> = ({
  visible,
  loading,
  draftBids,
  bidBids,
  onClose,
  onSelect,
  theme = 'day',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('draft');

  useEffect(() => {
    if (visible) {
      setActiveTab('draft');
    }
  }, [visible]);

  const listData = useMemo(() => {
    return activeTab === 'draft' ? draftBids : bidBids;
  }, [activeTab, draftBids, bidBids]);

  return (
    <GlassSidebar
      visible={visible}
      onClose={onClose}
      title="我的标书"
      theme={theme}
    >
      <View style={styles.contentContainer}>

          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'draft' && styles.tabActive]}
              onPress={() => setActiveTab('draft')}
            >
              <Text style={[styles.tabText, activeTab === 'draft' && styles.tabTextActive]}>草稿</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'bid' && styles.tabActive]}
              onPress={() => setActiveTab('bid')}
            >
              <Text style={[styles.tabText, activeTab === 'bid' && styles.tabTextActive]}>标书</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#B20000" />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : listData.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>暂无记录</Text>
            </View>
          ) : (
            <FlatList
              data={listData}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isDraft = activeTab === 'draft';
                const sl = getStatusLabel(item.status);
                return (
                  <View style={styles.item}>
                    <View style={styles.itemLeft}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.title || '未命名标书'}
                      </Text>
                      <View style={styles.itemMetaRow}>
                        <View style={[styles.statusBadge, { backgroundColor: sl.color + '22' }]}>
                          <Text style={[styles.statusText, { color: sl.color }]}>{sl.text}</Text>
                        </View>
                        <Text style={styles.itemMetaText} numberOfLines={1}>
                          {item.updated_at ? item.updated_at.slice(0, 10) : ''}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.actionBtn, isDraft ? styles.actionBtnDraft : styles.actionBtnBid]}
                      activeOpacity={0.7}
                      onPress={() => onSelect(item)}
                    >
                      <Text style={[styles.actionBtnText, isDraft ? styles.actionBtnTextDraft : styles.actionBtnTextBid]}>
                        {isDraft ? '继续' : '查看'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              }}
              showsVerticalScrollIndicator={false}
            />
          )}
      </View>
    </GlassSidebar>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    paddingTop: 10,
    flex: 1,
  },
  headerBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnText: {
    color: '#1A1A2E',
    fontSize: 18,
    fontWeight: '600',
  },
  headerBtnTextDisabled: {
    opacity: 0.4,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#000000',
  },
  tabText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#6B7280',
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
    color: '#9CA3AF',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 18,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  itemLeft: {
    flex: 1,
    marginRight: 10,
  },
  itemTitle: {
    color: '#1A1A2E',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  itemMetaText: {
    color: '#9CA3AF',
    fontSize: 11,
    flexShrink: 1,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnDraft: {
    backgroundColor: '#B20000',
  },
  actionBtnBid: {
    backgroundColor: '#F3F4F6',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtnTextDraft: {
    color: '#fff',
  },
  actionBtnTextBid: {
    color: '#1A1A2E',
  },
});

export default MyBidsSidebar;
