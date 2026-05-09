/**
 * 找厂家 - 日间版地图页面（V2）
 *
 * 白色主题 + 统计面板 + 筛选胶囊 + 底部搜索 + 底部详情卡 + 侧边抽屉。
 * 支持分享/点赞/收藏/查看操作。
 */
import React, { FC, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Dimensions, ActivityIndicator, LogBox, Image, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { Share2, ThumbsUp } from 'lucide-react-native';
import {
  DayColors, getManufacturerColor, MANUFACTURER_TYPES, FILTER_ICONS,
  MAP_CONFIG, getMapTileStyle, normalizeManufacturerType,
} from '@/constants';
import {
  useManufacturerMapData, useManufacturerTotals, useDebounce,
} from '@/hooks';
import { useLocation } from '@/hooks/useLocation';
import { useMapStore, useAuthStore } from '@/stores';
import { manufacturerApi } from '@/services';
import { favoritesApi, likesApi } from '@/services/favorites';
import {
  MapHeader, MapStatsPanel, MapFilterCapsule,
  MapBottomCard, EntityCardContent, MapSearchBar, MapListDrawer,
  CreateCustomerSheet,
} from '@/components/map';
import { EntityShareModal } from '@/components/share';
import type { MapBounds, StatsSlot, FilterOption, MapMarker, SearchResultItem, DrawerListItem } from '@/types';
import { useOverlay } from '@/components/overlay';

LogBox.ignoreLogs(['MapLibre error', 'Failed to load tile', '{TextureViewRend}', 'stream was reset', 'Request failed due to a permanent error']);

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_STYLE = getMapTileStyle();

// 厂家类型到mark图片的映射
const MANUFACTURER_MARK_IMAGES: Record<number, any> = {
  1: require('@/assets/images/mark/green.png'),    // 材料商
  2: require('@/assets/images/mark/blue.png'),     // 劳务队
  3: require('@/assets/images/mark/yellow.png'),   // 设备商
  4: require('@/assets/images/mark/purple.png'),   // 服务商
};

const normalizeType = (e: any): number => {
  const t = Number(e?.enterprise_type ?? e?.type ?? 0);
  return normalizeManufacturerType(t);
};

const ManufacturerMapScreen: FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { isLoggedIn } = useAuthStore();
  const { toast } = useOverlay();
  const { requestLocation } = useLocation();
  const { userLocation } = useMapStore();
  const mapViewRef = useRef<any>(null);

  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [mapZoom, setMapZoom] = useState(10);
  const [mapReady, setMapReady] = useState(false);
  const [center, setCenter] = useState<[number, number]>(MAP_CONFIG.HANGZHOU_CENTER);
  const [cameraKey, setCameraKey] = useState(0);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const isSearchMode = activeSearchQuery.length > 0;

  const [manufacturerFilters, setManufacturerFilters] = useState<number[]>([1, 2, 3, 4]);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);

  useEffect(() => {
    if (selectedMarker) {
      Keyboard.dismiss();
    }
  }, [selectedMarker]);

  const [favoriteSet, setFavoriteSet] = useState<Set<string>>(new Set());
  const [favoriteList, setFavoriteList] = useState<any[]>([]);

  // 点赞状态
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  // 录入弹窗
  const [createVisible, setCreateVisible] = useState(false);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState('');
  const [drawerItems, setDrawerItems] = useState<DrawerListItem[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerExceededMax, setDrawerExceededMax] = useState(false);

  // 分享弹窗
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [sharePayload, setSharePayload] = useState<{
    entityName: string;
    entityType: string;
    registerCapital: string;
    qualification: string;
    address: string;
    entityId: string;
  } | null>(null);

  const debouncedBounds = useDebounce(mapBounds, 300);
  const debouncedZoom = useDebounce(mapZoom, 300);

  useEffect(() => { requestLocation(); }, []);
  useEffect(() => {
    if (userLocation && userLocation.latitude !== 0) {
      setCenter([userLocation.longitude, userLocation.latitude]);
      setCameraKey(prev => prev + 1);
    }
  }, [userLocation]);

  // 超时兜底：3秒后强制移除加载遮罩
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!mapReady) setMapReady(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // 加载收藏列表
  useEffect(() => {
    if (!isLoggedIn) return;
    (async () => {
      try {
        const res = await favoritesApi.list('manufacturer');
        console.log('[Manufacturer] load favorites res:', res);
        const items = Array.isArray(res) ? res : (res?.result || res?.data || []);
        console.log('[Manufacturer] load favorites items:', items);
        if (Array.isArray(items)) {
          setFavoriteList(items);
          setFavoriteSet(new Set(items.map((f: any) => String(f.target_id))));
        }
      } catch (e) {
        console.error('[Manufacturer] load favorites error:', e);
      }
    })();
  }, [isLoggedIn]);

  const queryParams = useMemo(() => {
    const bounds = isSearchMode
      ? { min_lat: -90, max_lat: 90, min_lon: -180, max_lon: 180 }
      : (debouncedBounds || { min_lat: 30, max_lat: 32, min_lon: 119, max_lon: 121 });
    return {
      bounds,
      zoom: debouncedBounds ? debouncedZoom : 10,
      search: isSearchMode ? activeSearchQuery : undefined,
      enterpriseTypes: isSearchMode ? [1, 2, 3, 4] : manufacturerFilters,
    };
  }, [debouncedBounds, debouncedZoom, isSearchMode, activeSearchQuery, manufacturerFilters]);

  const { data, isLoading, isFetching } = useManufacturerMapData(queryParams);
  const manufacturers = data?.manufacturers || [];

  const { data: globalTotals } = useManufacturerTotals();
  const systemTotal = globalTotals?.total || 0;

  const markers = useMemo((): MapMarker[] => {
    return manufacturers
      .filter((e: any) => {
        const lat = parseFloat(String(e.lat));
        const lng = parseFloat(String(e.lng || e.lon));
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return false;
        if (isSearchMode) return true;
        return manufacturerFilters.includes(normalizeType(e));
      })
      .map((e: any) => ({
        id: String(e.enterprise_id || e.id),
        latitude: parseFloat(String(e.lat)),
        longitude: parseFloat(String(e.lng || e.lon)),
        title: e.enterprise_name || e.name || '厂家',
        type: normalizeType(e),
        data: e,
      }));
  }, [manufacturers, manufacturerFilters, isSearchMode]);

  const markersGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: markers
      .filter(m => !isNaN(m.latitude) && !isNaN(m.longitude))
      .map(m => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [m.longitude, m.latitude] },
        properties: {
          id: m.id, title: m.title, type: m.type,
          color: getManufacturerColor(m.type),
          selected: selectedMarker?.id === m.id ? 1 : 0,
        },
      })),
  }), [markers, selectedMarker?.id]);

  const searchResults = useMemo((): SearchResultItem[] => {
    if (!isSearchMode) return [];
    return markers.map(m => ({
      id: m.id, name: m.title,
      icon: FILTER_ICONS.manufacturer[m.type] || '🏭',
    }));
  }, [isSearchMode, markers]);

  const statsSlots = useMemo((): StatsSlot[] => [
    { label: '系统厂家', value: systemTotal },
    { label: isSearchMode ? '搜索结果' : '当前视野', value: markers.length, isAccent: true },
    { label: '收藏厂家', value: favoriteSet.size },
    { label: '录入厂家', value: 0 },
  ], [systemTotal, markers.length, isSearchMode, favoriteSet.size]);

  // 筛选选项的简短标签映射
  const FILTER_SHORT_LABELS: Record<number, string> = {
    1: '生产厂家',
    2: '劳务班组',
    3: '机械设备',
    4: '商务服务',
  };

  const filterOptions = useMemo((): FilterOption[] =>
    MANUFACTURER_TYPES.map(t => ({
      id: t.id,
      label: t.name,
      shortLabel: FILTER_SHORT_LABELS[t.id],
      color: getManufacturerColor(t.id),
      icon: FILTER_ICONS.manufacturer[t.id] || '🧱',
    })), []);

  const filterTopOffset = useMemo(() => insets.top + 4 + 48 + 60 + 20, [insets.top]);

  const handleSearch = useCallback((text: string) => { setActiveSearchQuery(text.trim()); }, []);

  const handleRegionChange = useCallback((feature: any) => {
    try {
      const props = feature?.properties;
      const bounds = props?.visibleBounds;
      if (bounds?.length === 2) {
        const [ne, sw] = bounds;
        setMapBounds({ min_lat: sw[1], max_lat: ne[1], min_lon: sw[0], max_lon: ne[0] });
      }
      if (props?.zoomLevel) setMapZoom(props.zoomLevel);
    } catch {}
  }, []);

  const handleMarkerPress = useCallback((e: any) => {
    Keyboard.dismiss();
    const feature = e?.features?.[0];
    if (!feature) return;
    const found = markers.find(m => m.id === feature.properties?.id);
    if (found) setSelectedMarker(found);
  }, [markers]);

  const handleMapReady = useCallback(() => {
    setMapReady(true);
    setTimeout(async () => {
      try {
        const vb = await mapViewRef.current?.getVisibleBounds?.();
        if (vb?.length === 2) {
          const [ne, sw] = vb;
          setMapBounds({ min_lat: sw[1], max_lat: ne[1], min_lon: sw[0], max_lon: ne[0] });
        }
      } catch {}
    }, 500);
  }, []);

  const handleViewPress = useCallback(() => {
    if (!selectedMarker) return;
    const mid = selectedMarker.data?.enterprise_id || selectedMarker.data?.id || Number(selectedMarker.id);
    const mType = selectedMarker.data?.enterprise_type;
    setSelectedMarker(null);
    navigation.navigate('ManufacturerDetail', { manufacturerId: mid, manufacturerType: mType });
  }, [selectedMarker, navigation]);

  const handleFavorite = useCallback(async () => {
    if (!selectedMarker || !isLoggedIn) {
      toast.info('请先登录后收藏');
      return;
    }
    const id = selectedMarker.id;
    try {
      if (favoriteSet.has(id)) {
        const res = await favoritesApi.remove(id, 'manufacturer');
        console.log('[Manufacturer] remove favorite res:', res);
        setFavoriteSet(prev => { const next = new Set(prev); next.delete(id); return next; });
        setFavoriteList(prev => prev.filter(f => String(f.target_id) !== id));
        toast.success('已取消收藏');
      } else {
        const dataToSave = {
          ...selectedMarker.data,
          lat: selectedMarker.data?.lat ?? selectedMarker.latitude,
          lon: selectedMarker.data?.lon ?? selectedMarker.data?.lng ?? selectedMarker.longitude,
          enterprise_id: selectedMarker.data?.enterprise_id || Number(selectedMarker.id),
          enterprise_name: selectedMarker.data?.enterprise_name || selectedMarker.title,
          enterprise_type: selectedMarker.data?.enterprise_type || selectedMarker.type,
        };
        const res = await favoritesApi.add({ target_id: id, target_type: 'manufacturer', target_name: selectedMarker.title, target_data: dataToSave });
        console.log('[Manufacturer] add favorite res:', res);
        setFavoriteSet(prev => new Set(prev).add(id));
        setFavoriteList(prev => [...prev, { target_id: id, target_name: selectedMarker.title, target_data: dataToSave }]);
        toast.success('已收藏');
      }
    } catch (e) {
      console.error('[Manufacturer] favorite error:', e);
      toast.info('操作失败，请重试');
    }
  }, [selectedMarker, isLoggedIn, favoriteSet, toast]);

  const handleLike = useCallback(async () => {
    if (!selectedMarker || !isLoggedIn) {
      toast.info('请先登录后点赞');
      return;
    }
    const id = selectedMarker.id;
    try {
      const res = await likesApi.toggle(id, 'manufacturer');
      const liked = res?.liked;
      const count = res?.like_count || 0;
      if (liked !== undefined) {
        setLikedSet(prev => {
          const next = new Set(prev);
          if (liked) next.add(id);
          else next.delete(id);
          return next;
        });
        setLikeCounts(prev => ({ ...prev, [id]: count }));
      }
      toast.success(liked ? '已点赞' : '已取消点赞');
    } catch { toast.info('操作失败，请重试'); }
  }, [selectedMarker, isLoggedIn, toast]);

  const handleShare = useCallback(() => {
    if (!selectedMarker?.data) return;
    const d = selectedMarker.data;
    setSharePayload({
      entityName: selectedMarker.title,
      entityType: MANUFACTURER_TYPES.find(t => t.id === selectedMarker.type)?.name || '厂家',
      registerCapital: d.register_capital || '-',
      qualification: d.qualification || '-',
      address: d.register_address || d.address || '-',
      entityId: String(selectedMarker.id),
    });
    setShareModalVisible(true);
  }, [selectedMarker]);

  const handleSearchItemPress = useCallback((item: SearchResultItem) => {
    Keyboard.dismiss();
    const found = markers.find(m => m.id === item.id);
    if (found) {
      setCenter([found.longitude, found.latitude]);
      setCameraKey(prev => prev + 1);
      setSelectedMarker(found);
    }
  }, [markers]);

  const handleSlotPress = useCallback(async (index: number) => {
    const markerToItem = (m: MapMarker): DrawerListItem => ({
      id: m.id, name: m.title,
      subText: MANUFACTURER_TYPES.find(t => t.id === m.type)?.name || '厂家',
      icon: FILTER_ICONS.manufacturer[m.type] || '🏭',
      type: m.type, data: m.data,
    });
    switch (index) {
      case 0:
        setDrawerTitle('系统厂家'); setDrawerItems([]); setDrawerLoading(true); setDrawerVisible(true);
        try {
          const resp = await manufacturerApi.getMapClusters({ min_lat: -90, max_lat: 90, min_lon: -180, max_lon: 180, zoom: 14 });
          const result = resp?.result || resp;
          const details = result?.details || [];
          setDrawerExceededMax(details.length > 1000);
          setDrawerItems(details.slice(0, 1000).map((e: any) => ({
            id: String(e.enterprise_id || e.id),
            name: e.enterprise_name || e.name || '厂家',
            subText: MANUFACTURER_TYPES.find(t => t.id === normalizeType(e))?.name || '厂家',
            icon: FILTER_ICONS.manufacturer[normalizeType(e)] || '🏭',
            type: normalizeType(e), data: e,
          })));
        } catch {} finally { setDrawerLoading(false); }
        break;
      case 1:
        setDrawerTitle('当前视野'); setDrawerItems(markers.map(markerToItem));
        setDrawerExceededMax(false); setDrawerVisible(true); break;
      case 2:
        setDrawerTitle('收藏厂家');
        setDrawerItems(favoriteList.map((f: any) => ({
          id: String(f.target_id),
          name: f.target_name || '厂家',
          subText: MANUFACTURER_TYPES.find(t => t.id === normalizeType(f.target_data))?.name || '厂家',
          icon: FILTER_ICONS.manufacturer[normalizeType(f.target_data)] || '🏭',
          type: normalizeType(f.target_data),
          data: f.target_data || {},
        })));
        setDrawerExceededMax(false); setDrawerVisible(true); break;
      case 3:
        setDrawerTitle('录入厂家'); setDrawerItems([]);
        setDrawerExceededMax(false); setDrawerVisible(true); break;
    }
  }, [markers, favoriteList]);

  const handleDrawerItemPress = useCallback((item: DrawerListItem) => {
    setDrawerVisible(false);
    if (item.data?.lat && (item.data?.lng || item.data?.lon)) {
      const lat = parseFloat(String(item.data.lat));
      const lng = parseFloat(String(item.data.lng || item.data.lon));
      if (!isNaN(lat) && !isNaN(lng)) {
        setCenter([lng, lat]); setCameraKey(prev => prev + 1);
        let found = markers.find(m => m.id === item.id);
        if (!found && item.data) {
          found = {
            id: String(item.data.enterprise_id || item.data.id || item.id),
            latitude: lat,
            longitude: lng,
            title: item.data.enterprise_name || item.data.name || item.name || '厂家',
            type: normalizeType(item.data),
            data: item.data,
          };
        }
        if (found) setSelectedMarker(found);
      }
    } else {
      const mid = item.data?.enterprise_id || item.data?.id || Number(item.id);
      navigation.navigate('ManufacturerDetail', { manufacturerId: mid, manufacturerType: item.data?.enterprise_type });
    }
  }, [markers, navigation]);

  const isFavorited = selectedMarker ? favoriteSet.has(selectedMarker.id) : false;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <MapLibreGL.MapView ref={mapViewRef} style={styles.map} mapStyle={MAP_STYLE as any}
        onDidFinishLoadingMap={handleMapReady} onRegionDidChange={handleRegionChange}
        onPress={() => setSelectedMarker(null)}>
        <MapLibreGL.Camera key={`cam-${cameraKey}`} centerCoordinate={center} zoomLevel={10}
          minZoomLevel={4} maxZoomLevel={18} animationMode="flyTo" animationDuration={1500} />
        {/* 图片标记 */}
        <>
          {/* 预加载图片到地图 */}
          <MapLibreGL.Images images={{
            'mark-green': require('@/assets/images/mark/green.png'),
            'mark-blue': require('@/assets/images/mark/blue.png'),
            'mark-yellow': require('@/assets/images/mark/yellow.png'),
            'mark-purple': require('@/assets/images/mark/purple.png'),
          }} />
          
          <MapLibreGL.ShapeSource 
            id="mfr-markers" 
            shape={markersGeoJSON as any} 
            onPress={handleMarkerPress}
          >
            <MapLibreGL.SymbolLayer
              id="mfr-icons"
              style={{
                iconImage: ['match', ['get', 'type'],
                  1, 'mark-green',
                  2, 'mark-blue',
                  3, 'mark-yellow',
                  4, 'mark-purple',
                  'mark-green'
                ] as any,
                iconSize: ['case',
                  ['==', ['get', 'selected'], 1], 0.35,
                  0.28,
                ] as any,
                iconAllowOverlap: true,
                iconIgnorePlacement: true,
              }}
            />
          </MapLibreGL.ShapeSource>
        </>
      </MapLibreGL.MapView>

      <MapHeader title="找厂家" onBack={() => navigation.goBack()}>
        <MapStatsPanel slots={statsSlots} loading={isFetching} isSearchMode={isSearchMode}
          searchResults={searchResults} onSearchItemPress={handleSearchItemPress} onSlotPress={handleSlotPress} />
      </MapHeader>

      <MapFilterCapsule options={filterOptions} selected={manufacturerFilters}
        onChange={setManufacturerFilters} topOffset={filterTopOffset} />

      <MapSearchBar value={searchKeyword} onChangeText={setSearchKeyword}
        onSubmit={() => handleSearch(searchKeyword)} placeholder="搜索厂家名称、地区..."
        showAddButton onAddPress={() => setCreateVisible(true)} enableVoice={true} />

      <MapBottomCard visible={!!selectedMarker}>
        {selectedMarker && (
          <EntityCardContent
            name={selectedMarker.title}
            typeName={MANUFACTURER_TYPES.find(t => t.id === selectedMarker.type)?.name || '厂家'}
            typeColor={getManufacturerColor(selectedMarker.type)}
            infoRows={[
              { label: '注册资本', value: selectedMarker.data?.register_capital || '-', bold: true },
              { label: '主营产品', value: selectedMarker.data?.qualification || '-' },
              { label: '厂家地址', value: selectedMarker.data?.register_address || selectedMarker.data?.address || '-' },
            ]}
            actions={
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.smallButton} onPress={handleShare} activeOpacity={0.7}><Share2 color="#666" size={20} /><Text style={styles.smallButtonText}>分享</Text></TouchableOpacity>
                <TouchableOpacity style={styles.smallButton} onPress={handleLike} activeOpacity={0.7}>
                  <ThumbsUp 
                    color={likedSet.has(selectedMarker.id) ? '#b20000' : '#666'} 
                    fill={likedSet.has(selectedMarker.id) ? '#b20000' : 'transparent'}
                    size={20} 
                  />
                  <Text style={[styles.smallButtonText, likedSet.has(selectedMarker.id) && { color: '#b20000' }]}>
                    {likeCounts[selectedMarker.id] || '点赞'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.largeButton, { backgroundColor: isFavorited ? '#f5f0ff' : '#f2f3f7' }]}
                  onPress={handleFavorite}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.largeButtonText, isFavorited && { color: DayColors.accent }]}>{isFavorited ? '已收藏' : '收藏'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.largeButton, { backgroundColor: '#111827' }]} onPress={handleViewPress}>
                  <Text style={[styles.largeButtonText, { color: '#fff' }]}>查看</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </MapBottomCard>

      <MapListDrawer visible={drawerVisible} title={drawerTitle} items={drawerItems}
        loading={drawerLoading} onClose={() => setDrawerVisible(false)} onItemPress={handleDrawerItemPress}
        colorGetter={getManufacturerColor} emptyText="暂无厂家数据"
        exceededMaxCount={drawerExceededMax} maxCount={1000} />

      {!mapReady && !data && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={DayColors.accent} />
          <Text style={styles.loadingText}>地图加载中...</Text>
        </View>
      )}
      {isFetching && data && (
        <View style={styles.fetchingIndicator}>
          <ActivityIndicator size="small" color={DayColors.accent} />
          <Text style={styles.fetchingText}>加载中...</Text>
        </View>
      )}

      {/* 录入厂家弹窗 */}
      <CreateCustomerSheet
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        title="录入厂家"
        onSuccess={() => {}}
        onRequireLogin={() => navigation.navigate('Login')}
      />

      {/* 分享弹窗 */}
      {sharePayload && (
        <EntityShareModal
          visible={shareModalVisible}
          onClose={() => setShareModalVisible(false)}
          entityName={sharePayload.entityName}
          entityType={sharePayload.entityType}
          registerCapital={sharePayload.registerCapital}
          qualification={sharePayload.qualification}
          address={sharePayload.address}
          entityId={sharePayload.entityId}
          entityTypeLabel="manufacturer"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DayColors.background },
  map: { flex: 1 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 200 },
  loadingText: { marginTop: 12, fontSize: 14, color: DayColors.textSecondary },
  fetchingIndicator: { position: 'absolute', alignSelf: 'center', top: '50%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, gap: 8, zIndex: 90, backgroundColor: 'rgba(255,255,255,0.9)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  fetchingText: { fontSize: 13, fontWeight: '500', color: DayColors.text },
  actionButtons: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  smallButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 8, minWidth: 52, gap: 3 },
  smallButtonText: { fontSize: 11, fontWeight: '500', color: DayColors.textSecondary },
  largeButton: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  largeButtonText: { fontSize: 15, fontWeight: '600', color: '#333' },
  // 图片标记点
  markContainer: {
    width: 32,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markContainerSelected: {
    transform: [{ scale: 1.2 }],
  },
  markImage: {
    width: 28,
    height: 36,
  },
});

export default ManufacturerMapScreen;
