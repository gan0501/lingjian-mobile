/**
 * 自动找项目按钮 - 带跑马灯动效
 *
 * 运行状态：
 * - 边缘弥散光（多层柔和发光扩散）
 * - 光段沿边缘循环行走
 */
import React, { FC, memo, useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';

interface AnimatedFinderButtonProps {
  isRunning: boolean;
  onPress: () => void;
  children: React.ReactNode;
}

export const AnimatedFinderButton: FC<AnimatedFinderButtonProps> = memo(({
  isRunning,
  onPress,
  children,
}) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim1 = useRef(new Animated.Value(0)).current;
  const glowAnim2 = useRef(new Animated.Value(0)).current;
  const glowAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRunning) {
      // 跑马灯旋转动画 - 光段沿边缘行走
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      rotateAnimation.start();

      // 多层弥散光呼吸动画（错开相位，形成扩散波）
      const createPulse = (anim: Animated.Value, delay: number, duration: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: duration * 0.4,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: duration * 0.6,
              easing: Easing.in(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );

      const pulse1 = createPulse(glowAnim1, 0, 2000);
      const pulse2 = createPulse(glowAnim2, 400, 2000);
      const pulse3 = createPulse(glowAnim3, 800, 2000);

      pulse1.start();
      pulse2.start();
      pulse3.start();

      return () => {
        rotateAnimation.stop();
        pulse1.stop();
        pulse2.stop();
        pulse3.stop();
      };
    } else {
      rotateAnim.setValue(0);
      glowAnim1.setValue(0);
      glowAnim2.setValue(0);
      glowAnim3.setValue(0);
    }
  }, [isRunning]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.container}
    >
      {/* 弥散光背景 - 三层扩散波 */}
      {isRunning && (
        <>
          <Animated.View
            style={[
              styles.glow,
              styles.glowLayer1,
              {
                opacity: glowAnim1.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.5],
                }),
                transform: [{
                  scale: glowAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.25],
                  }),
                }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.glow,
              styles.glowLayer2,
              {
                opacity: glowAnim2.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.4],
                }),
                transform: [{
                  scale: glowAnim2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.35],
                  }),
                }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.glow,
              styles.glowLayer3,
              {
                opacity: glowAnim3.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.3],
                }),
                transform: [{
                  scale: glowAnim3.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.45],
                  }),
                }],
              },
            ]}
          />
        </>
      )}

      {/* 跑马灯环 - 光段沿边缘行走 */}
      {isRunning && (
        <Animated.View
          style={[
            styles.lightRing,
            { transform: [{ rotate: spin }] },
          ]}
        >
          {/* 主光段 - 边缘一小段弧形 */}
          <View style={styles.lightArc} />
        </Animated.View>
      )}

      {/* 按钮主体 */}
      <View style={styles.button}>
        {children}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 2,
  },
  glow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    zIndex: 0,
  },
  glowLayer1: {
    backgroundColor: 'rgba(255, 140, 0, 0.7)',
  },
  glowLayer2: {
    backgroundColor: 'rgba(255, 110, 0, 0.6)',
  },
  glowLayer3: {
    backgroundColor: 'rgba(255, 80, 0, 0.5)',
  },
  lightRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    zIndex: 1,
  },
  lightArc: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -6,
    width: 12,
    height: 4,
    backgroundColor: '#FFB800',
    borderRadius: 2,
    shadowColor: '#FFB800',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 6,
  },
});

export default AnimatedFinderButton;
