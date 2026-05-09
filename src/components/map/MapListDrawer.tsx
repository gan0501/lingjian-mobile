/**
 * 地图侧边列表抽屉组件（日间版）
 *
 * 从右侧滑入，显示列表数据。
 * 用于「系统XX」「当前视野」「收藏XX」「录入XX」点击后弹出。
 */
import React, { FC, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DayColors } from '@/constants';
import type { DrawerListItem } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.78;

interface MapListDrawerProps {
  visible: boolean;
  title: string;
  items: DrawerListItem[];
  loading?: boolean;
  emptyText?: string;
  onClose: () => void;
  onItemPress?: (item: DrawerListItem) => void;
  colorGetter?: (type: number) => string;
  exceededMaxCount?: boolean;
  maxCount?: number;
}

export const MapListDrawer: FC<MapListDrawerProps> = ({
  visible,
  title,
  items,
  loading = false,
  emptyText = '暂无数据',
  onClose,
  onItemPress,
  colorGetter,
  exceededMaxCount = false,
  maxCount = 1000,
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: DRAWER_WIDTH, duration: 200, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const renderItem = ({ item }: { item: DrawerListItem }) => {
    const bgColor = colorGetter && item.type != null ? colorGetter(item.type) : DayColors.accent;

    return (
      <TouchableOpacity
        style={styles.listItem}
        activeOpacity={0.7}
        onPress={() => onItemPress?.(item)}
      >
        <View style={[styles.itemAvatar, { backgroundColor: bgColor }]}>
          <Text style={styles.itemAvatarText}>
            {item.icon || item.name?.charAt(0) || '?'}
          </Text>
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemName} numberOfLines={1} ellipsizeMode="tail">
            {item.name}
          </Text>
          {item.subText ? (
            <Text style={styles.itemSubText} numberOfLines={1}>
              {item.subText}
            </Text>
          ) : null}
        </View>
        <Text style={styles.itemArrow}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 遮罩 */}
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* 抽屉 */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
        <View style={[styles.drawerHeader, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.drawerTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.countBar}>
          <Text style={styles.countText}>
            {exceededMaxCount ? (
              <>超过 <Text style={styles.countHighlight}>{maxCount}</Text> 条，仅显示前 <Text style={styles.countHighlight}>{maxCount}</Text> 条</>
            ) : (
              <>共 <Text style={styles.countHighlight}>{items.length}</Text> 条</>
            )}
          </Text>
        </View>

        {loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>加载中...</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 300,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: DRAWER_WIDTH,
    height: '100%',
    zIndex: 310,
    backgroundColor: DayColors.surface,
    shadowColor: '#000',
    shadowOffset: { width: -3, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DayColors.text,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 20,
    fontWeight: '400',
    color: DayColors.textTertiary,
  },
  countBar: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
  },
  countText: {
    fontSize: 13,
    color: DayColors.textSecondary,
  },
  countHighlight: {
    fontWeight: '700',
    color: DayColors.accent,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  itemAvatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    color: DayColors.text,
  },
  itemSubText: {
    fontSize: 12,
    marginTop: 2,
    color: DayColors.textTertiary,
  },
  itemArrow: {
    fontSize: 22,
    fontWeight: '300',
    marginLeft: 8,
    color: DayColors.textTertiary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: DayColors.textTertiary,
  },
});

export default MapListDrawer;
