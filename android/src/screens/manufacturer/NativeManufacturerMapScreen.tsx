import React, { FC, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Animated, LogBox, ScrollView, Dimensions, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapStatsPanel } from '@/components/map/MapStatsPanel';
import { MapListDrawer, DrawerListItem } from '@/components/map/MapListDrawer';
import { BottomSearchBar as BottomSearchBarDay } from '@/components/common/BottomSearchBar';
import { Loading } from '@/components/common/Loading';
import { useLocation } from '@/hooks/useLocation';
import { enterpriseService } from '@/services/enterpriseService';
import { useMapStore } from '@/stores/useMapStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { MANUFACTURER_TYPES } from '@/constants/config';
import { getManufacturerColor } from '@/constants/colors';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { MAP_CONFIG } from '@/constants/config';
import { CreateCustomerSheet } from '@/components/map/CreateCustomerSheet';
import ShareModal from '@/components/share/ShareModal';

LogBox.ignoreLogs(['MapLibre error', 'Failed to load tile', '{TextureViewRend}']);

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const FILTER_ICONS: Record<number, string> = { 1: '🧱', 2: '👷', 3: '🚜', 4: '💼' };

const useDebounce = <T,>(value: T, delay: number): T => {
  const [dv, setDv] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
};

const normalizeManufacturerType = (e: any): number => {
  const t = Number(e?.enterprise_type ?? e?.type ?? 0);
  if (t >= 1 && t <= 4) return t;
  return 1;
};

interface MapMarkerItem {
  id: string; latitude: number; longitude: number; title: string; type: number; data?: any;
}

