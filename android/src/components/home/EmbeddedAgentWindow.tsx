/**
 * EmbeddedAgentWindow - 首页常驻的 3D 智能体视窗
 * 白色简洁风格 - 类似小米汽车App
 * 
 * 触摸逻辑：
 * - 用户触摸3D区域时，通过 onInteractionStart 通知父级禁用滚动
 * - 用户松手后，通过 onInteractionEnd 通知父级恢复滚动
 * - 这样WebView可以正常接收触摸事件来控制3D摄像头
 */
import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { FontWeight } from '@/constants/typography';
import { useAgentTaskStore } from '@/stores';
import type { AgentTaskInfo } from '@/stores';
import { AGENT_REGISTRY, AGENT_TYPE_MAP as AGENT_ID_TYPE_MAP } from '@/constants/agentConfig';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WINDOW_WIDTH = SCREEN_WIDTH;
const WINDOW_HEIGHT = 400;

const OFFICE_3D_URI = Platform.OS === 'android'
  ? 'file:///android_asset/agentOffice3D.html'
  : 'about:blank';

const ENTERPRISE_PARK_3D_URI = Platform.OS === 'android'
  ? 'file:///android_asset/enterpriseERP3D.html'
  : 'about:blank';

const HR_DEPT_3D_URI = Platform.OS === 'android'
  ? 'file:///android_asset/hrBuilding3D.html'
  : 'about:blank';

const DEFAULT_AGENTS = Object.entries(AGENT_REGISTRY).map(([agentType, cfg]) => ({
  id: cfg.id, name: cfg.name, role: cfg.role, status: 'idle' as const,
  color: cfg.color, icon: cfg.icon,
  stats: { completedTasks: 0, tokensConsumed: 0, tokenCostRmb: 0, valuePerTask: cfg.valuePerTask },
}));

const AGENT_TYPE_MAP: Record<string, string> = AGENT_ID_TYPE_MAP;

// ─── 呼吸红点 ───
const BreathingDot: React.FC<{ size?: number; color?: string }> = ({ size = 8, color = '#ef4444' }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.9, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.85, duration: 500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity, transform: [{ scale }] }} />
      <View style={{ width: size * 0.55, height: size * 0.55, borderRadius: size * 0.275, backgroundColor: color }} />
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════
interface EmbeddedAgentWindowProps {
  onPress?: () => void;
  onFloat?: () => void;
  onAgentListPress?: () => void;
  /** 用户开始触摸3D区域时调用（父级应禁用ScrollView滚动） */
  onInteractionStart?: () => void;
  /** 用户停止触摸3D区域时调用（父级应恢复ScrollView滚动） */
  onInteractionEnd?: () => void;
  /** 当前视窗模式：'personal' = 牛马视窗(红色), 'enterprise' = 企业视窗(蓝色) */
  mode?: 'personal' | 'enterprise';
  /** 点击牛马视窗按钮 - 切换到个人模式 */
  onPersonalPress?: () => void;
  /** 点击企业视窗按钮 - 切换到企业模式 */
  onEnterprisePress?: () => void;
  /** 企业视窗是否启用（v2暂未完成，禁用切换） */
  enterpriseEnabled?: boolean;
  /** 点击3D建筑时调用（企业视窗模式） */
  onBuildingClick?: (buildingName: string) => void;
  /** 当前部门（企业视窗模式下，null表示企业整体视图） */
  department?: string | null;
  /** 从部门场景返回企业整体视图 */
  onBackToOverview?: () => void;
}

