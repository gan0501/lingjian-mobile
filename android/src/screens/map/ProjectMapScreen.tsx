/**
 * 找项目 - 日间版地图页面（V2）
 *
 * 功能最丰富的地图页面：
 *   - 三模式（聚合/详细/搜索）
 *   - 跟进项目旗帜标记
 *   - 底部卡片（分享/协作/跟进/查看）
 *   - 统计栏点击弹出侧边抽屉
 *   - 新建项目
 */
import React, { FC, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Dimensions, ActivityIndicator, LogBox, Modal, ScrollView, Image, Keyboard, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { X, User, Flag } from 'lucide-react-native';
import { SmartProjectFinderSheet } from './components/SmartProjectFinderSheet';
import { useAgentTaskStore } from '@/stores';
import {
  DayColors, getProjectColor, PROJECT_TYPES, FILTER_ICONS,
  MAP_CONFIG, getMapTileStyle,
} from '@/constants';
import {
  useProjectMapData, useProjectTotals, useDebounce,
} from '@/hooks';
import { useLocation } from '@/hooks/useLocation';
import { useMapStore, useAuthStore, useFollowedProjectStore, useFlagStore } from '@/stores';
import { projectApi, collaborationApi } from '@/services';
import type { CollaboratorInfo } from '@/services';
import {
  MapHeader, MapStatsPanel, MapFilterCapsule,
  MapBottomCard, ProjectCardContent, MapSearchBar, MapListDrawer,
  FlagSettingsSheet, FLAG_IMAGES,
  CreateProjectSheet,
  TimeFilterValue,
  AnimatedFinderButton,
  TimeFilterSheet,
} from '@/components/map';
import buildIcon from '@/assets/images/buildicon.png';
import gooffice from '@/assets/images/gooffice.png';
import flagIcon from '@/assets/images/flagicon.png';
import ShareModal from '@/components/share/ShareModal';
import CollaborateModal from '@/components/share/CollaborateModal';
import { useOverlay } from '@/components/overlay';
import { useAIToolGuard } from '@/hooks';

import type { MapBounds, StatsSlot, FilterOption, MapMarker, SearchResultItem, DrawerListItem } from '@/types';

LogBox.ignoreLogs(['MapLibre error', 'Failed to load tile', '{TextureViewRend}', 'stream was reset', 'Request failed due to a permanent error']);

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_STYLE = getMapTileStyle();

// 项目类型到mark图片的映射
const PROJECT_MARK_IMAGES: Record<number, any> = {
  1: require('@/assets/images/mark/red.png'),      // 规划报建
  2: require('@/assets/images/mark/blue.png'),     // 土地出让
  3: require('@/assets/images/mark/green.png'),    // 招标投标
  4: require('@/assets/images/mark/purple.png'),   // 政府采购
  5: require('@/assets/images/mark/brown.png'),    // 自建项目
};

// 筛选项（包含系统类型和自建项目）
const BASE_FILTER_OPTIONS = PROJECT_TYPES;

const normalizeType = (p: any): number => {
  const t = Number(p?.type ?? p?.section ?? p?.project_type ?? 0);
  return (t >= 1 && t <= 5) ? t : 1;
};

/**
 * 根据发布时间计算透明度
 * 1个月以内: 1.0
 * 1-3个月: 0.75
 * 3-6个月: 0.5
 * 6个月以前: 0.25
 */
const calculateOpacity = (publishTime: string | null | undefined): number => {
  if (!publishTime) return 0.5;
  try {
    const publishDate = new Date(publishTime);
    const now = new Date();
    const diffMs = now.getTime() - publishDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const diffMonths = diffDays / 30;

    if (diffMonths <= 1) return 1.0;
    if (diffMonths <= 3) return 0.75;
    if (diffMonths <= 6) return 0.5;
    return 0.25;
  } catch {
    return 0.5;
  }
};

/**
 * 检查项目是否符合时间筛选条件
 */
const isWithinTimeFilter = (publishTime: string | null | undefined, filter: TimeFilterValue): boolean => {
  if (filter === 'all') return true;
  if (!publishTime) return false;
  try {
    const publishDate = new Date(publishTime);
    const now = new Date();
    const diffMs = now.getTime() - publishDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const diffMonths = diffDays / 30;

    switch (filter) {
      case '1m': return diffMonths <= 1;
      case '3m': return diffMonths <= 3;
      case '6m': return diffMonths <= 6;
      default: return true;
    }
  } catch {
    return false;
  }
};

const ProjectMapScreen: FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { isLoggedIn } = useAuthStore();
  const { requestLocation } = useLocation();
  const { confirm, alert: showAlert, toast } = useOverlay();
  const { userLocation, projectFilters, setProjectFilters } = useMapStore();
  const { getCount: getFollowedCount, loadFollowedProjects, addProject: addFollowedProject, getFollowedProjects, followedProjects } = useFollowedProjectStore();
  const { flagSettings } = useFlagStore();
  const [flagSettingsVisible, setFlagSettingsVisible] = useState(false);
  const [smartFinderVisible, setSmartFinderVisible] = useState(false);
  const smartFinderGuard = useAIToolGuard('project_finder');
  const [createProjectVisible, setCreateProjectVisible] = useState(false);
  const projectFinderAgent = useAgentTaskStore(s => s.getAgent('project_finder'));
  const smartFinderRunning = projectFinderAgent?.status === 'working';
  const mapViewRef = useRef<any>(null);

  // 地图状态
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [mapZoom, setMapZoom] = useState(10);
  const [mapReady, setMapReady] = useState(false);
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);

  // 搜索
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const isSearchMode = activeSearchQuery.length > 0;

  // 筛选（从 store 获取，默认全选，包含自建项目）
  const activeFilters = projectFilters || [1, 2, 3, 4, 5];

  // 时间筛选状态
  const [timeFilter, setTimeFilter] = useState<TimeFilterValue>('all');
  const [timeFilterSheetVisible, setTimeFilterSheetVisible] = useState(false);

  // 选中
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);

  useEffect(() => {
    if (selectedMarker) {
      Keyboard.dismiss();
    }
  }, [selectedMarker]);

  // 抽屉
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState('');
  const [drawerItems, setDrawerItems] = useState<DrawerListItem[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerExceededMax, setDrawerExceededMax] = useState(false);

  // 分享
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [sharePayload, setSharePayload] = useState<any>(null);

  // 协作
  const [collaborateModalVisible, setCollaborateModalVisible] = useState(false);
  const [collaboratePayload, setCollaboratePayload] = useState<{ internalProjectId: string; projectName: string } | null>(null);
  const [collaboratorCount, setCollaboratorCount] = useState(0);

  // 协作者列表
  const [collaboratorListVisible, setCollaboratorListVisible] = useState(false);
  const [collaboratorList, setCollaboratorList] = useState<CollaboratorInfo[]>([]);

  // 防抖
  const debouncedBounds = useDebounce(mapBounds, 300);
  const debouncedZoom = useDebounce(mapZoom, 300);

  // 初始化：先请求定位，根据结果设置中心点
  useEffect(() => {
    const initLocation = async () => {
      const hasPermission = await requestLocation();
      if (!hasPermission || !userLocation || userLocation.latitude === 0) {
        // 无权限或定位失败，使用默认位置（杭州）
        setCenter(MAP_CONFIG.HANGZHOU_CENTER);
      }
      setLocationReady(true);
    };
    initLocation();
    if (isLoggedIn) loadFollowedProjects(true);
  }, [isLoggedIn]);

  // 定位成功后更新中心点（只执行一次，避免GPS抖动导致无限循环）
  const initialLocationSet = useRef(false);
  useEffect(() => {
    if (!initialLocationSet.current && userLocation && userLocation.latitude !== 0) {
      initialLocationSet.current = true;
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

  // 数据查询
  const queryParams = useMemo(() => {
    if (isSearchMode) {
      return { keyword: activeSearchQuery, projectTypes: activeFilters };
    }
    const bounds = debouncedBounds || { min_lat: 30, max_lat: 32, min_lon: 119, max_lon: 121 };
    return { bounds, zoom: debouncedZoom || 10, projectTypes: activeFilters };
  }, [debouncedBounds, debouncedZoom, isSearchMode, activeSearchQuery, activeFilters]);

  const { data, isLoading, isFetching, refetch } = useProjectMapData(queryParams as any);
  const { data: globalTotals } = useProjectTotals(activeFilters);
  const systemTotal = globalTotals?.totalCount || 0;

  // 构建标记
  const markers = useMemo((): MapMarker[] => {
    const result: MapMarker[] = [];
    const seenIds = new Set<string>();

    // 1. 先添加跟进项目（受筛选控制）
    const followedProjects = getFollowedProjects();
    for (const fp of followedProjects) {
      const lat = parseFloat(String(fp.lat));
      const lng = parseFloat(String(fp.lng));
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

      // 检查项目类型是否在筛选范围内
      const projectType = fp.type || fp.section || 2;
      if (!activeFilters.includes(projectType)) continue;

      const externalId = String(fp.external_project_id || fp.project_id || fp.id);

      // 去重检查：如果已经添加过，跳过
      if (seenIds.has(externalId)) continue;
      seenIds.add(externalId);

      // 时间筛选
      const publishTime = fp.publish_time || fp.publish_time_1 || fp.publish_time_4 || fp.announcement_pub_time || fp.created_at;
      if (!isWithinTimeFilter(publishTime, timeFilter)) continue;

      result.push({
        id: externalId,
        latitude: lat,
        longitude: lng,
        title: fp.project_name || '跟进项目',
        type: projectType,
        data: {
          ...fp,
          project_category: fp.project_category || 'followed',
          users_project_id: fp.id,
        },
        isFollowed: true,
        opacity: calculateOpacity(publishTime),
      });
    }

    // 2. 添加API返回的项目数据
    if (!data) return result;

    if (data.mode === 'cluster' && data.clusters) {
      data.clusters.forEach((c: any) => {
        const clusterId = `cluster-${c.id}`;
        if (seenIds.has(clusterId)) return;
        seenIds.add(clusterId);
        result.push({
          id: clusterId,
          latitude: c.lat,
          longitude: c.lng,
          title: `${c.count}个项目`,
          type: c.type,
          isCluster: true,
          count: c.count,
        });
      });
      return result;
    }

    const projects = data.projects || data.searchResults || [];
    projects.forEach((p: any) => {
      const lat = parseFloat(String(p.lat));
      const lng = parseFloat(String(p.lng || p.lon));
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

      const externalId = String(p.id);
      if (seenIds.has(externalId)) return;
      seenIds.add(externalId);

      // 时间筛选
      const publishTime = p.publish_time || p.publish_time_1 || p.publish_time_4 || p.announcement_pub_time || p.created_at;
      if (!isWithinTimeFilter(publishTime, timeFilter)) return;

      result.push({
        id: externalId,
        latitude: lat,
        longitude: lng,
        title: p.project_name || p.resource_name || p.name || '项目',
        type: normalizeType(p),
        data: p,
        isFollowed: false,
        opacity: calculateOpacity(publishTime),
      });
    });

    return result;
  }, [data, activeFilters, followedProjects, getFollowedProjects, timeFilter]);

  // GeoJSON（区分聚合球和详细标记）
  const markersGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: markers
      .filter(m => !m.isCluster && !isNaN(m.latitude) && !isNaN(m.longitude))
      .map(m => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [m.longitude, m.latitude] },
        properties: {
          id: m.id, title: m.title, type: m.type,
          color: getProjectColor(m.type),
          opacity: m.opacity ?? 1.0,
          selected: selectedMarker?.id === m.id ? 1 : 0,
          isFollowed: m.isFollowed ? 1 : 0,
        },
      })),
  }), [markers, selectedMarker?.id]);

  const clustersGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: markers
      .filter(m => m.isCluster && !isNaN(m.latitude) && !isNaN(m.longitude))
      .map(m => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [m.longitude, m.latitude] },
        properties: {
          id: m.id, count: m.count || 0, type: m.type,
          color: getProjectColor(m.type),
          label: m.count && m.count >= 10000 ? `${(m.count / 10000).toFixed(1)}万` : String(m.count || 0),
        },
      })),
  }), [markers]);

  const isClusterMode = data?.mode === 'cluster';

  // 搜索结果
  const searchResults = useMemo((): SearchResultItem[] => {
    if (!isSearchMode) return [];
    return markers.filter(m => !m.isCluster).map(m => ({
      id: m.id, name: m.title,
      icon: FILTER_ICONS.project[m.type] || '📍',
    }));
  }, [isSearchMode, markers]);

  // 统计
  const statsSlots = useMemo((): StatsSlot[] => {
    const visibleCount = isClusterMode
      ? markers.reduce((sum, m) => sum + (m.count || 0), 0)
      : markers.length;
    
    const followedCount = followedProjects.length;
    
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weeklyUpdatedCount = followedProjects.filter((p: any) => {
      const updateTime = p.updated_at || p.created_at;
      if (updateTime) {
        const updateDate = new Date(updateTime);
        return updateDate >= weekAgo;
      }
      return false;
    }).length;
    
    return [
      { label: '系统项目', value: systemTotal },
      { label: isSearchMode ? '搜索结果' : '当前视野', value: visibleCount, isAccent: true },
      { label: '跟进项目', value: followedCount },
      { label: '本周维护', value: weeklyUpdatedCount },
    ];
  }, [systemTotal, markers, isClusterMode, isSearchMode, followedProjects]);

  // 筛选选项的简短标签映射
  const FILTER_SHORT_LABELS: Record<number, string> = {
    1: '工程规划',
    2: '土地交易',
    3: '招标公告',
    4: '采购意向',
    5: '自建项目',
  };

  const filterOptions = useMemo((): FilterOption[] =>
    BASE_FILTER_OPTIONS.map(t => ({
      id: t.id,
      label: t.name,
      shortLabel: FILTER_SHORT_LABELS[t.id],
      color: getProjectColor(t.id),
      icon: FILTER_ICONS.project[t.id] || '📍',
    })), []);

  const filterTopOffset = useMemo(() => insets.top + 4 + 48 + 60 + 20, [insets.top]);

  // ─── 事件处理 ───

  const handleSearch = useCallback((text: string) => {
    setActiveSearchQuery(text.trim());
  }, []);

  const handleFilterChange = useCallback((selected: number[]) => {
    setProjectFilters(selected);
  }, [setProjectFilters]);

  const handleRegionChange = useCallback((feature: any) => {
    try {
      const props = feature?.properties;
      const bounds = props?.visibleBounds;
      if (bounds?.length === 2) {
        const [ne, sw] = bounds;
        setMapBounds({ min_lat: sw[1], max_lat: ne[1], min_lon: sw[0], max_lon: ne[0] });
      }
      if (props?.zoomLevel) setMapZoom(props.zoomLevel);
      // 注意：不要在这里更新 center，否则会导致 Camera 飞移
      // center 应该只在用户主动操作时（如定位、搜索、点击标记）更新
    } catch {}
  }, []);

  const handleMarkerPress = useCallback((e: any) => {
    Keyboard.dismiss();
    const feature = e?.features?.[0];
    if (!feature) return;
    const found = markers.find(m => m.id === feature.properties?.id);
    if (found) {
      if (found.isCluster) {
        setCenter([found.longitude, found.latitude]);
        setMapZoom(prev => Math.min(prev + 2, 18));
        setCameraKey(prev => prev + 1);
      } else {
        setSelectedMarker(found);
      }
    }
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

  const handleSearchItemPress = useCallback((item: SearchResultItem) => {
    Keyboard.dismiss();
    const found = markers.find(m => m.id === item.id);
    if (found) {
      setCenter([found.longitude, found.latitude]);
      setCameraKey(prev => prev + 1);
      setSelectedMarker(found);
    }
  }, [markers]);

  const handleFollowProject = useCallback(async () => {
    if (!selectedMarker) return;
    if (!isLoggedIn) {
      confirm({
        title: '提示',
        message: '请先登录后才能跟进项目',
        confirmText: '去登录',
        cancelText: '取消',
        onConfirm: () => navigation.navigate('Login'),
      });
      return;
    }
    try {
      const res = await projectApi.follow({
        project_id: selectedMarker.id,
        project_type: selectedMarker.type,
        project_name: selectedMarker.title,
        project_data: selectedMarker.data,
      });
      setSelectedMarker(prev => prev ? { ...prev, isFollowed: true, data: { ...prev.data, users_project_id: (res as any)?.id || prev.data?.users_project_id } } : null);
      // 更新跟进缓存
      const now = new Date().toISOString();
      addFollowedProject({
        id: (res as any)?.id || selectedMarker.id,
        external_project_id: selectedMarker.id,
        project_id: selectedMarker.id,
        project_name: selectedMarker.title,
        type: selectedMarker.type,
        section: selectedMarker.type,
        lat: selectedMarker.latitude,
        lng: selectedMarker.longitude,
        project_category: 'followed',
        created_at: now,
        updated_at: now,
        ...selectedMarker.data,
      });
      toast.success('项目已加入跟进列表');
    } catch (e: any) {
      const status = e?.status || 0;
      const rawMsg = e?.data?.message || e?.data?.detail || e?.message || '';
      const isAuthError = status === 401 || status === 403 || rawMsg.includes('Unauthorized') || rawMsg.includes('Forbidden');

      if (isAuthError) {
        confirm({
          title: status === 403 ? '权限不足' : '登录已过期',
          message: status === 403
            ? '您没有权限执行此操作，可能需要升级会员'
            : '您的登录状态已失效，请重新登录后操作',
          confirmText: status === 403 ? '开通会员' : '去登录',
          cancelText: '取消',
          onConfirm: () => navigation.navigate(status === 403 ? 'MembershipPay' : 'Login'),
        });
        return;
      }

      let errorMessage = rawMsg || '请稍后再试';
      const isLimitError = errorMessage.includes('最多只能跟进');
      if (isLimitError) {
        confirm({
          title: '跟进失败',
          message: errorMessage,
          confirmText: '升级账户',
          cancelText: '暂不考虑',
          onConfirm: () => navigation.navigate('MembershipPay'),
        });
      } else {
        showAlert({ title: '跟进失败', message: errorMessage });
      }
    }
  }, [selectedMarker, isLoggedIn, navigation, confirm, showAlert, toast]);

  const handleViewDetail = useCallback(() => {
    if (!selectedMarker) return;
    const d = selectedMarker.data as any;
    const internalId = String(
      d?.users_project_id || d?.followed_project_id || d?.follow_project_id || selectedMarker.id
    );
    setSelectedMarker(null);
    navigation.navigate('ProjectFollow', {
      projectId: internalId,
      projectName: selectedMarker.title,
      projectType: selectedMarker.type,
    });
  }, [selectedMarker, navigation]);

  // 分享
  const handleShare = useCallback(() => {
    if (!selectedMarker?.data) return;
    const d = selectedMarker.data;
    const type = selectedMarker.type;
    const clean = (v: any) => { const s = String(v ?? '').trim(); return s || '-'; };
    let c = '-', sc = '-', ad = '-', pt = '-';
    if (type === 1) { c = clean(d.building_company_name); sc = clean(d.area || d.area_desc); ad = clean(d.project_address); pt = clean(d.publish_time); }
    else if (type === 2) { c = clean(d.the_unit); sc = clean(d.transfer_area || d.land_area); ad = clean(d.resource_location); pt = clean(d.announcement_pub_time || d.create_time); }
    else if (type === 3) { c = clean(d.tender_unit || d.developer_company_name); sc = clean(d.bid_amount || d.project_cost); ad = clean(d.project_address || d.city); pt = clean(d.publish_time || d.publish_time_1 || d.publish_time_4); }
    else if (type === 4) { c = clean(d.purchaser_name); sc = clean(d.budget_amount); ad = clean(d.project_address || d.city); pt = clean(d.publish_time || d.publish_time_1 || d.publish_time_4); }
    else { c = clean(d.constructor_name || d.building_company_name || d.company_name); sc = clean(d.area || d.scale); ad = clean(d.project_address || d.address); pt = clean(d.publish_time || d.created_at); }

    setSharePayload({
      projectName: selectedMarker.title,
      projectType: PROJECT_TYPES.find(t => t.id === type)?.name || '项目',
      constructor: c, scale: sc, address: ad, publishTime: pt,
      projectId: String(selectedMarker.id),
    });
    setShareModalVisible(true);
  }, [selectedMarker]);

  // 协作
  const handleCollaborate = useCallback(() => {
    if (!isLoggedIn) {
      confirm({
        title: '提示',
        message: '请先登录后才能邀请协作',
        confirmText: '去登录',
        cancelText: '取消',
        onConfirm: () => navigation.navigate('Login'),
      });
      return;
    }
    if (!selectedMarker?.data) return;
    const d = selectedMarker.data as any;
    let internalId = String(
      d.users_project_id || d.followed_project_id || d.follow_project_id || ''
    );
    if (!internalId && selectedMarker.isFollowed) {
      const fp = getFollowedProjects().find((p: any) =>
        String(p.external_project_id || p.project_id) === String(selectedMarker.id)
      );
      if (fp) internalId = String(fp.id);
    }
    if (!selectedMarker.isFollowed && !internalId) {
      showAlert({ title: '提示', message: '请先跟进该项目后再邀请协作' });
      return;
    }
    setCollaboratePayload({
      internalProjectId: internalId || String(selectedMarker.id),
      projectName: selectedMarker.title,
    });
    setCollaborateModalVisible(true);
  }, [selectedMarker, isLoggedIn, navigation, getFollowedProjects]);

  // 协作者列表
  const handleShowCollaborators = useCallback(async () => {
    if (!selectedMarker?.data) return;
    const d = selectedMarker.data as any;
    let internalId = String(
      d.users_project_id || d.followed_project_id || d.follow_project_id || ''
    );
    if (!internalId && selectedMarker.isFollowed) {
      const fp = getFollowedProjects().find((p: any) =>
        String(p.external_project_id || p.project_id) === String(selectedMarker.id)
      );
      if (fp) internalId = String(fp.id);
    }
    if (!internalId) {
      setCollaboratorList([]);
      setCollaboratorCount(0);
      setCollaboratorListVisible(true);
      return;
    }
    try {
      const list = await collaborationApi.getCollaborators(internalId);
      const result = Array.isArray(list) ? list : [];
      setCollaboratorList(result);
      setCollaboratorCount(result.length);
      setCollaboratorListVisible(true);
    } catch (err: any) {
      console.log('[协作者] 错误:', err);
      setCollaboratorList([]);
      setCollaboratorCount(0);
      setCollaboratorListVisible(true);
    }
  }, [selectedMarker, getFollowedProjects]);

  // 加载协作者计数（选中标记变化时）
  useEffect(() => {
    if (!selectedMarker?.data || selectedMarker.isCluster) {
      setCollaboratorCount(0);
      return;
    }
    const d = selectedMarker.data as any;
    let internalId = String(
      d.users_project_id || d.followed_project_id || d.follow_project_id || ''
    );
    if (!internalId && selectedMarker.isFollowed) {
      const fp = getFollowedProjects().find((p: any) =>
        String(p.external_project_id || p.project_id) === String(selectedMarker.id)
      );
      if (fp) internalId = String(fp.id);
    }
    if (internalId) {
      collaborationApi.getCollaborators(internalId)
        .then(list => setCollaboratorCount(Array.isArray(list) ? list.length : 0))
        .catch(() => setCollaboratorCount(0));
    } else {
      setCollaboratorCount(0);
    }
  }, [selectedMarker?.id, selectedMarker?.isFollowed]);

  // 统计栏点击
  const handleSlotPress = useCallback(async (index: number) => {
    const markerToItem = (m: MapMarker): DrawerListItem => ({
      id: m.id, name: m.title,
      subText: PROJECT_TYPES.find(t => t.id === m.type)?.name || '项目',
      icon: FILTER_ICONS.project[m.type] || '📍',
      type: m.type, data: m.data,
    });
    switch (index) {
      case 0: // 系统项目
        setDrawerTitle('系统项目'); setDrawerItems([]); setDrawerLoading(true); setDrawerVisible(true);
        try {
          const result = await projectApi.getProjectClusters({
            min_lat: -90, max_lat: 90, min_lon: -180, max_lon: 180,
            zoom: 14, search: '', project_types: activeFilters.join(','),
          });
          const projects = result?.projects || [];
          setDrawerExceededMax(projects.length > 1000);
          setDrawerItems(projects.slice(0, 1000).map((p: any) => ({
            id: String(p.id), name: p.name || p.project_name || '项目',
            subText: PROJECT_TYPES.find(t => t.id === normalizeType(p))?.name || '项目',
            icon: FILTER_ICONS.project[normalizeType(p)] || '📍',
            type: normalizeType(p), data: p,
          })));
        } catch {} finally { setDrawerLoading(false); }
        break;
      case 1: // 当前视野
        setDrawerTitle('当前视野');
        setDrawerItems(markers.filter(m => !m.isCluster).map(markerToItem));
        setDrawerExceededMax(false); setDrawerVisible(true); break;
      case 2: // 跟进项目
        setDrawerTitle('跟进项目');
        const followedProjects = getFollowedProjects();
        setDrawerItems(followedProjects.map((fp: any) => ({
          id: String(fp.external_project_id || fp.project_id || fp.id),
          name: fp.project_name || '跟进项目',
          subText: PROJECT_TYPES.find(t => t.id === (fp.type || fp.section || 2))?.name || '项目',
          icon: FILTER_ICONS.project[fp.type || fp.section || 2] || '📍',
          type: fp.type || fp.section || 2,
          data: {
            ...fp,
            lat: fp.lat,
            lng: fp.lng,
            users_project_id: fp.id,
          },
        })));
        setDrawerExceededMax(false); setDrawerVisible(true); break;
      case 3: // 本周维护
        setDrawerTitle('本周维护');
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const weeklyUpdated = getFollowedProjects().filter((fp: any) => {
          const updateTime = fp.updated_at || fp.created_at;
          if (updateTime) {
            const updateDate = new Date(updateTime);
            return updateDate >= weekAgo;
          }
          return false;
        });
        setDrawerItems(weeklyUpdated.map((fp: any) => ({
          id: String(fp.external_project_id || fp.project_id || fp.id),
          name: fp.project_name || '跟进项目',
          subText: PROJECT_TYPES.find(t => t.id === (fp.type || fp.section || 2))?.name || '项目',
          icon: FILTER_ICONS.project[fp.type || fp.section || 2] || '📍',
          type: fp.type || fp.section || 2,
          data: {
            ...fp,
            lat: fp.lat,
            lng: fp.lng,
            users_project_id: fp.id,
          },
        })));
        setDrawerExceededMax(false); setDrawerVisible(true); break;
    }
  }, [markers, activeFilters, getFollowedProjects]);

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
            id: String(item.data.project_id || item.data.id || item.id),
            latitude: lat,
            longitude: lng,
            title: item.data.project_name || item.data.name || item.name || '项目',
            type: normalizeType(item.data),
            data: item.data,
          };
        }
        if (found) setSelectedMarker(found);
      }
    } else {
      navigation.navigate('ProjectDetail', { projectId: item.id });
    }
  }, [markers, navigation]);

  // ─── 渲染 ───

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <MapLibreGL.MapView
        ref={mapViewRef}
        style={styles.map}
        mapStyle={MAP_STYLE as any}
        onDidFinishLoadingMap={handleMapReady}
        onRegionDidChange={handleRegionChange}
        onPress={() => setSelectedMarker(null)}
      >
        {center && (
          <MapLibreGL.Camera
            key={`cam-${cameraKey}`}
            centerCoordinate={center}
            zoomLevel={mapZoom}
            minZoomLevel={4}
            maxZoomLevel={18}
            animationMode="flyTo"
            animationDuration={1500}
          />
        )}

        {/* 聚合球 */}
        {isClusterMode && (
          <MapLibreGL.ShapeSource id="project-clusters" shape={clustersGeoJSON as any} onPress={handleMarkerPress}>
            <MapLibreGL.CircleLayer
              id="cluster-circles"
              style={{
                circleRadius: 22,
                circleColor: ['get', 'color'] as any,
                circleOpacity: 0.85,
                circleStrokeWidth: 3,
                circleStrokeColor: '#FFFFFF',
              }}
            />
            <MapLibreGL.SymbolLayer
              id="cluster-labels"
              style={{
                textField: ['get', 'label'] as any,
                textSize: 11,
                textColor: '#FFFFFF',
                textAllowOverlap: true,
                textIgnorePlacement: true,
              }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* 详细标记（非跟进项目用图片标记） */}
        {!isClusterMode && (
          <>
            {/* 预加载图片到地图 */}
            <MapLibreGL.Images images={{
              'mark-red': require('@/assets/images/mark/red.png'),
              'mark-blue': require('@/assets/images/mark/blue.png'),
              'mark-green': require('@/assets/images/mark/green.png'),
              'mark-purple': require('@/assets/images/mark/purple.png'),
              'mark-brown': require('@/assets/images/mark/brown.png'),
            }} />
            
            <MapLibreGL.ShapeSource 
              id="project-markers" 
              shape={markersGeoJSON as any} 
              onPress={handleMarkerPress}
            >
              <MapLibreGL.SymbolLayer
                id="project-icons"
                filter={['==', ['get', 'isFollowed'], 0]}
                style={{
                  iconImage: ['match', ['get', 'type'],
                    1, 'mark-red',
                    2, 'mark-blue',
                    3, 'mark-green',
                    4, 'mark-purple',
                    5, 'mark-brown',
                    'mark-blue'
                  ] as any,
                  iconSize: ['case',
                    ['==', ['get', 'selected'], 1], 0.35,
                    0.28,
                  ] as any,
                  iconOpacity: ['get', 'opacity'] as any,
                  iconAllowOverlap: true,
                  iconIgnorePlacement: true,
                }}
              />
            </MapLibreGL.ShapeSource>
          </>
        )}

        {/* 跟进项目旗帜标记 (MarkerView) - 不应用时间透明度 */}
        {!isClusterMode && markers.filter(m => m.isFollowed).map(m => {
          const isCollaborator = m.data?.project_category === 'collaborated' || m.data?.role === 'collaborator';
          const flagColor = flagSettings.colorIndex;
          const flagText = flagSettings.text || '旗';
          return (
            <MapLibreGL.MarkerView
              key={`flag-${m.id}`}
              id={`flag-${m.id}`}
              coordinate={[m.longitude, m.latitude]}
              anchor={{ x: 0.5, y: 1 }}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelectedMarker(m)}
                style={styles.flagMarker}
              >
                {isCollaborator ? (
                  <Image source={require('@/assets/images/team.png')} style={styles.flagImage} resizeMode="contain" />
                ) : (
                  <>
                    <Image source={FLAG_IMAGES[flagColor] || FLAG_IMAGES[1]} style={styles.flagImage} resizeMode="contain" />
                    <Text style={styles.flagText}>{flagText}</Text>
                  </>
                )}
              </TouchableOpacity>
            </MapLibreGL.MarkerView>
          );
        })}
      </MapLibreGL.MapView>

      {/* 头部 + 统计 */}
      <MapHeader title="找项目" onBack={() => navigation.goBack()}>
        <MapStatsPanel
          slots={statsSlots}
          loading={isFetching}
          isSearchMode={isSearchMode}
          searchResults={searchResults}
          onSearchItemPress={handleSearchItemPress}
          onSlotPress={handleSlotPress}
        />
      </MapHeader>

      {/* 筛选 */}
      <MapFilterCapsule
        options={filterOptions}
        selected={activeFilters}
        onChange={handleFilterChange}
        topOffset={filterTopOffset}
      />

      {/* 时间维度说明 - 点击打开底部弹窗 */}
      <TouchableOpacity
        style={styles.timeLegend}
        onPress={() => setTimeFilterSheetVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.timeLegendTitle}>时间维度</Text>
        <View style={styles.timeLegendItem}>
          <View style={[styles.timeLegendDot, { opacity: 1.0 }]} />
          <Text style={styles.timeLegendText}>1个月内</Text>
        </View>
        <View style={styles.timeLegendItem}>
          <View style={[styles.timeLegendDot, { opacity: 0.75 }]} />
          <Text style={styles.timeLegendText}>1-3个月</Text>
        </View>
        <View style={styles.timeLegendItem}>
          <View style={[styles.timeLegendDot, { opacity: 0.5 }]} />
          <Text style={styles.timeLegendText}>3-6个月</Text>
        </View>
        <View style={styles.timeLegendItem}>
          <View style={[styles.timeLegendDot, { opacity: 0.25 }]} />
          <Text style={styles.timeLegendText}>6个月前</Text>
        </View>
      </TouchableOpacity>

      {/* 时间筛选底部弹窗 */}
      <TimeFilterSheet
        visible={timeFilterSheetVisible}
        onClose={() => setTimeFilterSheetVisible(false)}
        value={timeFilter}
        onChange={setTimeFilter}
      />

      {/* 搜索栏 */}
      <MapSearchBar
        value={searchKeyword}
        onChangeText={setSearchKeyword}
        onSubmit={() => handleSearch(searchKeyword)}
        placeholder="搜索项目名称..."
        showAddButton
        onAddPress={() => setCreateProjectVisible(true)}
        enableVoice
        onRequireLogin={() => navigation.navigate('Login')}
      />

      {/* 底部详情卡 */}
      <MapBottomCard visible={!!selectedMarker && !selectedMarker.isCluster}>
        {selectedMarker && !selectedMarker.isCluster && (() => {
          const d = selectedMarker.data || {};
          const type = selectedMarker.type;
          const clean = (v: any) => { const s = String(v ?? '').trim(); return s || '-'; };

          // 按 type 分别取正确的字段名（与 V1 extractProjectDetails 一致）
          let constructorName = '-', scaleTxt = '-', addressTxt = '-', publishTimeTxt = '-';
          if (type === 1) {
            constructorName = clean(d.building_company_name);
            scaleTxt = clean(d.area || d.area_desc);
            addressTxt = clean(d.project_address);
            publishTimeTxt = clean(d.publish_time);
          } else if (type === 2) {
            constructorName = clean(d.the_unit);
            scaleTxt = clean(d.transfer_area || d.land_area);
            addressTxt = clean(d.resource_location);
            publishTimeTxt = clean(d.announcement_pub_time || d.create_time);
          } else if (type === 3) {
            constructorName = clean(d.tender_unit || d.developer_company_name);
            scaleTxt = clean(d.bid_amount || d.project_cost);
            addressTxt = clean(d.project_address || d.city);
            publishTimeTxt = clean(d.publish_time || d.publish_time_1 || d.publish_time_4);
          } else if (type === 4) {
            constructorName = clean(d.purchaser_name);
            scaleTxt = clean(d.budget_amount);
            addressTxt = clean(d.project_address || d.city);
            publishTimeTxt = clean(d.publish_time || d.publish_time_1 || d.publish_time_4);
          } else {
            constructorName = clean(d.builderUnit);
            scaleTxt = clean(d.area || d.scale);
            addressTxt = clean(d.project_address || d.address);
            publishTimeTxt = clean(d.publish_time || d.created_at);
          }

          return (
            <ProjectCardContent
              name={selectedMarker.title}
              typeName={PROJECT_TYPES.find(t => t.id === selectedMarker.type)?.name || '项目'}
              typeColor={getProjectColor(selectedMarker.type)}
              region={d.region_name || d.region || d.province || '-'}
              isFollowed={selectedMarker.isFollowed}
              constructor={constructorName}
              scale={scaleTxt}
              address={addressTxt}
              publishTime={publishTimeTxt}
              onShare={handleShare}
              onCollaborate={handleCollaborate}
              onFollow={handleFollowProject}
              onView={handleViewDetail}
              collaboratorCount={collaboratorCount}
              onShowCollaborators={handleShowCollaborators}
            />
          );
        })()}
      </MapBottomCard>

      {/* 侧边抽屉 */}
      <MapListDrawer
        visible={drawerVisible}
        title={drawerTitle}
        items={drawerItems}
        loading={drawerLoading}
        onClose={() => setDrawerVisible(false)}
        onItemPress={handleDrawerItemPress}
        colorGetter={getProjectColor}
        emptyText="暂无项目数据"
        exceededMaxCount={drawerExceededMax}
        maxCount={1000}
      />

      {/* 加载 */}
      {(!locationReady || (!mapReady && !data)) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={DayColors.accent} />
          <Text style={styles.loadingText}>
            {!locationReady ? '定位中...' : '地图加载中...'}
          </Text>
        </View>
      )}
      {isFetching && data && (
        <View style={styles.fetchingIndicator}>
          <ActivityIndicator size="small" color={DayColors.accent} />
          <Text style={styles.fetchingText}>加载中...</Text>
        </View>
      )}

      {/* 分享模态框 */}
      {sharePayload && (
        <ShareModal
          visible={shareModalVisible}
          onClose={() => { setShareModalVisible(false); setSharePayload(null); }}
          projectName={sharePayload.projectName}
          projectType={sharePayload.projectType}
          constructor={sharePayload.constructor}
          scale={sharePayload.scale}
          address={sharePayload.address}
          publishTime={sharePayload.publishTime}
          projectId={sharePayload.projectId}
        />
      )}

      {/* 协作邀请模态框 */}
      {collaboratePayload && (
        <CollaborateModal
          visible={collaborateModalVisible}
          onClose={() => { setCollaborateModalVisible(false); setCollaboratePayload(null); }}
          projectId={collaboratePayload.internalProjectId}
          projectName={collaboratePayload.projectName}
          currentCount={collaboratorCount}
          maxCount={4}
          onSuccess={() => {
            if (collaboratePayload?.internalProjectId) {
              collaborationApi.getCollaborators(collaboratePayload.internalProjectId)
                .then(list => setCollaboratorCount(Array.isArray(list) ? list.length : 0))
                .catch(() => {});
            }
          }}
        />
      )}

      {/* 协作者列表弹窗 */}
      <Modal visible={collaboratorListVisible} transparent animationType="fade" onRequestClose={() => setCollaboratorListVisible(false)}>
        <View style={styles.collaboratorOverlay}>
          <View style={styles.collaboratorContainer}>
            <View style={styles.collaboratorHeader}>
              <Text style={styles.collaboratorTitle}>协作者列表</Text>
              <TouchableOpacity onPress={() => setCollaboratorListVisible(false)}>
                <X color="#999" size={20} />
              </TouchableOpacity>
            </View>
            {collaboratorList.length === 0 ? (
              <View style={styles.collaboratorEmpty}>
                <Text style={styles.collaboratorEmptyText}>暂无协作者</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {collaboratorList.map((item, index) => (
                  <View key={String(item.user_id || index)} style={styles.collaboratorItem}>
                    <View style={[styles.collaboratorAvatar, item.role === 'creator' && { backgroundColor: '#111827' }]}>
                      <User color="#fff" size={16} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.collaboratorName}>{item.username || '未知用户'}</Text>
                      <Text style={styles.collaboratorRole}>{item.role === 'creator' ? '创建者' : '协作者'}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* 智能找项目按钮（旗帜上方） */}
      <View style={styles.smartFinderButton}>
        <AnimatedFinderButton
          isRunning={smartFinderRunning}
          onPress={async () => {
          if (!isLoggedIn) {
            confirm({
              title: '提示',
              message: '请先登录后使用自动找项目',
              confirmText: '去登录',
              cancelText: '取消',
              onConfirm: () => navigation.navigate('Login'),
            });
            return;
          }
          const allowed = await smartFinderGuard();
          if (!allowed) return;
          setSmartFinderVisible(true);
        }}
      >
        <Image
          source={gooffice}
          style={{ width: 22, height: 22 }}
          resizeMode="contain"
        />
        </AnimatedFinderButton>
      </View>

      {/* 旗帜设置入口 */}
      <TouchableOpacity
        style={styles.flagButton}
        onPress={() => {
          if (!isLoggedIn) {
            confirm({
              title: '提示',
              message: '请先登录后设置旗帜',
              confirmText: '去登录',
              cancelText: '取消',
              onConfirm: () => navigation.navigate('Login'),
            });
            return;
          }
          setFlagSettingsVisible(true);
        }}
        activeOpacity={0.8}
      >
        <Image
          source={flagIcon}
          style={{ width: 26, height: 26 }}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* 旗帜设置弹窗 */}
      <FlagSettingsSheet
        visible={flagSettingsVisible}
        onClose={() => setFlagSettingsVisible(false)}
      />

      {/* 智能找项目弹窗 */}
      <SmartProjectFinderSheet
        visible={smartFinderVisible}
        onClose={() => setSmartFinderVisible(false)}
      />

      {/* 新建项目弹窗 */}
      <CreateProjectSheet
        visible={createProjectVisible}
        onClose={() => setCreateProjectVisible(false)}
        onSuccess={() => {
          toast.success('项目创建成功');
          // 刷新地图数据和跟进项目列表
          refetch();
          if (isLoggedIn) loadFollowedProjects(true);
        }}
        onRequireLogin={() => navigation.navigate('Login')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DayColors.background },
  map: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center', alignItems: 'center', zIndex: 200,
  },
  loadingText: { marginTop: 12, fontSize: 14, color: DayColors.textSecondary },
  fetchingIndicator: {
    position: 'absolute', alignSelf: 'center', top: '50%',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
    gap: 8, zIndex: 90,
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  fetchingText: { fontSize: 13, fontWeight: '500', color: DayColors.text },

  // 协作者列表弹窗
  collaboratorOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  collaboratorContainer: {
    width: '85%', maxWidth: 340, backgroundColor: '#fff',
    borderRadius: 16, overflow: 'hidden',
  },
  collaboratorHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee',
  },
  collaboratorTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  collaboratorEmpty: { paddingVertical: 40, alignItems: 'center' },
  collaboratorEmptyText: { fontSize: 14, color: '#999' },
  collaboratorItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0',
  },
  collaboratorAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#ddd',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  collaboratorName: { fontSize: 14, fontWeight: '500', color: '#333' },
  collaboratorRole: { fontSize: 12, color: '#999', marginTop: 2 },

  // 智能找项目按钮
  smartFinderButton: {
    position: 'absolute', right: 14, bottom: 194,
    zIndex: 50,
  },
  flagButton: {
    position: 'absolute', right: 16, bottom: 140,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
    zIndex: 50,
  },

  // 时间维度说明
  timeLegend: {
    position: 'absolute',
    left: 12,
    bottom: 82,
    backgroundColor: 'transparent',
    paddingVertical: 4,
    paddingHorizontal: 6,
    zIndex: 50,
  },
  timeLegendTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  timeLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 1.5,
  },
  timeLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#666',
    marginRight: 6,
  },
  timeLegendText: {
    fontSize: 10,
    color: '#666',
  },

  // 旗帜标记点
  flagMarker: {
    width: 28, height: 34,
    alignItems: 'center',
  },
  flagImage: {
    width: '100%', height: '100%',
    position: 'absolute',
  },
  flagText: {
    position: 'absolute',
    top: 8.5,
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

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

export default ProjectMapScreen;
