/**
 * AgentOfficeScreen V2 - 牛马列表
 *
 * 改动：
 * - 移除3D场景和底部弹窗
 * - 列表卡片直接展示完整信息（两层+分隔线）
 * - 上层：图标+名称+角色+状态
 * - 下层：完成任务 / 累计产值 / 实际消费 / 单任务成本
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Easing,
  Modal,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DayColors } from '@/constants';
import { AGENT_REGISTRY, AGENT_TYPE_MAP as AGENT_ID_TYPE_MAP } from '@/constants/agentConfig';
import { useOverlay } from '@/components/overlay';
import { useAuthStore, useAgentTaskStore } from '@/stores';
import type { AgentTaskInfo } from '@/stores';
import robotIcon from '@/assets/images/robot.png';

export interface AgentDef {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'working';
  color: string;
  icon: string;
  agentType?: string;
  task?: string;
  stats: {
    completedTasks: number;
    tokensConsumed: number;
    tokenCostRmb: number;
    valuePerTask: number;
  };
}

const DEFAULT_AGENTS: AgentDef[] = Object.entries(AGENT_REGISTRY).map(([agentType, cfg]) => ({
  id: cfg.id,
  name: cfg.name,
  role: cfg.role,
  status: 'idle' as const,
  color: cfg.color,
  icon: cfg.icon,
  stats: { completedTasks: 0, tokensConsumed: 0, tokenCostRmb: 0, valuePerTask: cfg.valuePerTask },
}));

const AGENT_TYPE_MAP: Record<string, string> = AGENT_ID_TYPE_MAP;

const fmtNum = (n: number): string => {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
};

const fmtRmb = (n: number): string => {
  if (n >= 10000) return '¥' + (n / 10000).toFixed(1) + 'w';
  return '¥' + n.toLocaleString();
};

const TypingDotsIndicator: React.FC = () => {
  const dot1 = useRef(new Animated.Value(0.2)).current;
  const dot2 = useRef(new Animated.Value(0.2)).current;
  const dot3 = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 350, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.2, duration: 350, easing: Easing.ease, useNativeDriver: true }),
        Animated.delay(600 - delay),
      ]));
    const a1 = pulse(dot1, 0); const a2 = pulse(dot2, 200); const a3 = pulse(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  const dotStyle = { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FFF', marginHorizontal: 1.5 };
  return (
    <View style={styles.typingBadge}>
      <Animated.View style={[dotStyle, { opacity: dot1 }]} />
      <Animated.View style={[dotStyle, { opacity: dot2 }]} />
      <Animated.View style={[dotStyle, { opacity: dot3 }]} />
    </View>
  );
};

const CancelConfirmModal: React.FC<{
  agent: AgentDef | null;
  onCancel: () => void;
  onConfirm: (agent: AgentDef) => void;
}> = ({ agent, onCancel, onConfirm }) => (
  <Modal visible={agent !== null} transparent animationType="fade">
    <View style={styles.cancelOverlay}>
      <View style={styles.cancelDialog}>
        <Text style={styles.cancelTitle}>⚠️ 确定终止任务？</Text>
        <Text style={styles.cancelDesc}>
          将终止「{agent?.name}」当前正在执行的任务。{'\n'}已完成的部分结果会被保留。
        </Text>
        <View style={styles.cancelBtns}>
          <TouchableOpacity style={styles.cancelBtnNo} onPress={onCancel}>
            <Text style={styles.cancelBtnNoText}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtnYes} onPress={() => agent && onConfirm(agent)}>
            <Text style={styles.cancelBtnYesText}>确认终止</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const AgentCard: React.FC<{
  agent: AgentDef;
  onPress: () => void;
  onLongPress: () => void;
  onCancelWorking: () => void;
}> = ({ agent, onPress, onLongPress, onCancelWorking }) => {
  const totalValue = agent.stats.completedTasks * agent.stats.valuePerTask;
  const costPerTask = agent.stats.completedTasks > 0 && agent.stats.tokenCostRmb > 0
    ? agent.stats.tokenCostRmb / agent.stats.completedTasks
    : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={[styles.agentCard, agent.status === 'working' && styles.agentCardWorking]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
    >
      {/* ── 上层：基本信息 ── */}
      <View style={styles.cardTop}>
        <TouchableOpacity
          style={[styles.agentIconCircle, { borderColor: agent.color, backgroundColor: agent.color + '15' }]}
          activeOpacity={agent.status === 'working' ? 0.6 : 1}
          onPress={(e) => {
            if (agent.status === 'working') {
              e.stopPropagation?.();
              onCancelWorking();
            }
          }}
        >
          <Image source={robotIcon} style={styles.agentIconImage} resizeMode="contain" />
          {agent.status === 'working' && <TypingDotsIndicator />}
        </TouchableOpacity>

        <View style={styles.agentInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.agentName}>{agent.name}</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: agent.status === 'working' ? '#DCFCE7' : DayColors.surfaceSecondary },
            ]}>
              {agent.status === 'working' && <View style={styles.statusDot} />}
              <Text style={[
                styles.statusText,
                { color: agent.status === 'working' ? '#16A34A' : DayColors.textTertiary },
              ]}>
                {agent.status === 'working' ? '工作中' : '空闲'}
              </Text>
            </View>
          </View>
          <Text style={styles.agentRole}>{agent.role}</Text>
          {agent.status === 'working' && agent.task ? (
            <Text style={styles.agentTask} numberOfLines={1}>↳ {agent.task}</Text>
          ) : null}
        </View>
      </View>

      {/* ── 分隔线 ── */}
      <View style={styles.cardDivider} />

      {/* ── 下层：数据指标 ── */}
      <View style={styles.cardBottom}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>完成任务</Text>
          <Text style={[styles.statValue, { color: '#22c55e' }]}>{fmtNum(agent.stats.completedTasks)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>累计产值</Text>
          <Text style={[styles.statValue, { color: agent.color }]}>{fmtRmb(totalValue)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>实际消费</Text>
          <Text style={[styles.statValue, { color: '#f59e0b' }]}>{fmtRmb(agent.stats.tokenCostRmb)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>单任务成本</Text>
          <Text style={styles.statValue}>{costPerTask > 0 ? fmtRmb(Math.round(costPerTask)) : '—'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const AgentOfficeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const overlay = useOverlay();

  const [cancelAgent, setCancelAgent] = useState<AgentDef | null>(null);

  const storeAgents = useAgentTaskStore(s => s.agents);
  const [liveAgents, setLiveAgents] = useState<AgentDef[]>(DEFAULT_AGENTS);

  useEffect(() => {
    useAgentTaskStore.getState().fetchLiveStatus(true);
  }, []);

  useEffect(() => {
    if (storeAgents.length === 0) {
      setLiveAgents(DEFAULT_AGENTS);
      return;
    }
    setLiveAgents(DEFAULT_AGENTS.map(agent => {
      const expectedType = AGENT_TYPE_MAP[agent.id];
      const live = storeAgents.find((d: AgentTaskInfo) =>
        d.id === agent.id || (expectedType && d.agent_type === expectedType)
      );
      if (live) {
        return {
          ...agent,
          status: live.status === 'working' ? 'working' : 'idle',
          task: live.task || '',
          stats: {
            ...agent.stats,
            completedTasks: live.completed_count ?? agent.stats.completedTasks,
            tokensConsumed: live.total_tokens ?? agent.stats.tokensConsumed,
            tokenCostRmb: live.token_cost ?? agent.stats.tokenCostRmb,
            valuePerTask: live.value_per_task ?? agent.stats.valuePerTask,
          },
        } as AgentDef;
      }
      return agent;
    }));
  }, [storeAgents]);

  const handleAgentPress = useCallback((agent: AgentDef) => {
    const { isLoggedIn } = useAuthStore.getState();
    if (!isLoggedIn) {
      navigation.navigate('Login');
      return;
    }
    const agentType = AGENT_TYPE_MAP[agent.id] || '';
    navigation.navigate('AgentWorkbench', {
      agentId: agent.id,
      agentName: agent.name,
      agentType,
      agentIcon: agent.icon,
      agentColor: agent.color,
    });
  }, [navigation]);

  const handleAgentLongPress = useCallback((agent: AgentDef) => {
    const agentType = AGENT_TYPE_MAP[agent.id] || '';
    navigation.navigate('AgentWorkbench', {
      agentId: agent.id,
      agentName: agent.name,
      agentType,
      agentIcon: agent.icon,
      agentColor: agent.color,
    });
  }, [navigation]);

  const handleCancelTask = useCallback(async (agent: AgentDef) => {
    setCancelAgent(null);
    try {
      const agentType = AGENT_TYPE_MAP[agent.id] || 'project_finder';
      const api = require('@/services/api').default;
      await api.put('/api/agent-tasks/cancel', null, { params: { agent_type: agentType } });
      overlay.toast.success(`${agent.name} 的任务已终止`);
      useAgentTaskStore.getState().markIdle(agentType);
    } catch {
      overlay.toast.error('终止失败，请重试');
    }
  }, [overlay]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={[styles.header, { paddingTop: 12 }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={DayColors.text} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>牛马列表</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.listContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      >
        {liveAgents.map(agent => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onPress={() => handleAgentPress(agent)}
            onLongPress={() => handleAgentLongPress(agent)}
            onCancelWorking={() => setCancelAgent(agent)}
          />
        ))}
      </ScrollView>

      <CancelConfirmModal
        agent={cancelAgent}
        onCancel={() => setCancelAgent(null)}
        onConfirm={handleCancelTask}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DayColors.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    minHeight: 56,
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: DayColors.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: {
    flex: 1, alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17, fontWeight: '700', color: DayColors.text,
  },

  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },

  agentCard: {
    backgroundColor: DayColors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: DayColors.border,
  },
  agentCardWorking: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  agentIconCircle: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  agentIconImage: {
    width: 48,
    height: 48,
  },
  agentInfo: {
    flex: 1, marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agentName: {
    fontSize: 16, fontWeight: '700', color: DayColors.text,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, gap: 4,
  },
  statusDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  statusText: {
    fontSize: 11, fontWeight: '600',
  },
  agentRole: {
    fontSize: 12, color: DayColors.textTertiary, marginTop: 2,
  },
  agentTask: {
    fontSize: 11, color: '#f59e0b', marginTop: 2,
  },

  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DayColors.border,
    marginVertical: 12,
  },

  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10, color: DayColors.textTertiary, marginBottom: 4,
  },
  statValue: {
    fontSize: 14, fontWeight: '700', color: DayColors.text,
  },
  statDivider: {
    width: 1, height: 28,
    backgroundColor: DayColors.border,
  },

  typingBadge: {
    position: 'absolute', bottom: -4,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6, padding: 3,
  },

  cancelOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  cancelDialog: {
    width: '80%',
    backgroundColor: DayColors.surface,
    borderRadius: 20,
    padding: 24,
  },
  cancelTitle: {
    fontSize: 17, fontWeight: '700', color: DayColors.text,
    textAlign: 'center', marginBottom: 12,
  },
  cancelDesc: {
    fontSize: 14, color: DayColors.textSecondary,
    textAlign: 'center', lineHeight: 20, marginBottom: 20,
  },
  cancelBtns: {
    flexDirection: 'row', gap: 12,
  },
  cancelBtnNo: {
    flex: 1, paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: DayColors.surfaceSecondary,
    alignItems: 'center',
  },
  cancelBtnNoText: {
    fontSize: 14, fontWeight: '600', color: DayColors.text,
  },
  cancelBtnYes: {
    flex: 1, paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },
  cancelBtnYesText: {
    fontSize: 14, fontWeight: '600', color: '#FFF',
  },
});

export default AgentOfficeScreen;
