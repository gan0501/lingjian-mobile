/**
 * FollowupTab V2 - 跟进Tab
 *
 * 功能：
 * - 时间线布局（左侧日期线 + 右侧卡片）
 * - 初次跟进默认卡片（始终在最前面）
 * - 待确认/已确认记录分区
 * - 确认/编辑/删除操作
 * - 下拉刷新
 * - 手动新增跟进
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  CheckCircle2,
  Clock,
  Pencil,
  Trash2,
  AlertCircle,
  ClipboardList,
  Target,
} from 'lucide-react-native';
import { DayColors } from '@/constants';
import { projectAgentApi } from '@/services';
import { useOverlay } from '@/components/overlay';

interface FollowupTabProps {
  projectId: string;
  onRefreshRef: React.MutableRefObject<(() => void) | null>;
}

const FollowupTab: React.FC<FollowupTabProps> = ({ projectId, onRefreshRef }) => {
  const overlay = useOverlay();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingNodes, setPendingNodes] = useState<any[]>([]);
  const [confirmedRecords, setConfirmedRecords] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [initialTime, setInitialTime] = useState<string>(new Date().toISOString());

  const loadFollowups = useCallback(async () => {
    try {
      const res = await projectAgentApi.getFollowups(projectId);
      if (res?.data) {
        const pending = res.data.pending_nodes || [];
        const confirmed = res.data.confirmed_records || [];
        setPendingNodes(pending);
        setConfirmedRecords(confirmed);

        const allTimestamps: string[] = [];
        pending.forEach((n: any) => { if (n.created_at) allTimestamps.push(n.created_at); });
        confirmed.forEach((r: any) => { if (r.created_at) allTimestamps.push(r.created_at); });
        if (allTimestamps.length > 0) {
          allTimestamps.sort();
          setInitialTime(allTimestamps[0]);
        }
      }
    } catch (err) {
      console.warn('[FollowupTab] 加载失败:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadFollowups();
  }, [loadFollowups]);

  useEffect(() => {
    onRefreshRef.current = loadFollowups;
  }, [onRefreshRef, loadFollowups]);

  const handleConfirm = async (id: string) => {
    try {
      await projectAgentApi.confirmFollowup({ followup_id: id, project_id: projectId });
      overlay.toast.success('已确认');
      loadFollowups();
    } catch (err) {
      overlay.toast.error('确认失败');
    }
  };

  const handleDelete = async (id: string) => {
    overlay.confirm({
      title: '删除跟进记录',
      message: '确定要删除这条跟进记录吗？',
      confirmText: '删除',
      onConfirm: async () => {
        try {
          await projectAgentApi.deleteFollowup({ followup_id: id, project_id: projectId });
          overlay.toast.success('已删除');
          loadFollowups();
        } catch (err) {
          overlay.toast.error('删除失败');
        }
      },
    });
  };

  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    try {
      await projectAgentApi.updateFollowup({
        followup_id: id,
        project_id: projectId,
        content: editContent.trim(),
      });
      overlay.toast.success('已更新');
      setEditingId(null);
      loadFollowups();
    } catch (err) {
      overlay.toast.error('更新失败');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      return `${month}/${day}`;
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  const renderInitialCard = () => (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLeft}>
        <Text style={styles.timelineDate}>{formatDate(initialTime)}</Text>
        <View style={[styles.timelineDot, styles.dotInitial]} />
        <View style={styles.timelineLine} />
      </View>
      <View style={[styles.card, styles.cardInitial]}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, styles.badgeInitial]}>
            <Text style={styles.statusInitialText}>提示</Text>
          </View>
          <Text style={styles.cardTime}>{formatTime(initialTime)}</Text>
        </View>
        <View style={styles.initialContent}>
          <Target size={16} color={DayColors.textSecondary} strokeWidth={2} />
          <Text style={styles.initialText}>初次跟进</Text>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.cardSource}>来源：系统生成</Text>
        </View>
      </View>
    </View>
  );

  const renderCard = (item: any, isPending: boolean) => {
    const isEditing = editingId === item.id;
    const content = item.content || item.message || '';
    const title = item.title || item.keyword || '';
    const source = item.metadata?.source || (isPending ? 'AI对话提取' : '用户确认');
    const timestamp = item.created_at || item.timestamp;

    return (
      <View key={item.id} style={styles.timelineItem}>
        <View style={styles.timelineLeft}>
          <Text style={styles.timelineDate}>{formatDate(timestamp)}</Text>
          <View style={[
            styles.timelineDot,
            isPending ? styles.dotPending : styles.dotConfirmed,
          ]} />
          <View style={styles.timelineLine} />
        </View>

        <View style={[styles.card, isPending && styles.cardPending]}>
          <View style={styles.cardHeader}>
            <View style={[styles.statusBadge, isPending ? styles.badgePending : styles.badgeConfirmed]}>
              {isPending ? (
                <Clock size={10} color="#F59E0B" strokeWidth={2.5} />
              ) : (
                <CheckCircle2 size={10} color="#10B981" strokeWidth={2.5} />
              )}
              <Text style={[styles.statusText, isPending ? styles.statusPending : styles.statusConfirmed]}>
                {isPending ? '待确认' : '已确认'}
              </Text>
            </View>
            <Text style={styles.cardTime}>{formatTime(timestamp)}</Text>
          </View>

          {title ? <Text style={styles.cardTitle}>{title}</Text> : null}

          {isEditing ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.editInput}
                value={editContent}
                onChangeText={setEditContent}
                multiline
                autoFocus
              />
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.editDeleteBtn}
                  onPress={() => {
                    setEditingId(null);
                    handleDelete(item.id);
                  }}
                >
                  <Trash2 size={14} color="#EF4444" strokeWidth={2} />
                  <Text style={styles.editDeleteText}>删除</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={styles.editCancelBtn}
                  onPress={() => setEditingId(null)}
                >
                  <Text style={styles.editCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editSaveBtn}
                  onPress={() => handleSaveEdit(item.id)}
                >
                  <Text style={styles.editSaveText}>保存</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.cardContent}>{content}</Text>
          )}

          {!isEditing && (
            <View style={styles.cardFooter}>
              <Text style={styles.cardSource}>来源：{source}</Text>
              <View style={styles.cardActions}>
                {isPending && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleConfirm(item.id)}
                  >
                    <CheckCircle2 size={14} color="#10B981" strokeWidth={2} />
                    <Text style={[styles.actionText, { color: '#10B981' }]}>确认</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    setEditingId(item.id);
                    setEditContent(content);
                  }}
                >
                  <Pencil size={14} color={DayColors.textSecondary} strokeWidth={2} />
                  <Text style={styles.actionText}>编辑</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={DayColors.accent} />
      </View>
    );
  }

  const hasRecords = pendingNodes.length > 0 || confirmedRecords.length > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadFollowups(); }}
          tintColor={DayColors.accent}
        />
      }
    >
      {renderInitialCard()}

      {pendingNodes.length > 0 && (
        <View style={styles.sectionHeader}>
          <AlertCircle size={14} color="#F59E0B" strokeWidth={2} />
          <Text style={styles.sectionTitle}>待确认 ({pendingNodes.length})</Text>
        </View>
      )}
      {pendingNodes.map(item => renderCard(item, true))}

      {confirmedRecords.length > 0 && (
        <View style={styles.sectionHeader}>
          <CheckCircle2 size={14} color="#10B981" strokeWidth={2} />
          <Text style={styles.sectionTitle}>跟进记录 ({confirmedRecords.length})</Text>
        </View>
      )}
      {confirmedRecords.map(item => renderCard(item, false))}

      {!hasRecords && (
        <View style={styles.emptyHint}>
          <Text style={styles.emptyHintText}>和 AI 对话后，系统会自动提取跟进记录</Text>
          <Text style={styles.emptyHintSub}>你也可以在下方输入框手动添加跟进内容</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 10, paddingBottom: 32 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: DayColors.text,
  },

  timelineItem: { flexDirection: 'row', marginBottom: 16 },
  timelineLeft: { width: 44, alignItems: 'center', paddingTop: 0, marginRight: 3 },
  timelineDate: {
    fontSize: 11,
    fontWeight: '500',
    color: DayColors.textSecondary,
    marginBottom: 4,
  },
  timelineDot: {
    width: 10, height: 10, borderRadius: 5,
  },
  dotInitial: {
    backgroundColor: '#9CA3AF',
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
  dotPending: {
    backgroundColor: '#F59E0B',
    borderWidth: 2,
    borderColor: '#FEF3C7',
  },
  dotConfirmed: {
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#D1FAE5',
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: DayColors.border,
    marginTop: 4,
  },

  card: {
    flex: 1,
    marginLeft: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    paddingBottom: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD5E1',
  },
  cardInitial: {
    backgroundColor: '#FFFFFF',
    borderStyle: 'dashed',
    borderColor: '#94A3B8',
  },
  cardPending: {
    borderColor: '#FDE68A',
    borderWidth: 1,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeInitial: { backgroundColor: '#F3F4F6' },
  badgePending: { backgroundColor: '#FEF3C7' },
  badgeConfirmed: { backgroundColor: '#D1FAE5' },
  statusText: { fontSize: 10, fontWeight: '600' },
  statusInitialText: { fontSize: 10, fontWeight: '600', color: '#6B7280' },
  statusPending: { color: '#D97706' },
  statusConfirmed: { color: '#059669' },
  cardTime: { fontSize: 11, color: DayColors.textTertiary },

  initialContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  initialText: {
    fontSize: 14,
    fontWeight: '600',
    color: DayColors.text,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
    paddingTop: 4,
    paddingBottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DayColors.border,
  },
  cardSource: {
    fontSize: 11,
    color: DayColors.textTertiary,
  },

  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: DayColors.text,
    marginBottom: 4,
  },
  cardContent: {
    fontSize: 13,
    lineHeight: 20,
    color: DayColors.textSecondary,
  },

  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    color: DayColors.textSecondary,
  },

  editContainer: { gap: 8 },
  editInput: {
    backgroundColor: DayColors.surfaceSecondary,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: DayColors.text,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editDeleteText: { fontSize: 12, color: '#EF4444' },
  editCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: DayColors.surfaceSecondary,
  },
  editCancelText: { fontSize: 12, color: DayColors.textSecondary },
  editSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#111827',
  },
  editSaveText: { fontSize: 12, color: '#FFF', fontWeight: '600' },

  emptyHint: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyHintText: {
    fontSize: 13,
    color: DayColors.textTertiary,
    textAlign: 'center',
  },
  emptyHintSub: {
    fontSize: 12,
    color: DayColors.textTertiary,
    textAlign: 'center',
    opacity: 0.7,
  },
});

export default FollowupTab;