const EmbeddedAgentWindow: React.FC<EmbeddedAgentWindowProps> = ({
  onPress,
  onFloat,
  onAgentListPress,
  onInteractionStart,
  onInteractionEnd,
  mode = 'personal',
  onPersonalPress,
  onEnterprisePress,
  enterpriseEnabled = false,
  onBuildingClick,
  department,
  onBackToOverview,
}) => {
  const getSceneUri = () => {
    if (mode === 'personal') {
      return OFFICE_3D_URI;
    }
    // 企业视窗模式下，department 为 null 时显示企业整体视图
    if (department === null || department === undefined) {
      return ENTERPRISE_PARK_3D_URI;
    }
    // 人事部门
    if (department === 'hr') {
      return HR_DEPT_3D_URI;
    }
    // 其他部门暂时使用企业园区场景（后续可添加独立3D场景）
    return ENTERPRISE_PARK_3D_URI;
  };
  // 主题颜色配置
  const theme = mode === 'personal' ? {
    primary: '#B20000',
    primaryLight: 'rgba(178, 0, 0, 0.1)',
    primaryBorder: 'rgba(178, 0, 0, 0.3)',
    lineColor: '#B20000', // 红色线条
  } : {
    primary: '#2563eb',
    primaryLight: 'rgba(37, 99, 235, 0.1)',
    primaryBorder: 'rgba(37, 99, 235, 0.3)',
    lineColor: '#2563eb', // 蓝色线条
  };
  const webviewRef = useRef<WebView>(null);
  const storeAgents = useAgentTaskStore(s => s.agents);

  // 开关按钮阻尼动画
  const switchScale = useRef(new Animated.Value(1)).current;
  // 使用 translateX 代替 left，因为原生动画不支持 left 属性
  const switchTranslateX = useRef(new Animated.Value(mode === 'personal' ? 2 : 16)).current;

  const handleSwitchPress = useCallback(() => {
    if (!enterpriseEnabled && mode === 'personal') {
      return;
    }

    Animated.sequence([
      Animated.spring(switchScale, {
        toValue: 0.9,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(switchScale, {
        toValue: 1,
        tension: 150,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    const targetPosition = mode === 'personal' ? 16 : 2;
    Animated.spring(switchTranslateX, {
      toValue: targetPosition,
      tension: 100,
      friction: 12,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      if (mode === 'personal') {
        onEnterprisePress?.();
      } else {
        onPersonalPress?.();
      }
    }, 100);
  }, [mode, onPersonalPress, onEnterprisePress, enterpriseEnabled, switchScale, switchTranslateX]);

  // 同步mode变化时的位置
  useEffect(() => {
    const targetPosition = mode === 'personal' ? 2 : 16;
    switchTranslateX.setValue(targetPosition);
  }, [mode, switchTranslateX]);

  const liveAgents = DEFAULT_AGENTS.map(agent => {
    const expectedType = AGENT_TYPE_MAP[agent.id];
    const live = storeAgents.find((d: AgentTaskInfo) =>
      d.id === agent.id || (expectedType && d.agent_type === expectedType)
    );
    if (live) {
      return {
        ...agent,
        status: live.status === 'working' ? 'working' : 'idle',
        stats: {
          ...agent.stats,
          completedTasks: live.completed_count ?? agent.stats.completedTasks,
          tokensConsumed: live.total_tokens ?? agent.stats.tokensConsumed,
        },
      };
    }
    return agent;
  });

  const workingCount = liveAgents.filter(a => a.status === 'working').length;
  const totalCount = liveAgents.length;
  const isWorking = workingCount > 0;

  const agentsJson = JSON.stringify(liveAgents);

  const sendAgents = useCallback(() => {
    const js = `AGENTS = ${agentsJson}; if(typeof window.buildCharacters === 'function') window.buildCharacters(); true;`;
    webviewRef.current?.injectJavaScript(js);
  }, [agentsJson]);

  useEffect(() => { sendAgents(); }, [sendAgents]);

  const handleWebMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'SCENE_READY') sendAgents();
      if (msg.action === 'building_click' && onBuildingClick) {
        onBuildingClick(msg.name);
      }
    } catch {}
  }, [sendAgents, onBuildingClick]);

  useEffect(() => {
    useAgentTaskStore.getState().fetchLiveStatus(true);
  }, []);

  return (
    <View style={styles.container}>
      {/* 3D 场景 - 通���触摸回调控制父级ScrollView */}
      <View
        style={styles.sceneContainer}
        onTouchStart={() => onInteractionStart?.()}
        onTouchEnd={() => onInteractionEnd?.()}
        onTouchCancel={() => onInteractionEnd?.()}
      >
        <WebView
          ref={webviewRef}
          style={styles.webview}
          source={{ uri: getSceneUri() }}
          javaScriptEnabled
          originWhitelist={['*']}
          scrollEnabled={false}
          mixedContentMode="always"
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          cacheEnabled={false}
          onMessage={handleWebMessage}
          onLoadEnd={() => setTimeout(sendAgents, 4000)}
          // Android 特有: 在 ScrollView 内的 WebView 需要此属性
          nestedScrollEnabled={true}
          overScrollMode="never"
        />

        {/* 返回按钮 - 企业视窗模式下，在部门场景时显示 */}
        {mode === 'enterprise' && !!department && onBackToOverview && (
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              backgroundColor: '#2563eb',
              borderRadius: 4,
              paddingHorizontal: 12,
              paddingVertical: 6,
              zIndex: 100,
            }}
            activeOpacity={0.8}
            onPress={onBackToOverview}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: FontWeight.bold }}>← 返回</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 底部状态栏 */}
      <View style={styles.statusBar}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: isWorking ? '#22c55e' : '#94a3b8' }]} />
          <Text style={styles.statusText}>
            {workingCount}/{totalCount}
          </Text>
          {/* 牛马列表入口 */}
          <TouchableOpacity 
            style={styles.agentListBtn}
            activeOpacity={0.7}
            onPress={onAgentListPress}
          >
            <Image source={require('@/assets/images/ai.png')} style={styles.agentListIcon} />
            <Text style={styles.agentListText}>牛马列表</Text>
          </TouchableOpacity>
        </View>
        {/* 滑动开关 - 牛马视窗/企业视窗 */}
        <View style={styles.switchContainer}>
          <Text style={[styles.switchLabel, { color: mode === 'personal' ? '#1e293b' : '#94a3b8' }]}>牛马视窗</Text>
          <TouchableOpacity
            style={[styles.switchTrack, !enterpriseEnabled && styles.switchTrackDisabled]}
            activeOpacity={enterpriseEnabled ? 0.9 : 1}
            onPress={handleSwitchPress}
          >
            <Animated.View
              style={[
                styles.switchThumb,
                {
                  backgroundColor: !enterpriseEnabled ? '#cbd5e1' : (mode === 'personal' ? '#B20000' : '#2563eb'),
                  transform: [
                    { translateX: switchTranslateX },
                    { scale: switchScale }
                  ],
                }
              ]}
            />
          </TouchableOpacity>
          <Text style={[styles.switchLabel, { color: !enterpriseEnabled ? '#cbd5e1' : (mode === 'enterprise' ? '#1e293b' : '#94a3b8') }]}>企业视窗</Text>
        </View>
      </View>
      
      {/* 主题线条 */}
      <View style={[styles.themeLine, { backgroundColor: theme.lineColor }]} />
      {/* 第二条细线 */}
      <View style={[styles.secondLine, { backgroundColor: theme.lineColor }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  sceneContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backButton: {
    position: 'absolute',
    top: 8,
    left: 60,
    backgroundColor: 'rgba(37, 99, 235, 0.9)',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: FontWeight.bold,
  },
  liveBadge: {
    position: 'absolute',
    top: 110,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 100,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFF',
  },
  statusBar: {
    height: 28,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: FontWeight.medium,
  },
  agentListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(178, 0, 0, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
    gap: 4,
  },
  agentListIcon: {
    width: 14,
    height: 14,
  },
  agentListText: {
    color: '#B20000',
    fontSize: 11,
    fontWeight: FontWeight.medium,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchLabel: {
    fontSize: 11,
    fontWeight: FontWeight.medium,
  },
  switchTrack: {
    width: 32,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchTrackDisabled: {
    backgroundColor: '#f1f5f9',
  },
  switchThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    position: 'absolute',
    top: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
    elevation: 2,
  },
  comingSoonText: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: FontWeight.medium,
    marginLeft: 2,
  },
  themeLine: {
    height: 4,
    width: '100%',
    marginTop: 16,
  },
  secondLine: {
    height: 1,
    width: '100%',
    marginTop: 5,
  },
});

export default EmbeddedAgentWindow;
