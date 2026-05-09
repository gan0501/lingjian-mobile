/**
 * 地图统计面板组件（日间版）
 *
 * 位于地图头部下方，展示 4 格统计数据。
 * 支持搜索模式（横向滚动搜索结果 Logo 圈）。
 * 支持点击某格弹出侧边抽屉。
 */
import React, { FC, memo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { DayColors, Spacing } from '@/constants';
import type { StatsSlot, SearchResultItem } from '@/types';

const PROJECT_RED = '#B20000';

interface MapStatsPanelProps {
  slots: StatsSlot[];
  loading?: boolean;
  isSearchMode?: boolean;
  searchResults?: SearchResultItem[];
  selectedSearchId?: string | null;
  onSearchItemPress?: (item: SearchResultItem) => void;
  onSlotPress?: (index: number, slot: StatsSlot) => void;
}

const formatNumber = (num: number): string => {
  if (num >= 10000) return (num / 10000).toFixed(1);
  return num.toLocaleString('zh-CN');
};
const needsWanUnit = (num: number): boolean => num >= 10000;

export const MapStatsPanel: FC<MapStatsPanelProps> = memo(({
  slots,
  loading,
  isSearchMode,
  searchResults = [],
  selectedSearchId,
  onSearchItemPress,
  onSlotPress,
}) => {
  // ─── 搜索模式：有结果 ───
  if (isSearchMode && searchResults.length > 0) {
    return (
      <View style={[styles.container, styles.searchModeContainer]}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>搜索结果</Text>
          <Text style={[styles.statValue, styles.statValueAccent]}>{searchResults.length}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.searchResultsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.searchResultsScroll}
          >
            {searchResults.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => onSearchItemPress?.(item)}
                activeOpacity={0.7}
                style={styles.searchItemWrapper}
              >
                <View style={[
                  styles.searchLogoCircle,
                  selectedSearchId === item.id && styles.searchLogoCircleActive,
                ]}>
                  <Text style={styles.searchLogoText}>{item.icon || '📍'}</Text>
                </View>
                <Text style={styles.searchLogoName} numberOfLines={1}>
                  {(item.name || '').slice(0, 4)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  // ─── 搜索模式：加载中 ───
  if (isSearchMode && loading) {
    return (
      <View style={[styles.container, styles.statusContainer]}>
        <Text style={styles.statusText}>搜索中...</Text>
      </View>
    );
  }

  // ─── 搜索模式：无结果 ───
  if (isSearchMode && !loading && searchResults.length === 0) {
    return (
      <View style={[styles.container, styles.statusContainer]}>
        <Text style={styles.statusText}>未搜索到相关信息</Text>
      </View>
    );
  }

  // ─── 正常统计栏 ───
  return (
    <View style={styles.container}>
      {slots.map((slot, i) => {
        const showDash = i === 0 && slot.value === 0;
        const isClickable = !!onSlotPress;

        const content = (
          <>
            <Text style={styles.statLabel}>{slot.label}</Text>
            <Text style={[styles.statValue, slot.isAccent && styles.statValueAccent]}>
              {showDash ? '--' : formatNumber(slot.value)}
              {!showDash && needsWanUnit(slot.value) && (
                <Text style={styles.statUnit}> 万</Text>
              )}
            </Text>
          </>
        );

        return (
          <React.Fragment key={slot.label}>
            {i > 0 && <View style={styles.statDivider} />}
            {isClickable ? (
              <TouchableOpacity
                style={styles.statItem}
                activeOpacity={0.6}
                onPress={() => onSlotPress(i, slot)}
              >
                {content}
              </TouchableOpacity>
            ) : (
              <View style={styles.statItem}>{content}</View>
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DayColors.border,
    backgroundColor: '#FFFFFF',
  },
  searchModeContainer: {
    marginRight: -16,
  },
  statusContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: DayColors.textTertiary,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: DayColors.border,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
    color: DayColors.textTertiary,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: DayColors.text,
  },
  statValueAccent: {
    color: PROJECT_RED,
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '500',
    color: DayColors.textTertiary,
  },
  searchResultsContainer: {
    flex: 3,
  },
  searchResultsScroll: {
    paddingLeft: 6,
    paddingRight: 0,
    gap: 8,
    alignItems: 'center',
    flexDirection: 'row',
  },
  searchItemWrapper: {
    alignItems: 'center',
    width: 42,
  },
  searchLogoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
    borderWidth: 1,
    backgroundColor: '#F5F7FA',
    borderColor: DayColors.border,
  },
  searchLogoCircleActive: {
    backgroundColor: DayColors.accentLight,
    borderColor: DayColors.accent,
  },
  searchLogoText: {
    fontSize: 14,
    fontWeight: '600',
    color: DayColors.text,
  },
  searchLogoName: {
    fontSize: 8,
    marginTop: 2,
    textAlign: 'center',
    width: 42,
    color: DayColors.textSecondary,
  },
});

export default MapStatsPanel;
