/**
 * GlassToast - 统一轻提示组件（V2）
 *
 * 液态玻璃风格浮层提示，自动消失。
 *
 * 类型：success / error / loading / info
 * 位置：屏幕顶部安全区下方
 */
import React, { FC, memo, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X, AlertCircle, Info } from 'lucide-react-native';

export type ToastType = 'success' | 'error' | 'loading' | 'info';

interface GlassToastProps {
  visible: boolean;
  type?: ToastType;
  message: string;
  duration?: number;
  onDismiss?: () => void;
  position?: 'top' | 'center';
  theme?: 'light' | 'dark';
}

const ICON_MAP: Record<ToastType, { icon: any; color: string }> = {
  success: { icon: Check, color: '#22C55E' },
  error: { icon: X, color: '#EF4444' },
  info: { icon: Info, color: '#3B82F6' },
  loading: { icon: null, color: '#666' },
};

export const GlassToast: FC<GlassToastProps> = memo(({
  visible, type = 'info', message,
  duration = 2000, onDismiss,
  position = 'top', theme = 'light',
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout>();

  const isDark = theme === 'dark';

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, friction: 8, tension: 70, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      if (type !== 'loading' && duration > 0) {
        timerRef.current = setTimeout(() => {
          dismiss();
        }, duration);
      }
    } else {
      dismiss();
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visible]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -100, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss?.());
  };

  if (!visible && !message) return null;

  const iconConfig = ICON_MAP[type];
  const IconComponent = iconConfig.icon;

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'top'
          ? { top: insets.top + 12 }
          : { top: '40%' },
        {
          opacity,
          transform: [{ translateY: position === 'top' ? translateY : new Animated.Value(0) }],
          backgroundColor: isDark ? 'rgba(30, 30, 30, 0.92)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        },
      ]}
      pointerEvents="none"
    >
      {/* 图标 */}
      <View style={[styles.iconBox, { backgroundColor: iconConfig.color + '18' }]}>
        {type === 'loading' ? (
          <ActivityIndicator size="small" color={isDark ? '#fff' : '#333'} />
        ) : IconComponent ? (
          <IconComponent color={iconConfig.color} size={14} />
        ) : null}
      </View>

      {/* 文字 */}
      <Text
        style={[styles.text, { color: isDark ? '#fff' : '#1a1a1a' }]}
        numberOfLines={2}
      >
        {message}
      </Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: '90%',
    minWidth: 160,
    zIndex: 9999,
    elevation: 30,
    // 液态玻璃阴影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
});

export default GlassToast;
