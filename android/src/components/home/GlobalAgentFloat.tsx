/**
 * GlobalAgentFloat - 跨页面悬浮 3D 智能体窗口
 *
 * 挂载在 RootNavigator 最顶层，悬浮在所有页面之上。
 * 用户离开首页后，可以通过此浮窗实时监控智能体状态。
 *
 * 特性：
 * - 可拖拽移动（PanResponder）
 * - 点击 ⛶ 全屏 → navigate('AgentOffice')
 * - 点击 ✕ → 关闭浮窗
 * - 实时显示工作中/总数
 * - WebView 3D 场景缩略图
 */
import React, { useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Maximize2, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useAgentWindowStore, useAgentTaskStore } from '@/stores';
import type { AgentTaskInfo } from '@/stores';
import { AGENT_REGISTRY, AGENT_TYPE_MAP as AGENT_ID_TYPE_MAP } from '@/constants/agentConfig';

const { width: SW, height: SH } = Dimensions.get('window');
const MINI_W = 200;
const MINI_H = 140;

const OFFICE_3D_URI = Platform.OS === 'android'
  ? 'file:///android_asset/agentOffice3D.html'
  : 'about:blank';

const DEFAULT_AGENTS = Object.entries(AGENT_REGISTRY).map(([agentType, cfg]) => ({
  id: cfg.id, name: cfg.name, status: 'idle', color: cfg.color, icon: cfg.icon,
}));

const AGENT_TYPE_MAP: Record<string, string> = AGENT_ID_TYPE_MAP;

// ─── 呼吸红点 ───
const BreathingDot: React.FC<{ size?: number }> = ({ size = 6 }) => {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#ef4444', opacity: anim,
    }} />
  );
};

// ═══════════════════════════════════════════════════════════
const GlobalAgentFloat: React.FC = () => {
  const floatVisible = useAgentWindowStore(s => s.floatVisible);
  const hideFloat = useAgentWindowStore(s => s.hideFloat);
  const enterFullFromFloat = useAgentWindowStore(s => s.enterFullFromFloat);
  const navigation = useNavigation<any>();
  const webviewRef = useRef<WebView>(null);

  // ── 实时状态 ──
  const storeAgents = useAgentTaskStore(s => s.agents);

  const liveAgents = DEFAULT_AGENTS.map(agent => {
    const expectedType = AGENT_TYPE_MAP[agent.id];
    const live = storeAgents.find((d: AgentTaskInfo) =>
      d.id === agent.id || (expectedType && d.agent_type === expectedType)
    );
    return live
      ? { ...agent, status: live.status === 'working' ? 'working' : 'idle' }
      : agent;
  });

  const workingCount = liveAgents.filter(a => a.status === 'working').length;
  const totalCount = liveAgents.length;

  // ── WebView 同步 ──
  const agentsJson = JSON.stringify(liveAgents);

  const sendAgents = useCallback(() => {
    const js = `AGENTS = ${agentsJson}; if(typeof window.buildCharacters === 'function') window.buildCharacters(); true;`;
    webviewRef.current?.injectJavaScript(js);
  }, [agentsJson]);

  useEffect(() => {
    if (floatVisible) sendAgents();
  }, [floatVisible, sendAgents]);

  // ── 拖拽 ──
  const pan = useRef(new Animated.ValueXY({ x: SW - MINI_W - 16, y: 100 })).current;
  const panValue = useRef({ x: SW - MINI_W - 16, y: 100 });

  useEffect(() => {
    const lx = pan.x.addListener(({ value }) => { panValue.current.x = value; });
    const ly = pan.y.addListener(({ value }) => { panValue.current.y = value; });
    return () => { pan.x.removeListener(lx); pan.y.removeListener(ly); };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5,
      onPanResponderGrant: () => {
        pan.setOffset({ x: panValue.current.x, y: panValue.current.y });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const cx = Math.max(0, Math.min(panValue.current.x, SW - MINI_W));
        const cy = Math.max(StatusBar.currentHeight ?? 24, Math.min(panValue.current.y, SH - MINI_H - 80));
        pan.setValue({ x: cx, y: cy });
      },
    })
  ).current;

  // ── 全屏 ──
  const handleExpand = () => {
    enterFullFromFloat();
    navigation.navigate('AgentOffice');
  };

  if (!floatVisible) return null;

  return (
    <Animated.View
      style={[styles.floatWindow, { transform: pan.getTranslateTransform() }]}
      {...panResponder.panHandlers}
    >
      {/* 拖拽把手 */}
      <View style={styles.dragHandle}>
        <View style={styles.dragBar} />
      </View>

      {/* 3D 场景 */}
      <View style={styles.sceneContainer}>
        <WebView
          ref={webviewRef}
          style={styles.webview}
          source={{ uri: OFFICE_3D_URI }}
          scrollEnabled={false}
          javaScriptEnabled
          originWhitelist={['*']}
          mixedContentMode="always"
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          onMessage={(event) => {
            try {
              const msg = JSON.parse(event.nativeEvent.data);
              if (msg.type === 'SCENE_READY') sendAgents();
            } catch {}
          }}
          onLoadEnd={() => setTimeout(sendAgents, 3000)}
        />
        {/* 实时标记 */}
        <View style={styles.liveBadge}>
          <BreathingDot size={5} />
          <Text style={styles.liveLabel}>实时</Text>
        </View>
      </View>

      {/* 底部控制栏 */}
      <View style={styles.toolbar}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: workingCount > 0 ? '#22c55e' : '#6b7280' }]} />
          <Text style={styles.statusText}>{workingCount}/{totalCount} 工作中</Text>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={handleExpand} style={styles.actionBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Maximize2 size={13} color="#FFF" strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity onPress={hideFloat} style={styles.actionBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={13} color="#FFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  floatWindow: {
    position: 'absolute',
    width: MINI_W,
    height: MINI_H,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    zIndex: 9999,
  },
  dragHandle: {
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dragBar: {
    width: 28, height: 3, borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  sceneContainer: {
    flex: 1, position: 'relative',
  },
  webview: {
    flex: 1, backgroundColor: 'transparent',
  },
  liveBadge: {
    position: 'absolute', top: 4, left: 4,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  liveLabel: {
    fontSize: 8, fontWeight: '700', color: '#FFF',
  },
  toolbar: {
    height: 26,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  statusDot: {
    width: 5, height: 5, borderRadius: 2.5,
  },
  statusText: {
    fontSize: 10, fontWeight: '600', color: '#FFF',
  },
  actionRow: {
    flexDirection: 'row', gap: 8,
  },
  actionBtn: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default GlobalAgentFloat;