const NativeManufacturerMapScreen: FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { isLoggedIn } = useAuthStore();
  const { requestLocation } = useLocation();
  const { userLocation } = useMapStore();
  const { colors, isDark } = useTheme();

  const [mapBounds, setMapBounds] = useState<{ min_lat: number; max_lat: number; min_lon: number; max_lon: number } | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(10);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const isSearchMode = activeSearchQuery.length > 0;
  const [createVisible, setCreateVisible] = useState(false);
  const [manufacturerFilters, setManufacturerFilters] = useState<number[]>([1, 2, 3, 4]);
  const [selectedManufacturer, setSelectedManufacturer] = useState<MapMarkerItem | null>(null);

  const [likeMap, setLikeMap] = useState<Record<string, number>>({});
  const [favoriteSet, setFavoriteSet] = useState<Set<string>>(new Set());
  const [favoriteItems, setFavoriteItems] = useState<DrawerListItem[]>([]);

  const [shareModalVisible, setShareModalVisible] = useState(false);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState('');
  const [drawerItems, setDrawerItems] = useState<DrawerListItem[]>([]);
  const [drawerExceededMax, setDrawerExceededMax] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const [markers, setMarkers] = useState<MapMarkerItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [systemTotal, setSystemTotal] = useState(0);

  const debouncedBounds = useDebounce(mapBounds, 300);
  const debouncedZoom = useDebounce(mapZoom, 300);

  useEffect(() => { requestLocation(); }, []);

  const handleSearch = useCallback((text: string) => {
    setActiveSearchQuery(text.trim());
  }, []);

  const handleViewportChange = useCallback((bounds: any, zoom: number | null) => {
    if (typeof zoom === 'number') setMapZoom(zoom);
    if (bounds) setMapBounds(bounds);
  }, []);

  const handleMarkerPress = useCallback((marker: any) => {
    const fullMarker = markers.find(m => m.id === marker.id);
    if (fullMarker) {
      setSelectedManufacturer(fullMarker);
    } else {
      setSelectedManufacturer(marker as MapMarkerItem);
    }
  }, [markers]);

  const handleLikePress = useCallback(async () => {
    if (!selectedManufacturer) return;
    if (!isLoggedIn) { navigation.navigate('Login'); return; }
    const id = selectedManufacturer.id;
    try {
      const resp = await enterpriseService.toggleLike(id, 'manufacturer');
      const result = resp?.data?.result || resp?.result;
      if (result) {
        setLikeMap(prev => ({ ...prev, [id]: result.like_count }));
      }
    } catch (e) {
      console.warn('点赞失败:', e);
    }
  }, [selectedManufacturer, isLoggedIn, navigation]);

  const handleFavoritePress = useCallback(async () => {
    if (!selectedManufacturer) return;
    if (!isLoggedIn) { navigation.navigate('Login'); return; }
    const id = selectedManufacturer.id;
    const newSet = new Set(favoriteSet);
    const newItems = [...favoriteItems];

    try {
      if (newSet.has(id)) {
        await enterpriseService.removeFavorite(id, 'manufacturer');
        newSet.delete(id);
        const idx = newItems.findIndex(item => item.id === id);
        if (idx !== -1) newItems.splice(idx, 1);
      } else {
        const typeName = MANUFACTURER_TYPES.find(t => t.id === selectedManufacturer.type)?.name || '厂家';
        await enterpriseService.addFavorite({
          target_id: id,
          target_type: 'manufacturer',
          target_name: selectedManufacturer.title,
          target_data: { type: selectedManufacturer.type, type_name: typeName, ...selectedManufacturer.data },
        });
        newSet.add(id);
        newItems.push({ id, name: selectedManufacturer.title, subText: typeName, type: selectedManufacturer.type, data: selectedManufacturer.data });
      }
      setFavoriteSet(newSet);
      setFavoriteItems(newItems);
    } catch (e) {
      console.warn('收藏操作失败:', e);
    }
  }, [selectedManufacturer, favoriteSet, favoriteItems, isLoggedIn, navigation]);

  const handleSharePress = useCallback(() => {
    if (!selectedManufacturer) return;
    setShareModalVisible(true);
  }, [selectedManufacturer]);

  const handleViewPress = useCallback(() => {
    if (!selectedManufacturer) return;
    const mid = selectedManufacturer.data?.enterprise_id || selectedManufacturer.data?.id || Number(selectedManufacturer.id);
    const mType = selectedManufacturer.data?.enterprise_type;
    setSelectedManufacturer(null);
    navigation.navigate('ManufacturerDetail', { manufacturerId: mid, manufacturerType: mType });
  }, [selectedManufacturer, navigation]);

  const handleSlotPress = useCallback(async (index: number) => {
    const markerToDrawerItem = (m: MapMarkerItem): DrawerListItem => ({
      id: m.id, name: m.title,
      subText: MANUFACTURER_TYPES.find(t => t.id === m.type)?.name || '厂家',
      icon: FILTER_ICONS[m.type] || '🏭', type: m.type, data: m.data,
    });

    switch (index) {
      case 0:
        setDrawerTitle('系统厂家'); setDrawerItems([]); setDrawerExceededMax(false); setDrawerLoading(true); setDrawerVisible(true);
        try {
          const resp = await enterpriseService.getManufacturerClusters({ min_lat: -90, max_lat: 90, min_lon: -180, max_lon: 180, zoom: 14 });
          const result = resp?.result || resp;
          const details = result?.details || [];
          setDrawerExceededMax(details.length > 1000);
          setDrawerItems(details.slice(0, 1000).map((e: any) => ({
            id: String(e.enterprise_id || e.id), name: e.enterprise_name || e.name || '厂家',
            subText: MANUFACTURER_TYPES.find(t => t.id === normalizeManufacturerType(e))?.name || '厂家',
            icon: FILTER_ICONS[normalizeManufacturerType(e)] || '🏭', type: normalizeManufacturerType(e), data: e,
          })));
        } catch (e) { console.warn('获取系统厂家列表失败:', e); }
        finally { setDrawerLoading(false); }
        break;
      case 1:
        setDrawerTitle('当前视野'); setDrawerItems(markers.map(markerToDrawerItem)); setDrawerExceededMax(false); setDrawerVisible(true);
        break;
      case 2:
        setDrawerTitle('收藏厂家'); setDrawerItems(favoriteItems); setDrawerExceededMax(false); setDrawerVisible(true);
        break;
      case 3:
        setDrawerTitle('录入厂家'); setDrawerItems([]); setDrawerExceededMax(false); setDrawerVisible(true);
        break;
    }
  }, [markers, favoriteItems]);

  const handleDrawerItemPress = useCallback((item: DrawerListItem) => {
    setDrawerVisible(false);
    if (item.data?.lat && (item.data?.lng || item.data?.lon)) {
      const lat = parseFloat(String(item.data.lat));
      const lng = parseFloat(String(item.data.lng || item.data.lon));
      if (!isNaN(lat) && !isNaN(lng)) {
        const found = markers.find(m => m.id === item.id);
        if (found) setSelectedManufacturer(found);
      }
    } else {
      const mid = item.data?.enterprise_id || item.data?.id || Number(item.id);
      const mType = item.data?.enterprise_type;
      navigation.navigate('ManufacturerDetail', { manufacturerId: mid, manufacturerType: mType });
    }
  }, [markers, navigation]);

  const isFavorited = selectedManufacturer ? favoriteSet.has(selectedManufacturer.id) : false;
  const likeCount = selectedManufacturer ? (likeMap[selectedManufacturer.id] || 0) : 0;

  const statsSlots = useMemo(() => [
    { label: '系统厂家', value: systemTotal },
    { label: isSearchMode ? '搜索结果' : '当前视野', value: markers.length, isAccent: true },
    { label: '收藏厂家', value: favoriteSet.size },
    { label: '录入厂家', value: 0 },
  ], [systemTotal, markers.length, isSearchMode, favoriteSet.size]);

  const filterOptions = useMemo(() =>
    MANUFACTURER_TYPES.map(t => ({
      id: t.id, label: t.name, color: getManufacturerColor(t.id), icon: FILTER_ICONS[t.id] || '🧱',
    })), []);

  const filterTopOffset = useMemo(() => insets.top + 4 + 48 + 60 + 20, [insets.top]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor="transparent" translucent />

      <View style={[styles.header, { paddingTop: insets.top + 4, backgroundColor: colors.mapHeaderBg }]}>
        <View style={styles.headerMain}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.6}>
              <ChevronLeft color={colors.text} size={24} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={[styles.appTitle, { color: colors.text }]}>找厂家</Text>
          </View>
        </View>
        <MapStatsPanel
          slots={statsSlots}
          loading={isFetching}
          isSearchMode={isSearchMode}
          onSlotPress={handleSlotPress}
        />
      </View>

      <CreateCustomerSheet
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        title="录入厂家"
        onSuccess={() => {}}
        onRequireLogin={() => navigation.navigate('Login')}
      />

      {selectedManufacturer && (
        <View style={styles.bottomCardWrapper} pointerEvents="box-none">
          <View style={[styles.bottomCard, { backgroundColor: colors.surface }]} pointerEvents="auto">
            <View style={styles.cardHeader}>
              <View style={styles.cardHandle} />
            </View>
            <ScrollView style={styles.modalScrollView}>
              <View>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardLogoWrapper}>
                    <View style={[styles.cardLogo, { backgroundColor: getManufacturerColor(selectedManufacturer.type) }]}>
                      {(() => {
                        const name = selectedManufacturer.title || '厂家';
                        const chars = name.replace(/^[^\u4e00-\u9fa5a-zA-Z]+/, '').slice(0, 4);
                        const line1 = chars.slice(0, 2);
                        const line2 = chars.slice(2, 4) || (line1.length === 2 ? '' : line1.slice(1));
                        return (
                          <View style={styles.cardLogoTextContainer}>
                            <Text style={styles.cardLogoTextLine}>{line1}</Text>
                            {line2 ? <Text style={styles.cardLogoTextLine}>{line2}</Text> : null}
                          </View>
                        );
                      })()}
                    </View>
                  </View>
                  <View style={styles.cardTitleInfo}>
                    <Text style={[styles.detailTitle, { color: colors.text }]} numberOfLines={2}>{selectedManufacturer.title}</Text>
                    <View style={styles.tagsRow}>
                      <View style={[styles.tag, { backgroundColor: getManufacturerColor(selectedManufacturer.type) }]}>
                        <Text style={styles.tagText}>{MANUFACTURER_TYPES.find(t => t.id === selectedManufacturer.type)?.name || '厂家'}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {selectedManufacturer.data && (
                  <>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>注册资本</Text>
                      <Text style={[styles.infoValueBold, { color: colors.text }]}>{selectedManufacturer.data.register_capital || '-'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>主营产品</Text>
                      <Text style={[styles.infoValue, { color: colors.textSub }]}>{selectedManufacturer.data.qualification || '-'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>厂家地址</Text>
                      <Text style={[styles.infoValue, { color: colors.textMuted }]} numberOfLines={2}>{selectedManufacturer.data.register_address || selectedManufacturer.data.address || '-'}</Text>
                    </View>
                  </>
                )}

                <View style={styles.divider} />

                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.smallButton} onPress={handleSharePress}>
                    <Text style={styles.smallButtonIcon}>📤</Text>
                    <Text style={[styles.smallButtonText, { color: colors.textSub }]}>分享</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.smallButton} onPress={handleLikePress}>
                    <Text style={styles.smallButtonIcon}>👍</Text>
                    <Text style={[styles.smallButtonText, { color: colors.textSub }]}>{likeCount || '点赞'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.largeButton, { backgroundColor: isFavorited ? '#f5f0ff' : '#f2f3f7' }]} onPress={handleFavoritePress}>
                    <Text style={[styles.largeButtonText, { color: isFavorited ? colors.accent : '#333' }]}>{isFavorited ? '已收藏' : '收藏'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.largeButton, styles.viewButton, { backgroundColor: colors.accent }]} onPress={handleViewPress}>
                    <Text style={[styles.largeButtonText, styles.viewButtonText]}>查看</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      {selectedManufacturer && (
        <ShareModal
          visible={shareModalVisible}
          onClose={() => setShareModalVisible(false)}
          projectName={selectedManufacturer.title}
          projectType={MANUFACTURER_TYPES.find(t => t.id === selectedManufacturer.type)?.name || '厂家'}
          constructor={selectedManufacturer.data?.register_capital || '-'}
          scale={selectedManufacturer.data?.qualification || '-'}
          address={selectedManufacturer.data?.register_address || selectedManufacturer.data?.address || '-'}
          publishTime="-"
          projectId={selectedManufacturer.id}
        />
      )}

      <MapListDrawer
        visible={drawerVisible}
        title={drawerTitle}
        items={drawerItems}
        loading={drawerLoading}
        onClose={() => setDrawerVisible(false)}
        onItemPress={handleDrawerItemPress}
        colorGetter={getManufacturerColor}
        emptyText="暂无厂家数据"
        exceededMaxCount={drawerExceededMax}
        maxCount={1000}
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <Loading theme={isDark ? 'night' : 'day'} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 200 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 3 },
  headerMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  appTitle: { fontSize: 18, fontWeight: '700' },
  bottomCardWrapper: { position: 'absolute', left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', zIndex: 160 },
  bottomCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: SCREEN_HEIGHT * 0.5, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.25, shadowRadius: 5, elevation: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 10, paddingBottom: 5 },
  cardHandle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2 },
  modalScrollView: { padding: 20 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  cardLogoWrapper: { marginRight: 12 },
  cardLogo: { width: 48, height: 48, borderRadius: 4, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  cardLogoTextContainer: { alignItems: 'center', justifyContent: 'center' },
  cardLogoTextLine: { fontSize: 12, fontWeight: '700', color: '#fff', lineHeight: 16 },
  cardTitleInfo: { flex: 1 },
  detailTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22, marginBottom: 8 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3 },
  tagText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  infoLabel: { fontSize: 14, color: '#666', width: 80 },
  infoValue: { fontSize: 14, fontWeight: '500', flex: 1, textAlign: 'left' },
  infoValueBold: { fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'left' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 12 },
  actionButtons: { flexDirection: 'row', gap: 10, marginTop: 4, alignItems: 'center' },
  smallButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 8, minWidth: 52 },
  smallButtonIcon: { fontSize: 22, marginBottom: 2 },
  smallButtonText: { fontSize: 11, fontWeight: '500' },
  largeButton: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  viewButton: { backgroundColor: '#B20000' },
  largeButtonText: { fontSize: 15, fontWeight: '600' },
  viewButtonText: { color: '#fff' },
});

export default NativeManufacturerMapScreen;
