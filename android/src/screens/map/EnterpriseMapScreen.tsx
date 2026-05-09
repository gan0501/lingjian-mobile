/**
 * 找建企 - 日间版地图页面（V2）
 *
 * 白色主题 + 统计面板 + 筛选胶囊 + 底部搜索 + 底部详情卡。
 * 数据通过 useEnterpriseMapData / useEnterpriseTotals 获取。
 */
import React, { FC, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Dimensions, ActivityIndicator, LogBox, Image, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { Share2, ThumbsUp, Heart } from 'lucide-react-native';
import {
  DayColors, getEnterpriseColor, ENTERPRISE_TYPES, FILTER_ICONS,
  MAP_CONFIG, getMapTileStyle, normalizeEnterpriseType,
} from '@/constants';
import {
  useEnterpriseMapData, useEnterpriseTotals, useDebounce,
} from '@/hooks';
import { useLocation } from '@/hooks/useLocation';
import { useMapStore, useAuthStore } from '@/stores';
import { enterpriseApi } from '@/services';
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

// 建企类型到mark图片的映射
const ENTERPRISE_MARK_IMAGES: Record<number, any> = {
  1: require('@/assets/images/mark/green.png'),    // 咨询
  2: require('@/assets/images/mark/blue.png'),     // 设计
  3: require('@/assets/images/mark/yellow.png'),   // 施工
  4: require('@/assets/images/mark/purple.png'),   // 监理
};

// ─── 工具函数 ───
const normalizeType = (e: any): number => {
  const t = Number(e?.enterprise_type ?? e?.type ?? 0);
  return normalizeEnterpriseType(t);
};

// ─── 组件 ───
const EnterpriseMapScreen: FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { isLoggedIn } = useAuthStore();
  const { toast } = useOverlay();
  const { requestLocation } = useLocation();
  const { userLocation } = useMapStore();
  const mapViewRef = useRef<any>(null);

  const [favoriteSet, setFavoriteSet] = useState<Set<string>>(new Set());
  const [favoriteList, setFavoriteList] = useState<any[]>([]);

  // 点赞状态
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  // 地图状态
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [mapZoom, setMapZoom] = useState(10);
  const [mapReady, setMapReady] = useState(false);
  const [center, setCenter] = useState<[number, number]>(MAP_CONFIG.HANGZHOU_CENTER);
  const [cameraKey, setCameraKey] = useState(0);

  // 搜索状态
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const isSearchMode = activeSearchQuery.length > 0;

  // 筛选状态
  const [enterpriseFilters, setEnterpriseFilters] = useState<number[]>([1, 2, 3, 4]);

  // 选中标记
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);

  useEffect(() => {
    if (selectedMarker) {
      Keyboard.dismiss();
    }
  }, [selectedMarker]);

  // 录入弹窗
  const [createVisible, setCreateVisible] = useState(false);

  // 侧边抽屉
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

  // 防抖
  const debouncedBounds = useDebounce(mapBounds, 300);
  const debouncedZoom = useDebounce(mapZoom, 300);

  // 初始化
  useEffect(() => { requestLocation(); }, []);
  useEffect(() => {
    if (userLocation && userLocation.latitude !== 0) {
      setCenter([userLocation.longitude, userLocation.latitude]);
      setCameraKey(prev => prev + 1);
    }
  }, [userLocation]);

  // 超时兜底：3秒后强制移除加载遮罩（瓦片加载失败时 onDidFinishLoadingMap 不触发）
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
        const res = await favoritesApi.list('enterprise');
        console.log('[Enterprise] load favorites res:', res);
        const items = Array.isArray(res) ? res : (res?.result || res?.data || []);
        console.log('[Enterprise] load favorites items:', items);
        if (Array.isArray(items)) {
          setFavoriteList(items);
          setFavoriteSet(new Set(items.map((f: any) => String(f.target_id))));
        }
      } catch (e) {
        console.error('[Enterprise] load favorites error:', e);
      }
    })();
  }, [isLoggedIn]);

  // 数据查询
  const queryParams = useMemo(() => {
    const bounds = isSearchMode
      ? { min_lat: -90, max_lat: 90, min_lon: -180, max_lon: 180 }
      : (debouncedBounds || { min_lat: 30, max_lat: 32, min_lon: 119, max_lon: 121 });
    return {
      bounds,
      zoom: debouncedBounds ? debouncedZoom : 10,
      search: isSearchMode ? activeSearchQuery : undefined,
      enterpriseTypes: isSearchMode ? [1, 2, 3, 4] : enterpriseFilters,
    };
  }, [debouncedBounds, debouncedZoom, isSearchMode, activeSearchQuery, enterpriseFilters]);

  const { data, isLoading, isFetching } = useEnterpriseMapData(queryParams);
  const enterprises = data?.enterprises || [];

  const { data: globalTotals } = useEnterpriseTotals();
  const systemTotal = globalTotals?.total || 0;

  // 标记数据
  const markers = useMemo((): MapMarker[] => {
    return enterprises
      .filter((e: any) => {
        const lat = parseFloat(String(e.lat));
        const lng = parseFloat(String(e.lng || e.lon));
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return false;
        if (isSearchMode) return true;
        return enterpriseFilters.includes(normalizeType(e));
      })
      .map((e: any) => ({
        id: String(e.enterprise_id || e.id),
        latitude: parseFloat(String(e.lat)),
        longitude: parseFloat(String(e.lng || e.lon)),
        title: e.enterprise_name || e.name || '建企',
        type: normalizeType(e),
        data: e,
      }));
  }, [enterprises, enterpriseFilters, isSearchMode]);

  // GeoJSON
  const markersGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: markers
      .filter(m => !isNaN(m.latitude) && !isNaN(m.longitude))
      .map(m => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [m.longitude, m.latitude] },
        properties: {
          id: m.id,
          title: m.title,
          type: m.type,
          color: getEnterpriseColor(m.type),
          selected: selectedMarker?.id === m.id ? 1 : 0,
        },
      })),
  }), [markers, selectedMarker?.id]);

  // 搜索结果
  const searchResults = useMemo((): SearchResultItem[] => {
    if (!isSearchMode) return [];
    return markers.map(m => ({
      id: m.id, name: m.title,
      icon: FILTER_ICONS.enterprise[m.type] || '🏗️',
    }));
  }, [isSearchMode, markers]);

  // 统计栏
  const statsSlots = useMemo((): StatsSlot[] => [
    { label: '系统企业', value: systemTotal },
    { label: isSearchMode ? '搜索结果' : '当前视野', value: markers.length, isAccent: true },
    { label: '收藏建企', value: favoriteSet.size },
    { label: '录入建企', value: 0 },
  ], [systemTotal, markers.length, isSearchMode, favoriteSet.size]);

  // 筛选选项的简短标签映射（4字标签，使用更小字体）
  const FILTER_SHORT_LABELS: Record<number, string> = {
    1: '招标造价',
    2: '设计勘察',
    3: '施工安装',
    4: '监理检测',
  };

  // 筛选选项
  const filterOptions = useMemo((): FilterOption[] =>
    ENTERPRISE_TYPES.map(t => ({
      id: t.id,
      label: t.name,
      shortLabel: FILTER_SHORT_LABELS[t.id],
      color: getEnterpriseColor(t.id),
      icon: FILTER_ICONS.enterprise[t.id] || '🏗️',
    })), []);

  const filterTopOffset = useMemo(() => insets.top + 4 + 48 + 60 + 20, [insets.top]);

  // 事件处理
  const handleSlotPress = useCallback(async (index: number) => {
    const markerToItem = (m: MapMarker): DrawerListItem => ({
      id: m.id, name: m.title,
      subText: ENTERPRISE_TYPES.find(t => t.id === m.type)?.name || '建企',
      icon: FILTER_ICONS.enterprise[m.type] || '🏗️',
      type: m.type, data: m.data,
    });
    switch (index) {
      case 0:
        setDrawerTitle('系统企业'); setDrawerItems([]); setDrawerLoading(true); setDrawerVisible(true);
        try {
          const resp = await enterpriseApi.getMapClusters({ min_lat: -90, max_lat: 90, min_lon: -180, max_lon: 180, zoom: 14 });
          const result = resp?.result || resp;
          const details = result?.details || [];
          setDrawerExceededMax(details.length > 1000);
          setDrawerItems(details.slice(0, 1000).map((e: any) => ({
            id: String(e.enterprise_id || e.id),
            name: e.enterprise_name || e.name || '建企',
            subText: ENTERPRISE_TYPES.find(t => t.id === normalizeType(e))?.name || '建企',
            icon: FILTER_ICONS.enterprise[normalizeType(e)] || '🏗️',
            type: normalizeType(e), data: e,
          })));
        } catch {} finally { setDrawerLoading(false); }
        break;
      case 1:
        setDrawerTitle('当前视野'); setDrawerItems(markers.map(markerToItem));
        setDrawerExceededMax(false); setDrawerVisible(true); break;
      case 2:
        setDrawerTitle('收藏建企');
        setDrawerItems(favoriteList.map((f: any) => ({
          id: String(f.target_id),
          name: f.target_name || '建企',
          subText: ENTERPRISE_TYPES.find(t => t.id === normalizeType(f.target_data))?.name || '建企',
          icon: FILTER_ICONS.enterprise[normalizeType(f.target_data)] || '🏗️',
          type: normalizeType(f.target_data),
          data: f.target_data || {},
        })));
        setDrawerExceededMax(false); setDrawerVisible(true); break;
      case 3:
        setDrawerTitle('录入建企'); setDrawerItems([]);
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
            title: item.data.enterprise_name || item.data.name || item.name || '建企',
            type: normalizeType(item.data),
            data: item.data,
          };
        }
        if (found) setSelectedMarker(found);
      }
    } else {
      const eid = item.data?.enterprise_id || item.data?.id || Number(item.id);
      navigation.navigate('EnterpriseDetail', { enterpriseId: eid, enterpriseType: item.data?.enterprise_type });
    }
  }, [markers, navigation]);

  const handleSearch = useCallback((text: string) => {
    setActiveSearchQuery(text.trim());
  }, []);

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
    const id = selectedMarker.data?.enterprise_id || selectedMarker.data?.id || Number(selectedMarker.id);
    const etype = selectedMarker.data?.enterprise_type;
    setSelectedMarker(null);
    navigation.navigate('EnterpriseDetail', { enterpriseId: id, enterpriseType: etype });
  }, [selectedMarker, navigation]);

  const handleFavorite = useCallback(async () => {
    if (!selectedMarker || !isLoggedIn) {
      toast.info('请先登录后收藏');
      return;
    }
    const id = selectedMarker.id;
    try {
      if (favoriteSet.has(id)) {
        const res = await favoritesApi.remove(id, 'enterprise');
        console.log('[Enterprise] remove favorite res:', res);
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
        const res = await favoritesApi.add({ target_id: id, target_type: 'enterprise', target_name: selectedMarker.title, target_data: dataToSave });
        console.log('[Enterprise] add favorite res:', res);
        setFavoriteSet(prev => new Set(prev).add(id));
        setFavoriteList(prev => [...prev, { target_id: id, target_name: selectedMarker.title, target_data: dataToSave }]);
        toast.success('已收藏');
      }
    } catch (e) { 
      console.error('[Enterprise] favorite error:', e);
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
      const res = await likesApi.toggle(id, 'enterprise');
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
      entityType: ENTERPRISE_TYPES.find(t => t.id === selectedMarker.type)?.name || '建企',
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

  // ─── 渲染 ───
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* 地图 */}
      <MapLibreGL.MapView
        ref={mapViewRef}
        style={styles.map}
        mapStyle={MAP_STYLE as any}
        onDidFinishLoadingMap={handleMapReady}
        onRegionDidChange={handleRegionChange}
        onPress={() => setSelectedMarker(null)}
      >
        <MapLibreGL.Camera
          key={`camera-${cameraKey}`}
          centerCoordinate={center}
          zoomLevel={10}
          minZoomLevel={4}
          maxZoomLevel={18}
          animationMode="flyTo"
          animationDuration={1500}
        />
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
            id="enterprise-markers" 
            shape={markersGeoJSON as any} 
            onPress={handleMarkerPress}
          >
            <MapLibreGL.SymbolLayer
              id="enterprise-icons"
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

      {/* 头部 */}
      <MapHeader title="找建企" onBack={() => navigation.goBack()}>
        <MapStatsPanel
          slots={statsSlots}
          loading={isFetching}
          isSearchMode={isSearchMode}
          searchResults={searchResults}
          onSearchItemPress={handleSearchItemPress}
          onSlotPress={handleSlotPress}
        />
      </MapHeader>

      {/* 筛选胶囊 */}
      <MapFilterCapsule
        options={filterOptions}
        selected={enterpriseFilters}
        onChange={setEnterpriseFilters}
        topOffset={filterTopOffset}
      />

      {/* 底部搜索栏 */}
      <MapSearchBar
        value={searchKeyword}
        onChangeText={setSearchKeyword}
        onSubmit={() => handleSearch(searchKeyword)}
        placeholder="搜索企业名称、法人..."
        showAddButton={true}
        onAddPress={() => setCreateVisible(true)}
        enableVoice={true}
      />

      {/* 底部详情卡 */}
      <MapBottomCard visible={!!selectedMarker}>
        {selectedMarker && (
          <EntityCardContent
            name={selectedMarker.title}
            typeName={ENTERPRISE_TYPES.find(t => t.id === selectedMarker.type)?.name || '建企'}
            typeColor={getEnterpriseColor(selectedMarker.type)}
            infoRows={[
              { label: '注册资本', value: selectedMarker.data?.register_capital || '-', bold: true },
              { label: '资质信息', value: selectedMarker.data?.qualification || '-' },
              { label: '企业地址', value: selectedMarker.data?.register_address || selectedMarker.data?.address || '-' },
            ]}
            actions={
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.smallButton} onPress={handleShare} activeOpacity={0.7}>
                  <Share2 color="#666" size={20} />
                  <Text style={styles.smallButtonText}>分享</Text>
                </TouchableOpacity>
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
                  style={[styles.largeButton, { backgroundColor: favoriteSet.has(selectedMarker.id) ? '#f5f0ff' : '#f2f3f7' }]}
                  onPress={handleFavorite}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.largeButtonText, favoriteSet.has(selectedMarker.id) && { color: DayColors.accent }]}>
                    {favoriteSet.has(selectedMarker.id) ? '已收藏' : '收藏'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.largeButton, { backgroundColor: '#111827' }]} onPress={handleViewPress} activeOpacity={0.8}>
                  <Text style={[styles.largeButtonText, { color: '#fff' }]}>查看</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </MapBottomCard>

      {/* 加载遮罩：仅在首次加载且无数据时显示 */}
      {!mapReady && !data && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={DayColors.accent} />
          <Text style={styles.loadingText}>地图加载中...</Text>
        </View>
      )}

      {/* 视窗刷新指示器 */}
      {isFetching && data && (
        <View style={styles.fetchingIndicator}>
          <ActivityIndicator size="small" color={DayColors.accent} />
          <Text style={styles.fetchingText}>加载中...</Text>
        </View>
      )}

      {/* 录入建企弹窗 */}
      <CreateCustomerSheet
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        title="录入建企"
        onSuccess={() => {}}
        onRequireLogin={() => navigation.navigate('Login')}
      />

      {/* 侧边抽屉 */}
      <MapListDrawer
        visible={drawerVisible}
        title={drawerTitle}
        items={drawerItems}
        loading={drawerLoading}
        onClose={() => setDrawerVisible(false)}
        onItemPress={handleDrawerItemPress}
        colorGetter={getEnterpriseColor}
        emptyText="暂无企业数据"
        exceededMaxCount={drawerExceededMax}
        maxCount={1000}
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
          entityTypeLabel="enterprise"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DayColors.background },
  map: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  loadingText: { marginTop: 12, fontSize: 14, color: DayColors.textSecondary },
  fetchingIndicator: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    zIndex: 90,
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
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

export default EnterpriseMapScreen;
