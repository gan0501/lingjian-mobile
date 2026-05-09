/**
 * TokenToast - 轻提示组件
 * 当 AI 工具步骤完成时，显示本轮消耗的 token 数
 * 
 * 使用方式:
 *   import { showTokenToast } from '@/components/TokenToast';
 *   showTokenToast({ stepName: '文件解析', tokensUsed: 12000 });
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ToastData {
  stepName: string;
  tokensUsed: number;
  id: number;
}

// 全局事件管理
type Listener = (data: ToastData) => void;
let _listener: Listener | null = null;
let _toastId = 0;

/**
 * 显示 Token 消耗轻提示
 */
export function showTokenToast(params: { stepName: string; tokensUsed: number }) {
  _toastId++;
  if (_listener) {
    _listener({
      ...params,
      id: _toastId,
    });
  }
}

function formatTokens(n: number): string {
  if (n >= 10000) {
    return `${(n / 10000).toFixed(1)}万`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return `${n}`;
}

/**
 * TokenToast 容器 —— 放在根布局中（App.tsx 或导航容器内）
 */
export function TokenToastContainer() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<NodeJS.Timeout | null>(null);

  const show = useCallback((data: ToastData) => {
    // 清除上次定时器
    if (hideTimer.current) clearTimeout(hideTimer.current);

    setToast(data);

    // 滑入 + 渐显
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // 3 秒后自动隐藏
    hideTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -80,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setToast(null));
    }, 3000);
  }, [slideAnim, opacityAnim]);

  useEffect(() => {
    _listener = show;
    return () => {
      _listener = null;
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [show]);

  if (!toast) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <LinearGradient
        colors={['rgba(30, 30, 46, 0.95)', 'rgba(40, 40, 58, 0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.toastBody}
      >
        <Text style={styles.icon}>⚡</Text>
        <View style={styles.textArea}>
          <Text style={styles.stepName}>{toast.stepName} 完成</Text>
          <Text style={styles.tokenText}>
            本轮消耗：<Text style={styles.tokenNumber}>{formatTokens(toast.tokensUsed)}</Text> tokens
          </Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 36,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  toastBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    maxWidth: SCREEN_WIDTH - 40,
    minWidth: 200,
    // 阴影
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  icon: {
    fontSize: 18,
    marginRight: 10,
  },
  textArea: {
    flex: 1,
  },
  stepName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  tokenText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  tokenNumber: {
    color: '#FFD700',
    fontWeight: '700',
    fontSize: 13,
  },
});
