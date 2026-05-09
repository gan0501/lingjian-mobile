/**
 * 地图页面头部组件（日间版）
 *
 * 包含返回按钮 + 页面标题。
 * 白色半透明背景，悬浮在地图之上。
 */
import React, { FC, ReactNode, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { DayColors } from '@/constants';

interface MapHeaderProps {
  title: string;
  onBack: () => void;
  /** 统计面板区域，由外部传入 */
  children?: ReactNode;
}

export const MapHeader: FC<MapHeaderProps> = memo(({ title, onBack, children }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
      <View style={styles.headerMain}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.6}>
            <ChevronLeft color={DayColors.text} size={24} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.appTitle}>{title}</Text>
        </View>
      </View>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DayColors.text,
  },
});

export default MapHeader;
