/**
 * AgentWorkbenchScreen V2 - 智能体工作台
 *
 * 功能：
 * - 输出结果列表（工作中/已完成/失败三态）
 * - 创建任务入口（标书/桩基/找项目各自表单）
 * - 统计顶栏（完成数/Token/价值）
 * - DayMode 亮色主题
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { DayColors } from '@/constants';
import { useOverlay } from '@/components/overlay';
import api from '@/services/api';
import { projectAgentApi } from '@/services/projectAgentService';
import {
  useAgentTaskStore,
  AGENT_TYPE_MAP,
  WORKING_STATUSES,
  FAILED_STATUSES,
} from '@/stores';

// ── 筛选常量（找项目） ──
const PF_FIELDS = ['市政道路', '民用住宅', '工业厂房', '水利水电', '公共医疗', '教育学校', '石油化工', '公共场馆', '安置小区', '电力光伏'];
const PF_PERIODS = ['1个月内', '3个月内', '6个月内', '9个月内'];
const PF_TYPES = ['政府项目', '企业项目', '个人项目'];
const PF_SCALES = ['10000m²以内', '30000m²以内', '50000m²以内', '100000m²以内', '100000m²以上'];
const PF_INVEST = ['500万以内', '1000万以内', '5000万以内', '1亿以内', '1亿以上'];
const PF_CUSTOMERS = ['国家级', '省属级', '地市级', '区县级', '街道级', '企业级'];

type TabType = 'results' | 'create';

interface TaskResultItem {
  id: string;
  title: string;
  status: string;
  created_at: string;
  extra?: any;
}

const AgentWorkbenchScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const overlay = useOverlay();

  const {
    agentId = '', agentName = '智能体', agentType = '',
    agentIcon = '🤖', agentColor = '#ff6b6b',
  } = route.params || {};

  const [activeTab, setActiveTab] = useState<TabType>('results');
  const [results, setResults] = useState<TaskResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // 找项目表单
  const [pfFields, setPfFields] = useState<string[]>([]);
  const [pfPeriod, setPfPeriod] = useState('');
  const [pfTypes, setPfTypes] = useState<string[]>([]);
  const [pfScale, setPfScale] = useState('');
  const [pfInvest, setPfInvest] = useState('');
  const [pfCustomers, setPfCustomers] = useState<string[]>([]);
  const [pfSubmitting, setPfSubmitting] = useState(false);

  const resultsRef = useRef<TaskResultItem[]>([]);
  const lastFetchRef = useRef(0);
  const CACHE_MS = 5 * 60 * 1000;

  // 状态分类
  const isWorking = (s: string) => WORKING_STATUSES.has(s);
  const isFailed = (s: string) => FAILED_STATUSES.has(s);
  const isCompleted = (s: string) => !isWorking(s) && !isFailed(s);

  const mapBidStatusToStep = (status: string): number => {
    if (['completed', 'exported', 'reviewing', 'generating', 'outline_confirmed'].includes(status)) return 3;
    if (['generating_outline', 'outline_editing', 'parsed'].includes(status)) return 2;
    return 1;
  };

  const statusLabel = (s: string) => {
    if (isWorking(s)) return { text: '工作中', color: '#F59E0B' };
    if (isFailed(s)) return { text: '失败', color: '#EF4444' };
    return { text: '已完成', color: '#16A34A' };
  };

  // 拉取统计
  useEffect(() => {
    if (agentType) {
      api.get(`/api/agent-tasks/agent-stats/${agentType}`)
        .then((res: any) => { if (res?.data) setStats(res.data); })
        .catch(() => {});
    }
  }, [agentType]);

  // 拉取结果列表
  const fetchResults = useCallback(async (isRefresh = false) => {
    const now = Date.now();
    if (!isRefresh && resultsRef.current.length > 0 && now - lastFetchRef.current < CACHE_MS) {
      setLoading(false);
      return;
    }
    isRefresh ? setRefreshing(true) : setLoading(true);

    try {
      let items: TaskResultItem[] = [];

      if (agentType === 'bid_writer') {
        const res: any = await api.get('/api/bid-writer/list');
        items = (Array.isArray(res) ? res : []).map((d: any) => ({
          id: d.id,
          title: d.title || '未命名标书',
          status: d.status || 'draft',
          created_at: d.created_at || '',
        }));
      } else if (agentType === 'pile_compare') {
        const res: any = await api.get('/api/agent-tasks/history', { params: { agent_type: 'pile_compare' } });
        items = (res?.data || []).map((t: any) => ({
          id: t.id,
          title: t.title || `桩基比选 · ${t.status === 'completed' ? '已完成' : t.current_step || '处理中'}`,
          status: t.status || 'unknown',
          created_at: t.created_at || '',
          extra: t,
        }));
      } else if (agentType === 'project_finder') {
        const res: any = await api.get('/api/agent-tasks/history', { params: { agent_type: 'project_finder' } });
        items = (res?.data || []).map((t: any) => ({
          id: t.id,
          title: `找项目任务 · 匹配 ${t.matched_items ?? 0} 个`,
          status: t.status || 'unknown',
          created_at: t.created_at || '',
          extra: { ...t, matched_items: t.matched_items ?? 0 },
        }));
      } else if (agentType === 'project_analysis') {
        const res: any = await projectAgentApi.listFullAnalysisReports();
        items = (res?.data || []).map((r: any) => ({
          id: r.id,
          title: `${r.project_name || '项目'} · 全量分析`,
          status: r.status === 'generating' ? 'working' : r.status === 'completed' ? 'completed' : r.status || 'unknown',
          created_at: r.created_at || '',
          extra: r,
        }));
      }

      resultsRef.current = items;
      lastFetchRef.current = now;
      setResults(items);
    } catch (err: any) {
      console.warn('[Workbench] fetch:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [agentType]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  // 点击结果项
  const handleResultPress = (item: TaskResultItem) => {
    if (isWorking(item.status)) {
      overlay.toast.info('正在执行中，请稍候');
      return;
    }
    if (isFailed(item.status)) {
      if (agentType === 'project_analysis' && item.extra?.project_id) {
        navigation.navigate('ProjectAnalysisReport', {
          reportId: item.id,
          projectId: String(item.extra.project_id),
          projectName: item.extra.project_name || '项目分析',
        });
        return;
      }
      overlay.toast.error('该任务已失败');
      return;
    }
    const config = AGENT_TYPE_MAP[agentType];
    if (!config?.navRoute) return;
    if (agentType === 'bid_writer') {
      const step = mapBidStatusToStep(item.status);
      navigation.navigate('BidWriter', { bidId: item.id, step });
    } else if (agentType === 'pile_compare') {
      navigation.navigate('PileComparison', { bidId: item.extra?.bid_id || item.id, reportId: item.extra?.report_id || item.id, initialRoute: 'ReportViewer' });
      return;
    } else if (agentType === 'project_finder') {
      navigation.navigate(config.navRoute, { taskId: item.id });
    } else if (agentType === 'project_analysis') {
      if (item.extra?.project_id) {
        navigation.navigate('ProjectAnalysisReport', {
          reportId: item.id,
          projectId: String(item.extra.project_id),
          projectName: item.extra.project_name || '项目分析',
        });
      }
    }
  };

  // 创建任务
  const handleCreateTask = () => {
    const config = AGENT_TYPE_MAP[agentType];
    if (agentType === 'project_analysis') {
      navigation.navigate('Home' as any, {});
      return;
    }
    if (config?.createRoute) {
      navigation.navigate(config.createRoute, {});
    }
  };

  // 找项目提交
  const handleSubmitProjectFinder = async () => {
    if (pfFields.length === 0) {
      overlay.toast.error('请至少选择一个项目领域');
      return;
    }
    setPfSubmitting(true);
    try {
      const filters = {
        province: '', city: '', fields: pfFields, customField: '',
        publishPeriod: pfPeriod, projectTypes: pfTypes,
        projectScale: pfScale, investmentAmount: pfInvest,
        customerTypes: pfCustomers, userAdvantage: '',
      };
      const res: any = await api.post('/api/agent-tasks/start', { agent_type: 'project_finder', filters });
      const taskId = res?.data?.id || res?.data?.task_id || '';
      if (taskId) {
        useAgentTaskStore.getState().markWorking('project_finder', '自动找项目分析中...', taskId);
        overlay.toast.success('任务已创建，智能体正在后台分析');
      } else {
        overlay.toast.error('创建任务失败');
        setPfSubmitting(false);
      }
    } catch {
      overlay.toast.error('网络错误，请重试');
      setPfSubmitting(false);
    }
  };

  // 日期格式
  const fmtDate = (d: string) => {
    if (!d) return '';
    try {
      const date = new Date(d);
      return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    } catch { return d; }
  };

  // ── 筛选Tab组件 ──
  const renderPfSection = (title: string, options: string[], selected: string[], onToggle: (v: string) => void) => (
    <View style={styles.pfSection}>
      <Text style={styles.pfSectionTitle}>{title}</Text>
      <View style={styles.pfOptions}>
        {options.map(opt => {
          const sel = selected.includes(opt);
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.pfChip, sel && styles.pfChipActive]}
              onPress={() => onToggle(opt)}
            >
              <Text style={[styles.pfChipText, sel && styles.pfChipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ── 结果项 ──
  const renderResultItem = ({ item }: { item: TaskResultItem }) => {
    const sl = statusLabel(item.status);
    return (
      <TouchableOpacity
        style={[
          styles.resultCard,
          isWorking(item.status) && styles.resultCardWorking,
          isFailed(item.status) && styles.resultCardFailed,
        ]}
        activeOpacity={isCompleted(item.status) ? 0.7 : 1}
        onPress={() => handleResultPress(item)}
      >
        <View style={styles.resultLeft}>
          <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.resultDate}>{fmtDate(item.created_at)}</Text>
        </View>
        <View style={[styles.statusTag, { backgroundColor: sl.color + '18' }]}>
          <View style={[styles.statusDot, { backgroundColor: sl.color }]} />
          <Text style={[styles.statusTagText, { color: sl.color }]}>{sl.text}</Text>
        </View>
        <ChevronRight size={14} color={DayColors.textTertiary} style={{ marginLeft: 4 }} />
      </TouchableOpacity>
    );
  };

  const isAvailable = ['bid_writer', 'pile_compare', 'project_finder', 'project_analysis'].includes(agentType);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── 顶栏 ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={DayColors.text} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerRow1}>
            <Text style={styles.headerName}>{agentName}</Text>
          </View>
          <View style={styles.headerRow2}>
            <Text style={styles.headerStat}>✅ {stats?.completedTasks ?? 0}</Text>
            <Text style={styles.headerStat}>
              ⚡ {(stats?.tokensConsumed ?? 0) >= 1000
                ? Math.round((stats?.tokensConsumed ?? 0) / 1000) + 'k'
                : (stats?.tokensConsumed ?? 0)} T
            </Text>
            <Text style={styles.headerStat}>
              💰 ¥{(() => {
                const v = (stats?.completedTasks ?? 0) * (stats?.valuePerTask ?? 0);
                return v >= 10000 ? (v / 10000).toFixed(1) + 'w' : v.toFixed(0);
              })()}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Tab ── */}
      <View style={styles.tabBar}>
        {([
          { key: 'results' as TabType, label: '输出结果' },
          { key: 'create' as TabType, label: '创建任务' },
        ]).map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {activeTab === tab.key && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── 内容区 ── */}
      <View style={styles.content}>
        {activeTab === 'results' ? (
          loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={agentColor} />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>暂无输出结果</Text>
              <Text style={styles.emptySub}>{agentName}还没有产出，点击"创建任务"开始</Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: agentColor }]}
                onPress={() => setActiveTab('create')}
              >
                <Text style={styles.emptyBtnText}>创建任务</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={item => item.id}
              renderItem={renderResultItem}
              contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => fetchResults(true)} tintColor={agentColor} />
              }
            />
          )
        ) : agentType === 'project_finder' ? (
          <View style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.pfHint}>AI 智能��将根据筛选条件，精准匹配并分析最适合您的项目</Text>
              {renderPfSection('🏗️ 项目领域', PF_FIELDS, pfFields, v => setPfFields(p => p.includes(v) ? p.filter(x => x !== v) : p.length >= 3 ? p : [...p, v]))}
              {renderPfSection('📅 发布期限', PF_PERIODS, [pfPeriod], v => setPfPeriod(pfPeriod === v ? '' : v))}
              {renderPfSection('🏛️ 项目类型', PF_TYPES, pfTypes, v => setPfTypes(p => p.includes(v) ? p.filter(x => x !== v) : p.length >= 2 ? p : [...p, v]))}
              {renderPfSection('📐 项目规模', PF_SCALES, [pfScale], v => setPfScale(pfScale === v ? '' : v))}
              {renderPfSection('💰 投资金额', PF_INVEST, [pfInvest], v => setPfInvest(pfInvest === v ? '' : v))}
              {renderPfSection('👤 客户类型', PF_CUSTOMERS, pfCustomers, v => setPfCustomers(p => p.includes(v) ? p.filter(x => x !== v) : p.length >= 3 ? p : [...p, v]))}
            </ScrollView>
            <View style={[styles.pfSubmitBar, { paddingBottom: insets.bottom + 16 }]}>
              <TouchableOpacity
                style={[styles.pfSubmitBtn, pfSubmitting && { opacity: 0.6 }]}
                disabled={pfSubmitting}
                onPress={handleSubmitProjectFinder}
              >
                <Text style={styles.pfSubmitText}>{pfSubmitting ? '正在找项目...' : '🔍 自动找项目'}</Text>
              </TouchableOpacity>
              <Text style={styles.pfSubmitHint}>预计耗时 30 分钟 ~ 2 小时</Text>
            </View>
          </View>
        ) : (
          <View style={styles.createContainerSimple}>
            <Text style={styles.createTitle}>{agentName}</Text>
            <Text style={agentType === 'project_analysis' ? styles.createDescSmall : styles.createDesc}>
              {agentType === 'bid_writer' ? '上传招标文件，一键生成高质量投标书'
                : agentType === 'pile_compare' ? '上传桩基资料，智能对比分析方案'
                  : agentType === 'project_analysis' ? '深度分析项目关系网络、机会洞察与战略建议'
                    : '功能即将开放，敬请期待'}
            </Text>
            {isAvailable ? (
              <TouchableOpacity
                style={[styles.createBtn, { backgroundColor: agentColor }]}
                onPress={handleCreateTask}
              >
                <Text style={styles.createBtnText}>
                  {agentType === 'bid_writer' ? '开始撰写标书'
                    : agentType === 'pile_compare' ? '开始桩基比选'
                      : agentType === 'project_analysis' ? '前往项目分析'
                        : '开始'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.createBtn, { backgroundColor: DayColors.surfaceSecondary }]}>
                <Text style={[styles.createBtnText, { color: DayColors.textTertiary }]}>即将开放</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DayColors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 10,
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: DayColors.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center',
  },
  headerInfo: { flex: 1, marginLeft: 12 },
  headerRow1: { flexDirection: 'row', alignItems: 'center' },
  headerName: { fontSize: 16, fontWeight: '700', color: DayColors.text },
  headerRow2: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  headerStat: { fontSize: 11, color: DayColors.textSecondary },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DayColors.border,
    paddingHorizontal: 16,
  },
  tab: { paddingVertical: 12, paddingHorizontal: 20, position: 'relative' },
  tabActive: {},
  tabText: { color: DayColors.textTertiary, fontSize: 14, fontWeight: '500' },
  tabTextActive: { color: DayColors.text, fontWeight: '700' },
  tabIndicator: {
    position: 'absolute', bottom: 0, left: 16, right: 16,
    height: 2, borderRadius: 1, backgroundColor: DayColors.text,
  },

  // Content
  content: { flex: 1 },

  // Loading
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: DayColors.textTertiary, marginTop: 12, fontSize: 13 },

  // Result card
  resultCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: DayColors.surface, borderRadius: 14,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: DayColors.border,
  },
  resultCardWorking: {
    backgroundColor: '#FFFBEB', borderColor: '#FDE68A',
  },
  resultCardFailed: {
    backgroundColor: '#FEF2F2', borderColor: '#FECACA',
  },
  resultLeft: { flex: 1 },
  resultTitle: { fontSize: 14, fontWeight: '600', color: DayColors.text, marginBottom: 4 },
  resultDate: { fontSize: 11, color: DayColors.textTertiary },
  statusTag: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTagText: { fontSize: 11, fontWeight: '600' },

  // Empty
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: DayColors.text, marginBottom: 8 },
  emptySub: { fontSize: 13, color: DayColors.textTertiary, textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: { marginTop: 20, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12 },
  emptyBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  // Create tab
  createContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  createContainerSimple: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, alignItems: 'center' },
  createCard: {
    backgroundColor: DayColors.surface, borderRadius: 20,
    padding: 32, alignItems: 'center',
    borderWidth: 1, borderColor: DayColors.border,
  },
  createTitle: { fontSize: 16, fontWeight: '600', color: DayColors.text, marginBottom: 8 },
  createDesc: { fontSize: 13, color: DayColors.textTertiary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  createDescSmall: { fontSize: 13, color: DayColors.textTertiary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  createBtn: { paddingVertical: 12, paddingHorizontal: 28, borderRadius: 14 },
  createBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  // 找项目表单
  pfHint: { fontSize: 12, color: DayColors.textTertiary, marginBottom: 12 },
  pfSection: { marginBottom: 14 },
  pfSectionTitle: { fontSize: 14, fontWeight: '700', color: DayColors.text, marginBottom: 8 },
  pfOptions: { flexDirection: 'row', flexWrap: 'wrap' },
  pfChip: {
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: 18,
    marginRight: 8, marginBottom: 8,
    backgroundColor: DayColors.surfaceSecondary,
    borderWidth: 1, borderColor: DayColors.border,
  },
  pfChipActive: {
    backgroundColor: `${DayColors.accent}15`,
    borderColor: DayColors.accent,
  },
  pfChipText: { fontSize: 13, color: DayColors.textSecondary },
  pfChipTextActive: { color: DayColors.accent, fontWeight: '600' },
  pfSubmitBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16,
    backgroundColor: DayColors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DayColors.border,
  },
  pfSubmitBtn: {
    backgroundColor: '#111827',
    borderRadius: 24, height: 48,
    justifyContent: 'center', alignItems: 'center',
  },
  pfSubmitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  pfSubmitHint: {
    fontSize: 11, color: DayColors.textTertiary,
    textAlign: 'center', marginTop: 6,
  },
});

export default AgentWorkbenchScreen;
