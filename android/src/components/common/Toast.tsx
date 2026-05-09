import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius } from '@/constants/spacing';
import { FontSize } from '@/constants/typography';

const { width: screenWidth } = Dimensions.get('window');

type ToastType = 'success' | 'error' | 'info';

interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number;
  position?: 'top' | 'bottom';
}

let toastRef: { show: (config: ToastConfig) => void } | null = null;

export const Toast: React.FC = () => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const [visible, setVisible] = React.useState(false);
  const [config, setConfig] = React.useState<ToastConfig>({ message: '' });

  useEffect(() => {
    toastRef = { show: (c) => show(c) };
    return () => { toastRef = null; };
  }, []);

  const show = ({ message, type = 'info', duration = 2000, position = 'top' }: ToastConfig) => {
    setConfig({ message, type, position });
    setVisible(true);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
      ]).start(() => setVisible(false));
    }, duration);
  };

  if (!visible) return null;

  const bgColor = {
    success: '#10B981',
    error: '#EF4444',
    info: Colors.primary[500],
  }[config.type || 'info'];

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY }], backgroundColor: bgColor }]}>
      <Text style={styles.text}>{config.message}</Text>
    </Animated.View>
  );
};

export const showToast = (message: string, type?: ToastType, duration?: number) => {
  toastRef?.show({ message, type, duration });
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: Spacing.lg,
    right: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    zIndex: 9999,
  },
  text: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
});
