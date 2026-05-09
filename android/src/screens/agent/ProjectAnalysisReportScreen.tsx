import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
  Platform,
  PermissionsAndroid,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Share2, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import ViewShot from 'react-native-view-shot';
import Share from 'react-native-share';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { DayColors } from '@/constants';
import { projectAgentApi } from '@/services';
import { useOverlay } from '@/components/overlay';
import type { RootStackScreenProps } from '@/navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WATERMARK_TEXT = '领建';

type Props = RootStackScreenProps<'ProjectAnalysisReport'>;

const WatermarkOverlay: React.FC<{ height?: number }> = ({ height }) => {
  const cols = 4;
  const rows = Math.max(20, height ? Math.ceil(height / 120) : 20);
  return (
    <View style={wmStyles.overlay} pointerEvents="none">
      {Array.from({ length: rows }).map((_, row) => (
        <View key={row} style={wmStyles.row}>
          {Array.from({ length: cols }).map((_, col) => (
            <View key={col} style={wmStyles.cell}>
              <Text style={wmStyles.text}>{WATERMARK_TEXT}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

const wmStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '-30deg' }],
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 60,
  },
  cell: {
    width: SCREEN_WIDTH * 0.35,
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.06)',
    letterSpacing: 4,
  },
});

const ProjectAnalysisReportScreen: React.FC<Props> = ({ route }) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const overlay = useOverlay();
  const { reportId, projectId, projectName } = route.params;

  const viewShotRef = useRef<ViewShot>(null);
  const [contentHeight, setContentHeight] = useState(2000);

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    relationship: true,
    risk: true,
    opportunity: true,
    timeline: false,
    strategy: true,
    scores: true,
  });

  const allExpanded: Record<string, boolean> = {
    overview: true,
    relationship: true,
    risk: true,
    opportunity: true,
    timeline: true,
    strategy: true,
    scores: true,
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const loadReport = useCallback(async () => {
    try {
      if (reportId) {
        const res = await projectAgentApi.getFullAnalysisReport(projectId, reportId);
        if (res?.data?.report_data) {
          setReport(res.data.report_data);
          return;
        }
      }
      if (projectId) {
        const statusRes = await projectAgentApi.getFullAnalysisStatus(projectId);
        if (statusRes?.data?.report_data && Object.keys(statusRes.data.report_data).length > 0) {
          setReport(statusRes.data.report_data);
          return;
        }
        const reportRes = await projectAgentApi.getFullAnalysisReport(projectId);
        if (reportRes?.data?.report_data) {
          setReport(reportRes.data.report_data);
          return;
        }
      }
    } catch (err) {
      console.error('[ReportScreen] 加载报告失败:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [reportId, projectId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadReport();
  }, [loadReport]);

  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const apiLevel = Platform.Version;
        if (typeof apiLevel === 'number' && apiLevel >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
            { title: '相册权限', message: '保存图片需要访问相册权限', buttonNeutral: '稍后询问', buttonNegative: '取消', buttonPositive: '确定' },
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        } else if (typeof apiLevel === 'number' && apiLevel >= 29) {
          return true;
        } else {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            { title: '存储权限', message: '保存图片需要访问存储权限', buttonNeutral: '稍后询问', buttonNegative: '取消', buttonPositive: '确定' },
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
      } catch { return false; }
    }
    return true;
  };

  const captureAndShare = useCallback(async (action: 'share' | 'save') => {
    if (sharing) return;
    setSharing(true);
    try {
      setShareModalVisible(true);
      await new Promise(r => setTimeout(r, 800));

      const uri = await viewShotRef.current?.capture?.({ format: 'png', quality: 1 });
      if (!uri) throw new Error('截图失败');

      setShareModalVisible(false);

      if (action === 'save') {
        const ok = await requestStoragePermission();
        if (!ok) { Alert.alert('提示', '需要存储权限才能保存图片'); return; }
        await CameraRoll.saveAsset(uri, { type: 'photo' });
        overlay.toast.success('已保存到相册');
      } else {
        await Share.open({
          url: uri,
          type: 'image/png',
          title: projectName || '项目分析报告',
          message: `【${projectName || '项目分析报告'}】- 来自领建`,
        });
      }
    } catch (e: any) {
      setShareModalVisible(false);
      if (e?.message !== 'User did not share') {
        overlay.toast.error('操作失败，请重试');
      }
    } finally {
      setSharing(false);
    }
  }, [sharing, projectName, overlay]);

  const showShareSheet = useCallback(() => {
    overlay.sheet.show({
      title: '分享报告',
      actions: [
        {
          text: '📤 分享长图',
          style: 'primary',
          onPress: () => captureAndShare('share'),
        },
        {
          text: '💾 保存到相册',
          style: 'primary',
          onPress: () => captureAndShare('save'),
        },
      ],
    });
  }, [captureAndShare, overlay]);

  const renderScoreBar = (label: string, value: number, color: string) => (
    <View style={s.scoreRow}>
      <Text style={s.scoreLabel}>{label}</Text>
      <View style={s.scoreBarBg}>
        <View style={[s.scoreBarFill, { width: `${Math.min(value, 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={s.scoreValue}>{value}</Text>
    </View>
  );

  const renderSection = (
    sectionKey: string,
    title: string,
    badge: React.ReactNode | undefined,
    children: React.ReactNode,
    isExpanded: boolean,
    onToggle: (() => void) | undefined,
  ) => (
    <View key={sectionKey} style={s.section}>
      <TouchableOpacity style={s.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={s.sectionHeaderLeft}>
          <View style={s.sectionBar} />
          <Text style={s.sectionTitle}>{title}</Text>
        </View>
        <View style={s.sectionHeaderRight}>
          {badge}
          {isExpanded ? (
            <ChevronUp size={16} color={DayColors.textTertiary} />
          ) : (
            <ChevronDown size={16} color={DayColors.textTertiary} />
          )}
        </View>
      </TouchableOpacity>
      {isExpanded && <View style={s.sectionBody}>{children}</View>}
    </View>
  );

  const renderReportContent = (
    expandedMap: Record<string, boolean>,
    toggleFn?: (key: string) => void,
  ) => {
    if (!report) return null;
    const overview = report.project_overview || {};
    const relationship = report.relationship_analysis || {};
    const risk = report.risk_assessment || {};
    const opportunity = report.opportunity_insights || {};
    const timeline = report.timeline_review || {};
    const strategy = report.strategic_recommendations || {};
    const scores = report.overall_score || {};

    const stageColorMap: Record<string, string> = {
      '初期接触': '#6366F1', '需求确认': '#3B82F6', '方案推进': '#F59E0B',
      '商务谈判': '#F97316', '签约收尾': '#22C55E', '售后维护': '#8B5CF6',
    };

    const riskLevelColor = (level: string) => {
      if (level === '高') return '#EF4444';
      if (level === '中') return '#F59E0B';
      return '#22C55E';
    };

    return (
      <>
        {renderSection('overview', '项目概况',
          <View style={[s.miniBadge, { backgroundColor: (stageColorMap[overview.stage] || '#6366F1') + '18' }]}>
            <Text style={[s.miniBadgeText, { color: stageColorMap[overview.stage] || '#6366F1' }]}>{overview.stage || '未知'}</Text>
          </View>,
          <>
            <View style={s.tagRow}>
              {overview.activity_level ? (
                <View style={[s.tag, { backgroundColor: '#F0FDF4' }]}>
                  <Text style={[s.tagText, { color: '#166534' }]}>{overview.activity_level}活跃</Text>
                </View>
              ) : null}
              {overview.activity_trend ? (
                <View style={[s.tag, { backgroundColor: overview.activity_trend === '上升' ? '#FEF3C7' : '#F3F4F6' }]}>
                  <Text style={[s.tagText, { color: overview.activity_trend === '上升' ? '#92400E' : '#374151' }]}>趋势{overview.activity_trend}</Text>
                </View>
              ) : null}
              {overview.stage_confidence ? (
                <View style={[s.tag, { backgroundColor: '#EEF2FF' }]}>
                  <Text style={[s.tagText, { color: '#4338CA' }]}>置信度{overview.stage_confidence}</Text>
                </View>
              ) : null}
            </View>
            {overview.summary ? <Text style={s.bodyText}>{overview.summary}</Text> : null}
          </>,
          expandedMap.overview,
          toggleFn ? () => toggleFn('overview') : undefined,
        )}

        {renderSection('relationship', '关系分析', undefined,
          <>
            {(relationship.key_decision_makers || []).length > 0 && (
              <View style={s.subSection}>
                <Text style={s.subTitle}>关键决策者</Text>
                {(relationship.key_decision_makers || []).map((person: any, idx: number) => (
                  <View key={idx} style={s.personCard}>
                    <View style={s.personHeader}>
                      <View style={[s.personDot, { backgroundColor: person.influence === '高' ? '#EF4444' : person.influence === '中' ? '#F59E0B' : '#22C55E' }]} />
                      <Text style={s.personName}>{person.name}</Text>
                      <Text style={s.personRole}>{person.role}</Text>
                    </View>
                    <View style={s.personMeta}>
                      <View style={[s.metaTag, { backgroundColor: person.attitude === '积极' ? '#F0FDF4' : person.attitude === '消极' ? '#FEE2E2' : '#F3F4F6' }]}>
                        <Text style={[s.metaTagText, { color: person.attitude === '积极' ? '#166534' : person.attitude === '消极' ? '#991B1B' : '#374151' }]}>态度{person.attitude || '未知'}</Text>
                      </View>
                      <View style={[s.metaTag, { backgroundColor: '#EEF2FF' }]}>
                        <Text style={[s.metaTagText, { color: '#4338CA' }]}>影响{person.influence || '未知'}</Text>
                      </View>
                    </View>
                    {person.access_path ? <Text style={s.personPath}>接触路径: {person.access_path}</Text> : null}
                  </View>
                ))}
              </View>
            )}
            {(relationship.relationship_chains || []).length > 0 && (
              <View style={s.subSection}>
                <Text style={s.subTitle}>关系链路</Text>
                {(relationship.relationship_chains || []).map((chain: any, idx: number) => (
                  <View key={idx} style={s.chainRow}>
                    <Text style={s.chainText}>{chain.chain}</Text>
                    <View style={s.chainMeta}>
                      <Text style={s.chainStrength}>强度{chain.strength}</Text>
                      {chain.leverage_point ? <Text style={s.chainLeverage}>支点: {chain.leverage_point}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
            {(relationship.untapped_relations || []).length > 0 && (
              <View style={s.subSection}>
                <Text style={s.subTitle}>未充分利用的关系</Text>
                {(relationship.untapped_relations || []).map((rel: string, idx: number) => (
                  <View key={idx} style={s.bulletRow}>
                    <Text style={s.bulletDot}>•</Text>
                    <Text style={s.bulletText}>{rel}</Text>
                  </View>
                ))}
              </View>
            )}
            {relationship.relationship_advice ? (
              <View style={s.adviceBox}>
                <Text style={s.adviceText}>{relationship.relationship_advice}</Text>
              </View>
            ) : null}
          </>,
          expandedMap.relationship,
          toggleFn ? () => toggleFn('relationship') : undefined,
        )}

        {renderSection('risk', '风险预警',
          <View style={[s.miniBadge, { backgroundColor: riskLevelColor(risk.overall_risk_level) + '18' }]}>
            <Text style={[s.miniBadgeText, { color: riskLevelColor(risk.overall_risk_level) }]}>{risk.overall_risk_level || '低'}风险</Text>
          </View>,
          <>
            {(risk.risks || []).map((riskItem: any, idx: number) => (
              <View key={idx} style={s.riskCard}>
                <View style={s.riskHeader}>
                  <View style={[s.riskDot, { backgroundColor: riskLevelColor(riskItem.severity) }]} />
                  <Text style={s.riskType}>{riskItem.type}</Text>
                  <View style={[s.severityTag, { backgroundColor: riskLevelColor(riskItem.severity) + '18' }]}>
                    <Text style={[s.severityText, { color: riskLevelColor(riskItem.severity) }]}>{riskItem.severity}</Text>
                  </View>
                </View>
                <Text style={s.riskDesc}>{riskItem.description}</Text>
                <View style={s.riskMeta}>
                  {riskItem.probability ? (
                    <Text style={s.riskProb}>发生概率: {riskItem.probability}</Text>
                  ) : null}
                </View>
                {riskItem.mitigation ? (
                  <View style={s.mitigationBox}>
                    <Text style={s.mitigationLabel}>缓解措施</Text>
                    <Text style={s.mitigationText}>{riskItem.mitigation}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </>,
          expandedMap.risk,
          toggleFn ? () => toggleFn('risk') : undefined,
        )}

        {renderSection('opportunity', '机会洞察', undefined,
          <>
            {(opportunity.opportunities || []).map((opp: any, idx: number) => (
              <View key={idx} style={s.oppCard}>
                <View style={s.oppHeader}>
                  <View style={[s.oppDot, { backgroundColor: opp.potential === '高' ? '#22C55E' : opp.potential === '中' ? '#F59E0B' : '#9CA3AF' }]} />
                  <Text style={s.oppDesc}>{opp.description}</Text>
                </View>
                <View style={s.oppMeta}>
                  <View style={[s.metaTag, { backgroundColor: opp.potential === '高' ? '#F0FDF4' : '#FEF3C7' }]}>
                    <Text style={[s.metaTagText, { color: opp.potential === '高' ? '#166534' : '#92400E' }]}>潜力{opp.potential}</Text>
                  </View>
                </View>
                {opp.action ? <Text style={s.oppAction}>建议行动: {opp.action}</Text> : null}
              </View>
            ))}
            {opportunity.competitive_advantage ? (
              <View style={s.advantageBox}>
                <Text style={s.advantageLabel}>竞争优势</Text>
                <Text style={s.advantageText}>{opportunity.competitive_advantage}</Text>
              </View>
            ) : null}
            {opportunity.window_of_opportunity ? (
              <View style={s.windowBox}>
                <Text style={s.windowLabel}>机会窗口</Text>
                <Text style={s.windowText}>{opportunity.window_of_opportunity}</Text>
              </View>
            ) : null}
          </>,
          expandedMap.opportunity,
          toggleFn ? () => toggleFn('opportunity') : undefined,
        )}

        {renderSection('timeline', '时间线回顾', undefined,
          <>
            {(timeline.key_events || []).map((evt: any, idx: number) => (
              <View key={idx} style={s.eventRow}>
                <View style={s.eventTimeline}>
                  <View style={[s.eventDot, { backgroundColor: evt.significance === '高' ? '#F59E0B' : '#D1D5DB' }]} />
                  {idx < (timeline.key_events || []).length - 1 && <View style={s.eventLine} />}
                </View>
                <View style={s.eventContent}>
                  <Text style={s.eventText}>{evt.event}</Text>
                  <View style={s.eventMeta}>
                    {evt.date ? <Text style={s.eventDate}>{evt.date}</Text> : null}
                    {evt.significance ? (
                      <View style={[s.metaTag, { backgroundColor: evt.significance === '高' ? '#FEF3C7' : '#F3F4F6' }]}>
                        <Text style={[s.metaTagText, { color: evt.significance === '高' ? '#92400E' : '#374151' }]}>{evt.significance}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
            {timeline.pace_assessment ? (
              <View style={s.paceBox}>
                <Text style={s.paceLabel}>推进节奏: {timeline.pace_assessment}</Text>
                {timeline.pace_advice ? <Text style={s.paceAdvice}>{timeline.pace_advice}</Text> : null}
              </View>
            ) : null}
          </>,
          expandedMap.timeline,
          toggleFn ? () => toggleFn('timeline') : undefined,
        )}

        {renderSection('strategy', '战略建议', undefined,
          <>
            {(strategy.short_term || []).length > 0 && (
              <View style={s.strategyGroup}>
                <Text style={s.strategyLabel}>短期行动（本周）</Text>
                {(strategy.short_term || []).map((item: string, idx: number) => (
                  <View key={idx} style={s.bulletRow}>
                    <Text style={s.bulletDot}>•</Text>
                    <Text style={s.bulletText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
            {(strategy.mid_term || []).length > 0 && (
              <View style={s.strategyGroup}>
                <Text style={s.strategyLabel}>中期策略（本月）</Text>
                {(strategy.mid_term || []).map((item: string, idx: number) => (
                  <View key={idx} style={s.bulletRow}>
                    <Text style={s.bulletDot}>•</Text>
                    <Text style={s.bulletText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
            {(strategy.long_term || []).length > 0 && (
              <View style={s.strategyGroup}>
                <Text style={s.strategyLabel}>长期布局</Text>
                {(strategy.long_term || []).map((item: string, idx: number) => (
                  <View key={idx} style={s.bulletRow}>
                    <Text style={s.bulletDot}>•</Text>
                    <Text style={s.bulletText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
            {(strategy.priority_actions || []).length > 0 && (
              <View style={s.priorityBox}>
                <Text style={s.priorityLabel}>最优先行动</Text>
                {(strategy.priority_actions || []).map((a: any, idx: number) => (
                  <View key={idx} style={s.priorityItem}>
                    <Text style={s.priorityAction}>{a.action}</Text>
                    {a.reason ? <Text style={s.priorityReason}>原因: {a.reason}</Text> : null}
                    {a.expected_outcome ? <Text style={s.priorityOutcome}>预期: {a.expected_outcome}</Text> : null}
                  </View>
                ))}
              </View>
            )}
          </>,
          expandedMap.strategy,
          toggleFn ? () => toggleFn('strategy') : undefined,
        )}

        {renderSection('scores', '综合评分', undefined,
          <>
            {renderScoreBar('关系强度', scores.relationship_strength || 0, '#8B5CF6')}
            {renderScoreBar('项目进度', scores.project_progress || 0, '#3B82F6')}
            {renderScoreBar('风险水平', scores.risk_level || 0, '#EF4444')}
            {renderScoreBar('机会水平', scores.opportunity_level || 0, '#22C55E')}
            <View style={s.overallRow}>
              <Text style={s.overallLabel}>综合评分</Text>
              <Text style={s.overallValue}>{scores.overall || 0}</Text>
            </View>
          </>,
          expandedMap.scores,
          toggleFn ? () => toggleFn('scores') : undefined,
        )}
      </>
    );
  };

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color={DayColors.text} strokeWidth={2} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle} numberOfLines={1}>分析报告</Text>
          </View>
          <View style={s.headerBtn} />
        </View>
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color={DayColors.accent} />
          <Text style={s.loadingText}>加载报告中...</Text>
        </View>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color={DayColors.text} strokeWidth={2} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle} numberOfLines={1}>分析报告</Text>
          </View>
          <View style={s.headerBtn} />
        </View>
        <View style={s.emptyBox}>
          <Text style={s.emptyText}>暂无分析报告</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={DayColors.text} strokeWidth={2} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>{projectName || '项目分析报告'}</Text>
        </View>
        <TouchableOpacity style={s.headerBtn} onPress={showShareSheet} disabled={sharing}>
          {sharing ? (
            <ActivityIndicator size="small" color={DayColors.text} />
          ) : (
            <Share2 size={20} color={DayColors.text} strokeWidth={2} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={(_, h) => setContentHeight(h)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={DayColors.accent} />}
      >
        {renderReportContent(expandedSections, toggleSection)}
      </ScrollView>

      <Modal visible={shareModalVisible} transparent animationType="none">
        <View style={s.captureContainer}>
          <ViewShot
            ref={viewShotRef}
            options={{ format: 'png', quality: 1 }}
            style={{ width: SCREEN_WIDTH, height: contentHeight + 100 }}
          >
            <WatermarkOverlay height={contentHeight + 100} />
            <View style={[s.scrollContent, { paddingTop: 40, paddingBottom: 40 }]}>
              <View style={s.captureHeader}>
                <Text style={s.captureTitle}>{projectName || '项目分析报告'}</Text>
                <Text style={s.captureSub}>领建 · 项目分析报告</Text>
              </View>
              {renderReportContent(allExpanded, undefined)}
            </View>
          </ViewShot>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DayColors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: DayColors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DayColors.border,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: DayColors.text },

  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: DayColors.textTertiary },

  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 14, color: DayColors.textTertiary },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  captureContainer: {
    position: 'absolute',
    left: -9999,
    top: 0,
    opacity: 0,
  },
  captureHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DayColors.border,
  },
  captureTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: DayColors.text,
  },
  captureSub: {
    fontSize: 12,
    color: DayColors.textTertiary,
    marginTop: 4,
  },

  section: {
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: DayColors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionBar: { width: 4, height: 16, backgroundColor: '#EF4444', borderRadius: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: DayColors.text },
  sectionBody: {
    paddingHorizontal: 16, paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DayColors.border,
  },

  miniBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  miniBadgeText: { fontSize: 11, fontWeight: '600' },

  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 10 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 11, fontWeight: '600' },

  bodyText: { fontSize: 14, color: DayColors.textSecondary, lineHeight: 20, marginTop: 10 },

  subSection: { marginTop: 12 },
  subTitle: { fontSize: 13, fontWeight: '600', color: DayColors.textSecondary, marginBottom: 8 },

  personCard: {
    padding: 10, borderRadius: 10,
    backgroundColor: DayColors.surfaceSecondary,
    marginBottom: 8,
  },
  personHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  personDot: { width: 8, height: 8, borderRadius: 4 },
  personName: { fontSize: 14, fontWeight: '600', color: DayColors.text },
  personRole: { fontSize: 12, color: DayColors.textTertiary, flex: 1, textAlign: 'right' },
  personMeta: { flexDirection: 'row', gap: 6, marginTop: 6 },
  personPath: { fontSize: 12, color: '#4338CA', marginTop: 4 },

  metaTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  metaTagText: { fontSize: 11, fontWeight: '500' },

  chainRow: {
    padding: 10, borderRadius: 10,
    backgroundColor: DayColors.surfaceSecondary,
    marginBottom: 6,
  },
  chainText: { fontSize: 13, fontWeight: '500', color: DayColors.text },
  chainMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chainStrength: { fontSize: 11, color: DayColors.textTertiary },
  chainLeverage: { fontSize: 11, color: '#4338CA' },

  bulletRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  bulletDot: { fontSize: 14, color: DayColors.textTertiary, lineHeight: 20 },
  bulletText: { fontSize: 13, color: DayColors.text, lineHeight: 20, flex: 1 },

  adviceBox: {
    marginTop: 10, padding: 10, borderRadius: 10,
    backgroundColor: '#F5F3FF',
  },
  adviceText: { fontSize: 13, color: '#5B21B6', lineHeight: 18 },

  riskCard: {
    padding: 12, borderRadius: 10,
    backgroundColor: DayColors.surfaceSecondary,
    marginBottom: 8,
  },
  riskHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  riskDot: { width: 8, height: 8, borderRadius: 4 },
  riskType: { fontSize: 14, fontWeight: '600', color: DayColors.text, flex: 1 },
  severityTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  severityText: { fontSize: 11, fontWeight: '600' },
  riskDesc: { fontSize: 13, color: DayColors.textSecondary, lineHeight: 18, marginTop: 6 },
  riskMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  riskProb: { fontSize: 11, color: DayColors.textTertiary },
  mitigationBox: {
    marginTop: 8, padding: 8, borderRadius: 8,
    backgroundColor: '#F0FDF4',
  },
  mitigationLabel: { fontSize: 11, fontWeight: '600', color: '#166534', marginBottom: 2 },
  mitigationText: { fontSize: 12, color: '#166534', lineHeight: 17 },

  oppCard: {
    padding: 12, borderRadius: 10,
    backgroundColor: DayColors.surfaceSecondary,
    marginBottom: 8,
  },
  oppHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  oppDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  oppDesc: { fontSize: 13, fontWeight: '500', color: DayColors.text, flex: 1, lineHeight: 18 },
  oppMeta: { flexDirection: 'row', gap: 6, marginTop: 6 },
  oppAction: { fontSize: 12, color: DayColors.textTertiary, marginTop: 4 },

  advantageBox: {
    marginTop: 8, padding: 10, borderRadius: 10,
    backgroundColor: '#F0FDF4',
  },
  advantageLabel: { fontSize: 12, fontWeight: '600', color: '#166534', marginBottom: 4 },
  advantageText: { fontSize: 13, color: '#166534', lineHeight: 18 },

  windowBox: {
    marginTop: 8, padding: 10, borderRadius: 10,
    backgroundColor: '#EFF6FF',
  },
  windowLabel: { fontSize: 12, fontWeight: '600', color: '#1D4ED8', marginBottom: 4 },
  windowText: { fontSize: 13, color: '#1D4ED8', lineHeight: 18 },

  eventRow: { flexDirection: 'row', marginBottom: 0 },
  eventTimeline: { width: 24, alignItems: 'center' },
  eventDot: { width: 10, height: 10, borderRadius: 5, zIndex: 1 },
  eventLine: { width: 2, flex: 1, backgroundColor: DayColors.border, marginTop: -1 },
  eventContent: { flex: 1, marginLeft: 10, marginBottom: 14 },
  eventText: { fontSize: 13, fontWeight: '500', color: DayColors.text, lineHeight: 18 },
  eventMeta: { flexDirection: 'row', gap: 6, marginTop: 4, alignItems: 'center' },
  eventDate: { fontSize: 11, color: DayColors.textTertiary },

  paceBox: {
    marginTop: 8, padding: 10, borderRadius: 10,
    backgroundColor: DayColors.surfaceSecondary,
  },
  paceLabel: { fontSize: 13, fontWeight: '600', color: DayColors.text },
  paceAdvice: { fontSize: 12, color: DayColors.textSecondary, marginTop: 4, lineHeight: 17 },

  strategyGroup: { marginTop: 10 },
  strategyLabel: { fontSize: 12, fontWeight: '600', color: DayColors.textSecondary, marginBottom: 4 },

  priorityBox: {
    marginTop: 10, padding: 12, borderRadius: 10,
    backgroundColor: '#EFF6FF',
  },
  priorityLabel: { fontSize: 13, fontWeight: '700', color: '#1D4ED8', marginBottom: 8 },
  priorityItem: { marginBottom: 8 },
  priorityAction: { fontSize: 14, fontWeight: '600', color: DayColors.text },
  priorityReason: { fontSize: 12, color: DayColors.textTertiary, marginTop: 2 },
  priorityOutcome: { fontSize: 12, color: '#1D4ED8', marginTop: 2 },

  scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8, marginTop: 10 },
  scoreLabel: { fontSize: 12, color: DayColors.textSecondary, width: 56 },
  scoreBarBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: DayColors.border, overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 4 },
  scoreValue: { fontSize: 12, fontWeight: '700', color: DayColors.text, width: 28, textAlign: 'right' },

  overallRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 10, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: DayColors.border,
  },
  overallLabel: { fontSize: 15, fontWeight: '700', color: DayColors.text },
  overallValue: { fontSize: 28, fontWeight: '800', color: '#F59E0B' },
});

export default ProjectAnalysisReportScreen;
