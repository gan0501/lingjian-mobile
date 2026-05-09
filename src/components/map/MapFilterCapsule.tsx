/**
 * 地图筛选胶囊组件（日间版）
 *
 * 右侧悬浮筛选按钮。
 * 收起状态有呼吸灯效果，点击展开显示筛选项列表。
 * 3秒无操作自动收起。
 *
 * 设计规范：
 * - 默认全选，图标清晰显示（无遮罩）
 * - 用户关闭某项时才变灰（opacity降低）
 * - 无白色背景遮罩，使用透明背景
 * - 支持时间维度筛选
 */
import React, { FC, memo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, ViewStyle } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';
import { DayColors } from '@/constants';
import type { FilterOption } from '@/types';

const PROJECT_RED = '#B20000';

export type TimeFilterValue = 'all' | '1m' | '3m' | '6m';

export const TIME_FILTER_OPTIONS: { value: TimeFilterValue; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: '1m', label: '1月内' },
  { value: '3m', label: '3月内' },
  { value: '6m', label: '6月内' },
];

interface MapFilterCapsuleProps {
  options: FilterOption[];
  selected: number[];
  onChange: (selected: number[]) => void;
  topOffset?: number;
  autoCollapseDelay?: number;
  style?: ViewStyle;
  showTimeFilter?: boolean;
}

export const MapFilterCapsule: FC<MapFilterCapsuleProps> = memo(({
  options,
  selected,
  onChange,
  topOffset = 120,
  autoCollapseDelay = 3000,
  style,
  showTimeFilter = false,
}) => {
  const [expanded, setExpanded] = useState(true);
  const collapseTimer = useRef<NodeJS.Timeout | null>(null);
  const heightAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    collapseTimer.current = setTimeout(() => setExpanded(false), autoCollapseDelay);
    return () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
    };
  }, [autoCollapseDelay]);

  useEffect(() => {
    if (expanded) {
      Animated.parallel([
        Animated.spring(heightAnim, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(heightAnim, { toValue: 0, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [expanded]);

  const resetAutoCollapse = useCallback((delay = 5000) => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setExpanded(false), delay);
  }, []);

  const handleToggle = useCallback(() => {
    setExpanded(prev => {
      if (!prev) resetAutoCollapse();
      return !prev;
    });
  }, [resetAutoCollapse]);

  const handleFilterSelect = useCallback((id: number) => {
    resetAutoCollapse();
    if (selected.includes(id)) {
      if (selected.length > 1) onChange(selected.filter(sid => sid !== id));
    } else {
      onChange([...selected, id]);
    }
  }, [selected, onChange, resetAutoCollapse]);



  return (
    <View style={[styles.container, { top: topOffset }, style]}>
      {!expanded && (
        <TouchableOpacity
          style={styles.collapsedBtn}
          onPress={handleToggle}
          activeOpacity={0.7}
        >
          <SlidersHorizontal color={PROJECT_RED} size={18} />
        </TouchableOpacity>
      )}

      {expanded && (
        <Animated.View style={[
          styles.capsule,
          {
            opacity: opacityAnim,
            transform: [{
              scaleY: heightAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
            }, {
              translateY: heightAnim.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }),
            }],
          },
        ]}>
          {options.map((opt) => {
            const isActive = selected.includes(opt.id);
            return (
              <TouchableOpacity
                key={opt.id}
                style={styles.capsuleItem}
                onPress={() => handleFilterSelect(opt.id)}
                activeOpacity={0.6}
              >
                <Text style={[
                  styles.capsuleIcon,
                  !isActive && styles.capsuleIconInactive,
                ]}>
                  {opt.icon}
                </Text>
                {opt.shortLabel && (
                  <Text style={[
                    styles.capsuleLabel,
                    opt.shortLabel.length >= 4 && styles.capsuleLabelSmall,
                    !isActive && styles.capsuleLabelInactive,
                  ]}>
                    {opt.shortLabel}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={styles.capsuleItem}
            onPress={() => setExpanded(false)}
            activeOpacity={0.6}
          >
            <Text style={styles.capsuleCloseIcon}>✕</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 12,
    zIndex: 60,
    alignItems: 'center',
  },
  collapsedBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: PROJECT_RED,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(178, 0, 0, 0.18)',
  },
  capsule: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 4,
    paddingHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  capsuleItem: {
    width: 48,
    height: 52,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
    paddingVertical: 2,
  },
  capsuleIcon: {
    fontSize: 22,
    color: '#000000',
    lineHeight: 26,
  },
  capsuleIconInactive: {
    opacity: 0.25,
  },
  capsuleLabel: {
    fontSize: 10,
    color: '#000000',
    marginTop: 2,
    fontWeight: '500',
  },
  capsuleLabelSmall: {
    fontSize: 8,
    letterSpacing: -0.3,
  },
  capsuleLabelInactive: {
    opacity: 0.25,
  },
  divider: {
    width: 32,
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 4,
  },
  timeItem: {
    width: 48,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
  },
  timeLabel: {
    fontSize: 10,
    color: '#000000',
    fontWeight: '600',
  },
  timeLabelInactive: {
    opacity: 0.35,
  },
  capsuleCloseIcon: {
    fontSize: 16,
    color: DayColors.textTertiary,
    fontWeight: '500',
  },
});

export default MapFilterCapsule;
