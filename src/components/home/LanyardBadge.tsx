import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity, Easing, Platform } from 'react-native';
import { Icon } from '@/components/common';
import { Spacing, BorderRadius } from '@/constants/spacing';
import { FontSize, FontWeight } from '@/constants/typography';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const BADGE_WIDTH = 190;
const BADGE_HEIGHT = 290;
const STRING_LENGTH = SCREEN_HEIGHT * 0.25; 
const TOTAL_HEIGHT = BADGE_HEIGHT + STRING_LENGTH;

const BARCODE_WIDTHS = [2.5, 1.8, 3.2, 1.5, 2.8, 1.2, 3.5, 2.1, 1.9, 2.7, 1.4, 3.1, 2.3, 1.7, 2.9, 1.3, 3.3, 2.0, 1.6, 2.6, 1.1, 3.0];

export const LanyardBadge: React.FC = () => {
  const [visible, setVisible] = useState(true);
  
  const dropAnim = useRef(new Animated.Value(-SCREEN_HEIGHT)).current; 
  const swingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(dropAnim, {
      toValue: 0,
      friction: 5,
      tension: 35,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(swingAnim, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(swingAnim, { toValue: -1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(swingAnim, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    const timer = setTimeout(() => {
      dismiss();
    }, 4500);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.timing(dropAnim, {
      toValue: -(SCREEN_HEIGHT + 200),
      duration: 800,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start(() => {
      setVisible(false);
    });
  };

  if (!visible) return null;

  const interpolatedRotate = swingAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-5deg', '5deg']
  });

  return (
    <Animated.View 
      style={[
        styles.globalWrapper, 
        { 
          transform: [{ translateY: dropAnim }] 
        }
      ]}
      pointerEvents="box-none"
    >
      <Animated.View 
        style={[
          styles.pendulumContainer, 
          { 
            height: TOTAL_HEIGHT,
            transform: [
              { translateY: -TOTAL_HEIGHT / 2 },
              { rotate: interpolatedRotate },
              { translateY: TOTAL_HEIGHT / 2 }
            ]
          }
        ]}
      >
        <View style={styles.stringsWrapper}>
          <View style={styles.lanyardStrap} />
        </View>

        <TouchableOpacity activeOpacity={0.95} onPress={dismiss} style={styles.badgeWrapper}>
          <View style={styles.glassCard}>
            <View style={styles.clip} />
            <View style={styles.hole} />
            
            <View style={styles.brandRow}>
              <Icon name="hexagon" size={16} color="#38BDF8" />
              <Text style={styles.brandText}>LINGJIAN AI</Text>
            </View>

            <View style={styles.avatarBox}>
              <Icon name="sparkles" size={26} color="#C084FC" />
            </View>

            <Text style={styles.userName}>核心先行者</Text>
            <Text style={styles.userTitle}>高级工程智能体</Text>
            
            <View style={styles.barcodeBox}>
              <View style={styles.barcodeLines}>
                 {BARCODE_WIDTHS.map((width, i) => (
                    <View key={i} style={[styles.bar, { width }]} />
                 ))}
              </View>
              <Text style={styles.serial}>ID: LJ-AI-2025</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  globalWrapper: {
    position: 'absolute',
    top: -50,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    zIndex: 999,
    ...Platform.select({
      android: { elevation: 50 },
    }),
  },
  pendulumContainer: {
    width: BADGE_WIDTH,
    alignItems: 'center',
  },
  stringsWrapper: {
    height: STRING_LENGTH,
    alignItems: 'center',
    justifyContent: 'center',
    width: BADGE_WIDTH,
    marginTop: -20, 
  },
  lanyardStrap: {
    width: Spacing.base + 8,
    height: '100%',
    backgroundColor: '#FF3366',
    borderRadius: BorderRadius.xs,
  },
  badgeWrapper: {
    width: BADGE_WIDTH,
    height: BADGE_HEIGHT,
    marginTop: -Spacing.sm,
  },
  glassCard: {
    flex: 1,
    backgroundColor: 'rgba(250, 252, 255, 0.96)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    alignItems: 'center',
    shadowColor: '#C084FC',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  clip: {
    position: 'absolute',
    top: -Spacing.md,
    width: 44,
    height: 18,
    backgroundColor: '#E2E8F0',
    borderRadius: Spacing.sm,
    borderWidth: 1,
    borderColor: '#94A3B8',
    zIndex: 2,
  },
  hole: {
    width: Spacing.base + 8,
    height: 6,
    backgroundColor: '#CBD5E1',
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
    gap: Spacing.xs,
  },
  brandText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#0F172A',
    letterSpacing: 2,
  },
  avatarBox: {
    width: 76,
    height: 76,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(192, 132, 252, 0.1)',
    borderWidth: 2,
    borderColor: '#C084FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  userName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: '#0F172A',
    marginBottom: Spacing.xs,
  },
  userTitle: {
    fontSize: FontSize.sm,
    color: '#64748B',
    fontWeight: FontWeight.semibold,
    marginBottom: 'auto',
  },
  barcodeBox: {
    width: '100%',
    alignItems: 'center',
    marginTop: Spacing.base,
  },
  barcodeLines: {
    flexDirection: 'row',
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  bar: {
    height: '100%',
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.xs,
  },
  serial: {
    fontSize: FontSize.xs,
    color: '#94A3B8',
    fontWeight: FontWeight.bold,
    letterSpacing: 1.5,
  }
});
