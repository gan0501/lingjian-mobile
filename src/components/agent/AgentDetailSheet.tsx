/**
 * AgentDetailSheet V2 - 智能体详情面板（含产值估算）
 *
 * 从V1的AgentDetailModal迁移，主要改动：
 * - DayMode亮色主题
 * - 使用 useAgentTaskStore 获取实时状态
 * - useOverlay 替代 Alert
 * - API数据带缓存
 *
 * 展示内容：
 * 1. 核心价值横幅（累计产值 + ROI）
 * 2. 工作概况（入职时长、完成任务、Token消耗、进化轮次）
 * 3. 质量指标（完成率、采纳率、故障率环形图）
 * 4. Token 经济（单任务消耗/成本/产值）
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { X, ExternalLink } from 'lucide-react-native';
import { DayColors } from '@/constants';
import { AGENT_TYPE_MAP } from '@/stores';
import api from '@/services/api';

const { height: SH, width: SW } = Dimensions.get('window');

// ── 统计数据接口 ──
export interface AgentStats {
  tenureDays: number;
  completedTasks: number;
  tokensConsumed: number;
  tokenCostRmb: number;
  valuePerTask: number;
  failureCount: number;
  completionRate: number;
  generationsCount: number;
  downloadsCount: number;
  evolutionRounds: number;
}

export interface AgentForDetail {
  id: string;
  name: string;
  role: string;
  color: string;
  status: 'working' | 'idle';
  task?: string;
  icon?: string;
  agentType?: string;
  stats?: Partial<AgentStats>;
}

// ── 缓存 ──
const statsCache: Record<string, { data: AgentStats; timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000;

// ── 格式化 ──
const fmtNum = (n: number): string => {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
};
const fmtRmb = (n: number): string => {
  if (n >= 10000) return '¥' + (n / 10000).toFixed(1) + 'w';
  return '¥' + n.toLocaleString();
};
const fmtDays = (d: number): string => {
  if (d >= 365) return Math.floor(d / 365) + '年' + (d % 365) + '天';
  return d + ' 天';
};

const getAgentType = (agent: AgentForDetail): string => {
  if (agent.agentType) return agent.agentType;
  const map: Record<string, string> = { '1': 'bid_writer', '2': 'pile_compare', '3': 'project_finder', '4': 'enterprise_insight', '5': 'personnel', '6': 'supplier' };
  return map[agent.id] || '';
};

// ── 环形进度条 ──
const RingProgress: React.FC<{ value: number; color: string; size?: number }> = ({ value, color, size = 52 }) => {
  const clr = value > 0 ? color : color + '40';
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        borderWidth: 4, borderColor: DayColors.border,
      }} />
      <View style={{
        position: 'absolute', width: size - 8, height: size - 8, borderRadius: (size - 8) / 2,
        borderWidth: 4, borderColor: clr,
        borderTopColor: value > 75 ? clr : value > 0 ? 'transparent' : clr,
        borderRightColor: value > 50 ? clr : value > 0 ? 'transparent' : clr,
        borderBottomColor: value > 25 ? clr : value > 0 ? 'transparent' : clr,
        borderLeftColor: clr,
        transform: [{ rotate: `${(value / 100) * 360 - 90}deg` }],
        opacity: 0.9,
      }} />
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{value}%</Text>
    </View>
  );
};

// ── 指标卡 ──
const MetricCard: React.FC<{
  label: string; value: string; sub?: string; icon: string; color: string; highlight?: boolean;
}> = ({ label, value, sub, icon, color, highlight }) => (
  <View style={[styles.metricCard, highlight && { borderColor: color, borderWidth: 1.5 }]}>
    <View style={[styles.metricIcon, { backgroundColor: color + '18' }]}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
    </View>
    <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
    {sub ? <Text style={styles.metricSub} numberOfLines={1}>{sub}</Text> : null}
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

// ══════════════════════════════════════════════���════
// 主组件
// ═══════════════════════════════════════════════════
interface Props {
  agent: AgentForDetail | null;
  visible: boolean;
  onClose: () => void;
}

export const AgentDetailSheet: React.FC<Props> = ({ agent, visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const slideAnim = useRef(new Animated.Value(SH)).current;
  const [realStats, setRealStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(false);

  // 打开时拉取真实数据（带缓存）
  useEffect(() => {
    if (visible && agent) {
      const agentType = getAgentType(agent);
      if (!agentType) return;

      const cached = statsCache[agentType];
      const now = Date.now();
      if (cached && now - cached.timestamp < CACHE_DURATION) {
        setRealStats(cached.data);
        setLoading(false);
        return;
      }

      setLoading(true);
      api.get(`/api/agent-tasks/agent-stats/${agentType}`)
        .then((res: any) => {
          const data = res?.data ?? res;
          if (data) {
            statsCache[agentType] = { data, timestamp: now };
            setRealStats(data);
          }
        })
        .catch(() => { if (cached) setRealStats(cached.data); })
        .finally(() => setLoading(false));
    }
  }, [visible, agent?.id]);

  // 动画
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SH, duration: 260, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!agent) return null;

  const s = realStats || (agent.stats as AgentStats) || null;
  const adoptionRate = s && s.generationsCount > 0 ? Math.round((s.downloadsCount / s.generationsCount) * 100) : 0;
  const totalValue = s ? s.completedTasks * s.valuePerTask : 0;
  const color = agent.color || '#3b82f6';
  const isWorking = agent.status === 'working';
  const agentType = getAgentType(agent);
  const config = AGENT_TYPE_MAP[agentType];

  const handleViewTasks = () => {
    onClose();
    if (config?.createRoute) navigation.navigate(config.createRoute as any);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <View style={[styles.agentAvatar, { backgroundColor: color + '18', borderColor: color }]}>
            <Text style={{ fontSize: 26 }}>{agent.icon || '🤖'}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.sheetName}>{agent.name}</Text>
              <View style={[styles.statusBadge, {
                backgroundColor: isWorking ? 'rgba(34,197,94,0.12)' : DayColors.surfaceSecondary,
              }]}>
                {isWorking && <View style={styles.statusDotGreen} />}
                <Text style={[styles.statusBadgeText, { color: isWorking ? '#22c55e' : DayColors.textTertiary }]}>
                  {isWorking ? '工作中' : '空闲'}
                </Text>
              </View>
            </View>
            <Text style={styles.sheetRole}>{agent.role}</Text>
            {isWorking && agent.task && (
              <Text style={styles.sheetTask} numberOfLines={1}>↳ {agent.task}</Text>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={16} color={DayColors.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {loading && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={color} />
            <Text style={{ color: DayColors.textTertiary, marginTop: 12, fontSize: 13 }}>加载统计数据...</Text>
          </View>
        )}

        {!loading && (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
            showsVerticalScrollIndicator={false}
          >
            {/* ═══ 核心价值横幅 ═══ */}
            <View style={[styles.valueBanner, { backgroundColor: color + '0A', borderColor: color + '25' }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.valueBannerLabel}>💰 累计创造价值</Text>
                <Text style={[styles.valueBannerAmount, { color }]}>{fmtRmb(totalValue)}</Text>
                <Text style={styles.valueBannerSub}>
                  {s ? `${fmtNum(s.completedTasks)} 任务 × ${fmtRmb(s.valuePerTask)}/任务` : '暂无数据'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.valueBannerLabel}>📊 ROI</Text>
                <Text style={[styles.valueBannerAmount, { color: '#f59e0b', fontSize: 22 }]}>
                  {s && s.tokenCostRmb > 0 ? (totalValue / s.tokenCostRmb).toFixed(0) + 'x' : '—'}
                </Text>
                <Text style={styles.valueBannerSub}>投入产出比</Text>
              </View>
            </View>

            {/* ═══ 工作概况 ═══ */}
            <Text style={styles.sectionTitle}>📋 工作概况</Text>
            <View style={styles.metricGrid}>
              <MetricCard label="入职时长" value={s ? fmtDays(s.tenureDays) : '—'} icon="🗓️" color="#6366f1" highlight />
              <MetricCard label="完成任务" value={s ? fmtNum(s.completedTasks) : '—'} icon="✅" color="#22c55e" />
              <MetricCard label="���耗 Token" value={s ? fmtNum(s.tokensConsumed) : '—'} sub={s ? `≈${fmtRmb(s.tokenCostRmb)}` : undefined} icon="⚡" color="#f59e0b" />
              <MetricCard label="进化轮次" value={s ? s.evolutionRounds + ' 轮' : '—'} sub="自我学习次数" icon="🧬" color="#a855f7" highlight />
            </View>

            {/* ═══ 质量指标 ═══ */}
            <Text style={styles.sectionTitle}>🎯 质量指标</Text>
            <View style={styles.rateRow}>
              <View style={styles.rateCard}>
                <RingProgress value={s ? s.completionRate : 0} color="#22c55e" />
                <Text style={styles.rateLabel}>完成率</Text>
                <Text style={styles.rateSub}>执行成功比例</Text>
              </View>
              <View style={styles.rateCard}>
                <RingProgress value={adoptionRate} color="#3b82f6" />
                <Text style={styles.rateLabel}>采纳率</Text>
                <Text style={styles.rateSub}>{s ? `${fmtNum(s.downloadsCount)}/${fmtNum(s.generationsCount)}` : '下载/生成'}</Text>
              </View>
              <View style={styles.rateCard}>
                <RingProgress
                  value={s && s.completedTasks > 0 ? Math.round((s.failureCount / (s.completedTasks + s.failureCount)) * 100) : 0}
                  color="#ef4444"
                />
                <Text style={styles.rateLabel}>故障率</Text>
                <Text style={styles.rateSub}>{s ? `${s.failureCount} 次故障` : '—'}</Text>
              </View>
            </View>

            {/* ═══ Token 经济 ═══ */}
            <Text style={styles.sectionTitle}>💵 Token 经济</Text>
            <View style={styles.tokenRow}>
              <View style={styles.tokenItem}>
                <Text style={styles.tokenLabel}>单任务消耗</Text>
                <Text style={styles.tokenValue}>
                  {s && s.completedTasks > 0 ? fmtNum(Math.round(s.tokensConsumed / s.completedTasks)) + ' T' : '—'}
                </Text>
              </View>
              <View style={styles.tokenDivider} />
              <View style={styles.tokenItem}>
                <Text style={styles.tokenLabel}>单任务成本</Text>
                <Text style={styles.tokenValue}>
                  {s && s.completedTasks > 0 ? fmtRmb(Math.round(s.tokenCostRmb / s.completedTasks)) : '—'}
                </Text>
              </View>
              <View style={styles.tokenDivider} />
              <View style={styles.tokenItem}>
                <Text style={styles.tokenLabel}>单任务产值</Text>
                <Text style={[styles.tokenValue, { color: '#22c55e' }]}>
                  {s ? fmtRmb(s.valuePerTask) : '—'}
                </Text>
              </View>
            </View>

            {/* ═══ 查看任务按钮 ═══ */}
            {config?.createRoute ? (
              <TouchableOpacity
                style={[styles.viewTasksBtn, { backgroundColor: color }]}
                onPress={handleViewTasks}
                activeOpacity={0.8}
              >
                <ExternalLink size={16} color="#FFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                <Text style={styles.viewTasksBtnText}>查看任务</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SH * 0.82,
    backgroundColor: DayColors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 20,
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4, borderRadius: 2,
    backgroundColor: DayColors.border, marginTop: 10, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14,
  },
  agentAvatar: {
    width: 54, height: 54, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  sheetName: { color: DayColors.text, fontSize: 18, fontWeight: '700' },
  sheetRole: { color: DayColors.textTertiary, fontSize: 12, marginTop: 2 },
  sheetTask: { color: DayColors.textTertiary, fontSize: 11, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, gap: 4,
  },
  statusDotGreen: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#22c55e' },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  closeBtn: {
    width: 32, height: 32, backgroundColor: DayColors.surfaceSecondary,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: DayColors.border },

  // Value banner
  valueBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 18,
  },
  valueBannerLabel: { color: DayColors.textTertiary, fontSize: 11, marginBottom: 2 },
  valueBannerAmount: { fontSize: 26, fontWeight: '800', color: DayColors.text },
  valueBannerSub: { color: DayColors.textTertiary, fontSize: 11, marginTop: 2 },

  // Section
  sectionTitle: {
    color: DayColors.textTertiary, fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
  },

  // Metric grid
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  metricCard: {
    width: (SW - 48) / 2, backgroundColor: DayColors.surfaceSecondary,
    borderRadius: 12, padding: 12, borderWidth: 1, borderColor: DayColors.border, gap: 2,
  },
  metricIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  metricValue: { color: DayColors.text, fontSize: 20, fontWeight: '700' },
  metricSub: { color: DayColors.textTertiary, fontSize: 11 },
  metricLabel: { color: DayColors.textSecondary, fontSize: 11, marginTop: 2 },

  // Rate cards
  rateRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  rateCard: {
    flex: 1, backgroundColor: DayColors.surfaceSecondary, borderRadius: 12,
    padding: 12, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: DayColors.border,
  },
  rateLabel: { color: DayColors.text, fontSize: 13, fontWeight: '600' },
  rateSub: { color: DayColors.textTertiary, fontSize: 10, textAlign: 'center', marginTop: 4 },

  // Token row
  tokenRow: {
    flexDirection: 'row', backgroundColor: DayColors.surfaceSecondary,
    borderRadius: 12, padding: 14, marginBottom: 18,
    borderWidth: 1, borderColor: DayColors.border,
  },
  tokenItem: { flex: 1, alignItems: 'center', gap: 4 },
  tokenLabel: { color: DayColors.textTertiary, fontSize: 11 },
  tokenValue: { color: DayColors.text, fontSize: 16, fontWeight: '700' },
  tokenDivider: { width: 1, backgroundColor: DayColors.border, marginHorizontal: 4 },

  // View tasks button
  viewTasksBtn: {
    marginTop: 8, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  viewTasksBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default AgentDetailSheet;
