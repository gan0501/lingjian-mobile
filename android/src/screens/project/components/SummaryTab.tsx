/**
 * SummaryTab V2 - 总结Tab
 *
 * 上下滚动结构：
 *   ┌──────────────────────────┐
 *   │ [企业关系图] [人物关系图]   │ 子Tab（RelationshipGraph内部）
 *   │ ┌────────────────────┐  │
 *   │ │  径向网络图画布       │  │ 固定高度画布窗口
 *   │ │  中心节点 + 子节点    │  │ 可拖拽/缩放
 *   │ └────────────────────┘  │
 *   │  ✦ AI分析               │ AI分析按钮（原取消跟进位置）
 *   │ ━━━ 📍 里程碑 ━━━━━━━━  │ 分割线
 *   │   ●─ 事件1 ★★★★☆       │
 *   │   │  意义总结            │ AI自动生成的里程碑
 *   │   │  💡 下一步建议        │ content + rating + suggestion
 *   │   ●─ 事件2              │
 *   └──────────────────────────┘
 *
 * 里程碑是AI通过对话/跟进/笔记内容自动触发生成的，
 * 每条里程碑包含：content(意义)、rating(评价)、suggestion(下一步建议)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import {
  Star,
  MapPin,
  RefreshCw,
  X,
} from 'lucide-react-native';
import { DayColors } from '@/constants';
import { projectAgentApi } from '@/services';
import { useOverlay } from '@/components/overlay';
import RelationshipGraph from './RelationshipGraph';

interface SummaryTabProps {
  projectId: string;
  projectName: string;
  initialData: any;
  onCancelFollow?: () => void;
  onMilestoneReceived?: (milestone: any) => void;
  onRefreshRef?: React.MutableRefObject<(() => void) | null>;
  onGraphIncrementRef?: React.MutableRefObject<((data: any) => void) | null>;
  onAvatarUpload?: (personName: string) => void;
}

const SummaryTab: React.FC<SummaryTabProps> = ({ projectId, projectName, initialData, onMilestoneReceived, onRefreshRef, onGraphIncrementRef, onAvatarUpload }) => {
  const overlay = useOverlay();
  const [graphTab, setGraphTab] = useState<'enterprise' | 'person'>('enterprise');
  const [graphLoading, setGraphLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [incrementData, setIncrementData] = useState<any>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [generatingMilestones, setGeneratingMilestones] = useState(false);
  const [uncertainties, setUncertainties] = useState<any[]>([]);
  const [ambiguityModalVisible, setAmbiguityModalVisible] = useState(false);
  const [ambiguityAnswers, setAmbiguityAnswers] = useState<Record<string, number>>({});

  const handleGraphIncrement = useCallback((data: any) => {
    setIncrementData(data);
  }, []);

  useEffect(() => {
    if (onGraphIncrementRef) {
      onGraphIncrementRef.current = handleGraphIncrement;
    }
    return () => {
      if (onGraphIncrementRef) {
        onGraphIncrementRef.current = null;
      }
    };
  }, [handleGraphIncrement, onGraphIncrementRef]);

  const [enterpriseNodes, setEnterpriseNodes] = useState<any[]>([]);
  const [personNodes, setPersonNodes] = useState<any[]>([]);
  const [personEdges, setPersonEdges] = useState<any[]>([]);

  const [milestones, setMilestones] = useState<any[]>([]);

  const addMilestoneFromSSE = useCallback((milestone: any) => {
    setMilestones(prev => {
      const exists = prev.some(m => m.id === milestone.id);
      if (exists) return prev;
      return [milestone, ...prev];
    });
  }, []);

  useEffect(() => {
    loadGraphData();
    loadMilestones();
  }, []);

  const loadGraphData = useCallback(async () => {
    try {
      setGraphLoading(true);

      const cacheRes = await projectAgentApi.getGraphCache(projectId);
      if (cacheRes?.data && cacheRes.data.nodes && cacheRes.data.nodes.length > 0) {
        const gd = cacheRes.data;
        const companyNodes = gd.nodes.filter((n: any) => n.type === 'company');
        const personNodeList = gd.nodes.filter((n: any) => n.type === 'person');
        const edgeList = (gd.edges || []).map((e: any) => ({
          source: e.source,
          target: e.target,
          type: e.relation,
          relation_type: e.relation,
        }));

        setEnterpriseNodes(companyNodes);
        setPersonNodes(personNodeList);
        setPersonEdges(edgeList);

        if (gd.uncertainties && gd.uncertainties.length > 0) {
          setUncertainties(gd.uncertainties);
        }
        return;
      }

      const res = await projectAgentApi.getRelationshipGraph(projectId);
      if (res?.data) {
        const entities = res.data.entities || {};
        const personsData = entities.persons || res.data.personnel_graph?.nodes || [];
        const edgesData = res.data.personnel_graph?.edges || [];

        setEnterpriseNodes(entities.companies || res.data.company_graph?.nodes || []);
        setPersonNodes(personsData);
        setPersonEdges(edgesData);
      }
    } catch (err) {
      console.error('[SummaryTab] 关系图加载失败:', err);
    } finally {
      setGraphLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  const loadMilestones = useCallback(async () => {
    try {
      const res = await projectAgentApi.getMilestones(projectId);
      if (res?.data) {
        setMilestones(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error('[SummaryTab] 里程碑加载失败:', err);
    }
  }, [projectId]);

  const handleRebuildGraph = useCallback(async () => {
    try {
      setRebuilding(true);
      const res = await projectAgentApi.rebuildRelationshipGraph({ project_id: projectId });
      if (res?.success && res.data) {
        const gd = res.data;
        const companyNodes = gd.nodes.filter((n: any) => n.type === 'company');
        const personNodeList = gd.nodes.filter((n: any) => n.type === 'person');
        const edgeList = (gd.edges || []).map((e: any) => ({
          source: e.source,
          target: e.target,
          type: e.relation,
          relation_type: e.relation,
        }));

        setEnterpriseNodes(companyNodes);
        setPersonNodes(personNodeList);
        setPersonEdges(edgeList);

        if (res.has_uncertainties && gd.uncertainties?.length > 0) {
          setUncertainties(gd.uncertainties);
          setAmbiguityModalVisible(true);
        }

        overlay.toast.success('关系图重建完成');
      } else {
        overlay.toast.error(res?.message || '重建失败');
      }
    } catch (err) {
      overlay.toast.error('关系图重建失败');
    } finally {
      setRebuilding(false);
    }
  }, [projectId, overlay]);

  const handleGenerateMilestones = useCallback(async () => {
    try {
      setGeneratingMilestones(true);
      const res = await projectAgentApi.generateMilestones({ project_id: projectId });
      if (res?.success) {
        await loadMilestones();
        overlay.toast.success(res.message || '里程碑生成完成');
      } else {
        overlay.toast.error(res?.message || '生成失败');
      }
    } catch (err) {
      overlay.toast.error('里程碑生成失败');
    } finally {
      setGeneratingMilestones(false);
    }
  }, [projectId, overlay, loadMilestones]);

  const handleConfirmAmbiguity = useCallback(async () => {
    try {
      const answers = Object.entries(ambiguityAnswers).map(([uid, optionIdx]) => ({
        uncertainty_id: uid,
        selected_option: optionIdx,
      }));

      const res = await projectAgentApi.confirmAmbiguity({
        project_id: projectId,
        confirmation_id: Date.now().toString(),
        answers,
      });

      if (res?.success && res.data) {
        const gd = res.data;
        const companyNodes = gd.nodes.filter((n: any) => n.type === 'company');
        const personNodeList = gd.nodes.filter((n: any) => n.type === 'person');
        const edgeList = (gd.edges || []).map((e: any) => ({
          source: e.source,
          target: e.target,
          type: e.relation,
          relation_type: e.relation,
        }));

        setEnterpriseNodes(companyNodes);
        setPersonNodes(personNodeList);
        setPersonEdges(edgeList);
      }

      setAmbiguityModalVisible(false);
      setUncertainties([]);
      setAmbiguityAnswers({});
      overlay.toast.success('歧义确认完成');
    } catch (err) {
      overlay.toast.error('确认失败');
    }
  }, [projectId, ambiguityAnswers, overlay]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadGraphData();
    loadMilestones();
  }, [projectId, loadGraphData, loadMilestones]);

  useEffect(() => {
    if (onRefreshRef) {
      onRefreshRef.current = handleRefresh;
    }
    return () => {
      if (onRefreshRef) {
        onRefreshRef.current = null;
      }
    };
  }, [handleRefresh, onRefreshRef]);

  // ─── 日期格式化 ───
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  // ─── 里程碑渲染 ───
  const renderMilestones = () => {
    if (milestones.length === 0) {
      return (
        <View style={styles.emptyBox}>
          <MapPin size={32} color={DayColors.textTertiary} strokeWidth={1} />
          <Text style={styles.emptyTitle}>暂无里程碑</Text>
          <Text style={styles.emptyHint}>
            AI会根据对话、跟进、笔记的内容自动生成里程碑
          </Text>
          <TouchableOpacity
            style={styles.generateMilestoneBtn}
            onPress={handleGenerateMilestones}
            disabled={generatingMilestones}
            activeOpacity={0.7}
          >
            {generatingMilestones ? (
              <ActivityIndicator size="small" color={DayColors.accent} />
            ) : (
              <RefreshCw size={12} color={DayColors.accent} strokeWidth={2} />
            )}
            <Text style={styles.generateMilestoneBtnText}>
              {generatingMilestones ? '生成中...' : '立即生成'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.milestoneContainer}>
        {milestones.map((m: any, idx: number) => {
          const isLast = idx === milestones.length - 1;
          const rating = m.rating || 0;
          return (
            <View key={m.id || idx} style={styles.milestoneRow}>
              {/* 时间线竖线 + 圆点 */}
              <View style={styles.timelineTrack}>
                <View style={[
                  styles.timelineDot,
                  idx === 0 && styles.timelineDotFirst,
                ]} />
                {!isLast && <View style={styles.timelineLine} />}
              </View>

              {/* 内容卡片 */}
              <View style={[styles.milestoneCard, isLast && styles.milestoneCardLast]}>
                {/* 头部：日期 + 评星 */}
                <View style={styles.milestoneHead}>
                  {m.created_at && (
                    <Text style={styles.milestoneDate}>{formatDate(m.created_at)}</Text>
                  )}
                  {rating > 0 && (
                    <View style={styles.ratingRow}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={12}
                          color={i < rating ? '#F59E0B' : DayColors.border}
                          fill={i < rating ? '#F59E0B' : 'none'}
                          strokeWidth={2}
                        />
                      ))}
                    </View>
                  )}
                </View>

                {/* 意义总结 */}
                <Text style={styles.milestoneContent}>
                  📌 {m.content || m.title || m.event || '里程碑'}
                </Text>

                {/* 下一步建议 */}
                {m.suggestion && (
                  <View style={styles.suggestionBox}>
                    <Text style={styles.suggestionText}>
                      💡 {m.suggestion}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={DayColors.accent}
        />
      }
    >
      {/* 关系图（固定窗口 + 企业/人物Tab） */}
      <RelationshipGraph
        graphTab={graphTab}
        onGraphTabChange={setGraphTab}
        enterpriseNodes={enterpriseNodes}
        personNodes={personNodes}
        personEdges={personEdges}
        projectName={projectName}
        loading={graphLoading}
        onRefresh={handleRefresh}
        incrementData={incrementData}
        onIncrementUpdate={handleGraphIncrement}
        onAvatarUpload={onAvatarUpload}
        onRebuildGraph={handleRebuildGraph}
        rebuilding={rebuilding}
      />

      {/* 分割线 + 里程碑标题 */}
      <View style={styles.sectionDivider}>
        <View style={styles.dividerLine} />
        <View style={styles.dividerLabel}>
          <MapPin size={13} color={DayColors.textSecondary} strokeWidth={2} />
          <Text style={styles.dividerText}>里程碑</Text>
        </View>
        <View style={styles.dividerLine} />
      </View>

      {/* 里程碑时间线（AI自动生成，向下延伸） */}
      {renderMilestones()}

      {/* 歧义确认弹窗 */}
      <Modal
        visible={ambiguityModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAmbiguityModalVisible(false)}
      >
        <View style={ambiguityStyles.overlay}>
          <View style={ambiguityStyles.card}>
            <View style={ambiguityStyles.header}>
              <Text style={ambiguityStyles.title}>🤔 AI需要确认</Text>
              <TouchableOpacity onPress={() => setAmbiguityModalVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <X size={20} color={DayColors.textTertiary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={ambiguityStyles.body} showsVerticalScrollIndicator={false}>
              {uncertainties.map((u: any, idx: number) => (
                <View key={u.id || idx} style={ambiguityStyles.uncertaintyItem}>
                  <Text style={ambiguityStyles.question}>{u.question}</Text>
                  {u.context ? <Text style={ambiguityStyles.context}>{u.context}</Text> : null}
                  <View style={ambiguityStyles.options}>
                    {(u.options || []).map((opt: any, oidx: number) => (
                      <TouchableOpacity
                        key={oidx}
                        style={[
                          ambiguityStyles.optionBtn,
                          ambiguityAnswers[u.id] === oidx && ambiguityStyles.optionBtnSelected,
                        ]}
                        onPress={() => setAmbiguityAnswers(prev => ({ ...prev, [u.id]: oidx }))}
                      >
                        <Text style={[
                          ambiguityStyles.optionText,
                          ambiguityAnswers[u.id] === oidx && ambiguityStyles.optionTextSelected,
                        ]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[
                ambiguityStyles.confirmBtn,
                Object.keys(ambiguityAnswers).length < uncertainties.length && ambiguityStyles.confirmBtnDisabled,
              ]}
              onPress={handleConfirmAmbiguity}
              disabled={Object.keys(ambiguityAnswers).length < uncertainties.length}
            >
              <Text style={ambiguityStyles.confirmBtnText}>确认</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingBottom: 24 },

  // 分割线
  sectionDivider: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1, height: StyleSheet.hairlineWidth,
    backgroundColor: DayColors.border,
  },
  dividerLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  dividerText: {
    fontSize: 13, fontWeight: '600', color: DayColors.textSecondary,
  },

  // 空状态
  emptyBox: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 40, gap: 8,
  },
  emptyTitle: {
    fontSize: 15, fontWeight: '600', color: DayColors.textSecondary,
  },
  emptyHint: {
    fontSize: 12, color: DayColors.textTertiary,
    textAlign: 'center', paddingHorizontal: 40,
  },

  // 里程碑
  milestoneContainer: {
    paddingHorizontal: 16,
  },
  milestoneRow: {
    flexDirection: 'row',
  },
  timelineTrack: {
    width: 24, alignItems: 'center',
  },
  timelineDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: DayColors.accent,
    borderWidth: 2, borderColor: DayColors.surface,
    zIndex: 1,
  },
  timelineDotFirst: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#111827',
  },
  timelineLine: {
    width: 2, flex: 1,
    backgroundColor: DayColors.border,
    marginTop: -1,
  },
  milestoneCard: {
    flex: 1, marginLeft: 10, marginBottom: 16,
    padding: 14, borderRadius: 12,
    backgroundColor: DayColors.surfaceSecondary,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  milestoneCardLast: {
    marginBottom: 0,
  },
  milestoneHead: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  milestoneDate: {
    fontSize: 11, color: DayColors.textTertiary,
    backgroundColor: DayColors.surface,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  ratingRow: {
    flexDirection: 'row', gap: 2,
  },
  milestoneContent: {
    fontSize: 14, fontWeight: '600', color: DayColors.text,
    lineHeight: 20,
  },
  suggestionBox: {
    marginTop: 10, padding: 10, borderRadius: 8,
    backgroundColor: '#FFFBEB',
  },
  suggestionText: {
    fontSize: 12, color: '#78350F', lineHeight: 17,
  },

  generateMilestoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: DayColors.surfaceSecondary,
    borderWidth: 1,
    borderColor: DayColors.border,
  },
  generateMilestoneBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: DayColors.accent,
  },
});

const ambiguityStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '85%',
    maxHeight: '70%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DayColors.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: DayColors.text,
  },
  body: {
    padding: 18,
  },
  uncertaintyItem: {
    marginBottom: 20,
  },
  question: {
    fontSize: 15,
    fontWeight: '600',
    color: DayColors.text,
    marginBottom: 4,
  },
  context: {
    fontSize: 12,
    color: DayColors.textTertiary,
    marginBottom: 10,
  },
  options: {
    gap: 8,
  },
  optionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: DayColors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionBtnSelected: {
    borderColor: DayColors.accent,
    backgroundColor: '#FEF2F2',
  },
  optionText: {
    fontSize: 14,
    color: DayColors.text,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: DayColors.accent,
  },
  confirmBtn: {
    margin: 18,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: DayColors.accent,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});

export default SummaryTab;
