/**
 * 3D 建筑白模
 * 使用本地 OSM 瓦片 + 本地 OSM PostGIS 建筑数据
 * 完全离线，数据一致：所见即所得
 */
import React, { FC, useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  PanResponder,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import OSMSelectMap, { OSMSelectMapRef } from '@/components/map/OSMSelectMap';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { MAP_CONFIG, API_CONFIG } from '@/constants';
import type { RootStackScreenProps } from '@/navigation/types';
import Orientation from 'react-native-orientation-locker';
import useLocation from '@/hooks/useLocation';
import { useAIToolGuard } from '@/hooks';
import { Loading } from '@/components/common/Loading';
import { ChevronLeft } from 'lucide-react-native';

type Props = RootStackScreenProps<'Building3D'>;

const getRegionInfoByLocation = async (_lat, _lon) => ({ province: '', city: '' });

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// 选取框初始尺寸
const INITIAL_BOX_W = SCREEN_W * 0.6;
const INITIAL_BOX_H = SCREEN_W * 0.6;
const MIN_BOX = 80;
const MAX_BOX = Math.min(SCREEN_W - 40, SCREEN_H * 0.5);

type PageMode = 'select' | 'loading' | 'preview';

// 权限检查包装组件
const Building3DGuard: FC<Props> = ({ navigation }) => {
  const guard = useAIToolGuard('building_3d');
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    console.log('[Building3D] 检查权限...');
    guard().then((result) => {
      console.log('[Building3D] 权限检查结果:', result);
      if (!result) navigation.goBack();
      setAllowed(result);
    }).catch((err) => {
      console.error('[Building3D] 权限检查失败:', err);
      navigation.goBack();
      setAllowed(false);
    });
  }, []);

  if (allowed === null || !allowed) {
    return null;
  }

  return <Building3DMainContent navigation={navigation} />;
};

// 主内容组件（确保 hooks 调用顺序一致）
const Building3DMainContent: FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<PageMode>('select');
  const [boxW, setBoxW] = useState(INITIAL_BOX_W);
  const [boxH, setBoxH] = useState(INITIAL_BOX_H);
  const [areaKm2, setAreaKm2] = useState(0);
  const [buildingCount, setBuildingCount] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [dayMode, setDayMode] = useState(true);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [wgsBbox, setWgsBbox] = useState<{ minLat: number; maxLat: number; minLon: number; maxLon: number; boxAspectRatio?: number } | null>(null);
  const [tileData, setTileData] = useState<{ dark: string[]; light: string[]; cols: number; rows: number; tileInfo: any; captureData?: string } | null>(null);
  const [mapCenter, setMapCenter] = useState(MAP_CONFIG.DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(16);

  // 返回按钮组件 - 统一使用圆形黑色半透明样式
  const BackButton = ({ onPress, style }: { onPress: () => void; style?: any }) => (
    <TouchableOpacity style={[{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }, style]} onPress={onPress} activeOpacity={0.7}>
      <ChevronLeft size={24} color="#fff" />
    </TouchableOpacity>
  );

  // 定位功能
  const { location, requestLocation } = useLocation();
  
  useEffect(() => {
    // 组件挂载时请求定位权限并获取当前位置
    requestLocation();
  }, []);

  useEffect(() => {
    if (location) {
      setMapCenter(location);
    }
  }, [location]);

  // 使用本地 OSM（完全离线，数据一致）
  // OSM 使用 WGS-84 坐标系，与 PostGIS 建筑数据一致，无需坐标转换
  const [sunTrail, setSunTrail] = useState(false);
  const [selectedExportFormats, setSelectedExportFormats] = useState<Set<string>>(new Set(['PNG']));

  const mapRef = useRef<any>(null);
  const osmMapRef = useRef<OSMSelectMapRef>(null);
  const preview3dRef = useRef<WebView>(null);
  const mapBoundsRef = useRef<{ minLat: number; maxLat: number; minLon: number; maxLon: number } | null>(null);

  // ===== 天地图 Bounds 变化处理 =====
  // 使用 ref 获取最新的 boxW/boxH，避免回调依赖变化导致子组件重新渲染
  const boxWRef = useRef(boxW);
  const boxHRef = useRef(boxH);
  useEffect(() => { boxWRef.current = boxW; }, [boxW]);
  useEffect(() => { boxHRef.current = boxH; }, [boxH]);

  // 进入页面时锁定竖屏；3D 全屏模式下会解锁允许横屏
  // 离开时恢复竖屏锁定（不能 unlockAll，否则整个 APP 会失去横竖屏控制）
  useEffect(() => {
    Orientation.lockToPortrait();
    return () => {
      Orientation.lockToPortrait();
    };
  }, []);

  const [mapInfo, setMapInfo] = useState({ region: '解析中...', coords: '' });
  const mapInfoTimerRef = useRef<any>(null);

  const handleTianDiTuBoundsChange = useCallback((bounds: { northEast: { latitude: number; longitude: number }; southWest: { latitude: number; longitude: number } }) => {
    const { northEast, southWest } = bounds;
    mapBoundsRef.current = {
      minLat: southWest.latitude,
      maxLat: northEast.latitude,
      minLon: southWest.longitude,
      maxLon: northEast.longitude,
    };

    const b = mapBoundsRef.current;
    if (b) {
      const mapLonRange = b.maxLon - b.minLon;
      const mapLatRange = b.maxLat - b.minLat;

      // 计算地图视窗的地理宽高（千米）
      const centerLat = (b.minLat + b.maxLat) / 2;
      const kmPerLat = 111.0;
      const kmPerLon = 111.0 * Math.cos(centerLat * Math.PI / 180);
      const mapGeoWidthKm = mapLonRange * kmPerLon;
      const mapGeoHeightKm = mapLatRange * kmPerLat;

      // 屏幕视窗高度
      const mapViewportHeight = SCREEN_H * 0.65;

      // 选取框占屏幕视窗的比例
      const boxRatioW = boxWRef.current / SCREEN_W;
      const boxRatioH = boxHRef.current / mapViewportHeight;

      // 计算选取框在地理上的实际宽高（千米）- 保持与屏幕相同的宽高比
      const selectedGeoWidthKm = mapGeoWidthKm * boxRatioW;
      const selectedGeoHeightKm = mapGeoHeightKm * boxRatioH;

      // 转换回经纬度
      const selectedLonRange = selectedGeoWidthKm / kmPerLon;
      const selectedLatRange = selectedGeoHeightKm / kmPerLat;

      const centerLon = (b.minLon + b.maxLon) / 2;
      // centerLat 已在上面定义
      const bbox = {
        min_lon: centerLon - selectedLonRange / 2,
        max_lon: centerLon + selectedLonRange / 2,
        min_lat: centerLat - selectedLatRange / 2,
        max_lat: centerLat + selectedLatRange / 2,
      };
      setAreaKm2(Math.abs((bbox.max_lat - bbox.min_lat) * kmPerLat * (bbox.max_lon - bbox.min_lon) * kmPerLon));

      // 更新行政区与经纬度
      setMapInfo(prev => ({ ...prev, coords: `${centerLon.toFixed(6)}, ${centerLat.toFixed(6)}` }));
      if (mapInfoTimerRef.current) clearTimeout(mapInfoTimerRef.current);
      mapInfoTimerRef.current = setTimeout(() => {
        getRegionInfoByLocation(centerLat, centerLon).then(res => {
          if (res && res.province) {
            const rName = res.city && res.city !== res.province ? `${res.province}-${res.city}` : res.province;
            setMapInfo(prev => ({ ...prev, region: rName }));
          } else {
            setMapInfo(prev => ({ ...prev, region: '未知区域' }));
          }
        });
      }, 500);
    }
  }, []); // 空依赖数组，回调永不变化

  // ===== 从地图 bounds + 选取框比例计算实际 bbox =====
  const calcSelectedBbox = useCallback(() => {
    const b = mapBoundsRef.current;
    if (!b) return null;

    const mapLonRange = b.maxLon - b.minLon;
    const mapLatRange = b.maxLat - b.minLat;

    // 计算地图视窗的地理宽高（千米）
    const centerLat = (b.minLat + b.maxLat) / 2;
    const kmPerLat = 111.0;
    const kmPerLon = 111.0 * Math.cos(centerLat * Math.PI / 180);
    const mapGeoWidthKm = mapLonRange * kmPerLon;
    const mapGeoHeightKm = mapLatRange * kmPerLat;

    // 屏幕视窗高度
    const mapViewportHeight = SCREEN_H * 0.65;

    // 选取框占屏幕视窗的比例
    const boxRatioW = boxW / SCREEN_W;
    const boxRatioH = boxH / mapViewportHeight;

    // 计算选取框在地理上的实际宽高（千米）- 保持与屏幕相同的宽高比
    const selectedGeoWidthKm = mapGeoWidthKm * boxRatioW;
    const selectedGeoHeightKm = mapGeoHeightKm * boxRatioH;

    // 转换回经纬度
    const selectedLonRange = selectedGeoWidthKm / kmPerLon;
    const selectedLatRange = selectedGeoHeightKm / kmPerLat;

    const centerLon = (b.minLon + b.maxLon) / 2;

    return {
      min_lon: centerLon - selectedLonRange / 2,
      max_lon: centerLon + selectedLonRange / 2,
      min_lat: centerLat - selectedLatRange / 2,
      max_lat: centerLat + selectedLatRange / 2,
      // 保存选取框的屏幕宽高比，用于3D底图保持正确比例
      boxAspectRatio: boxW / boxH,
    };
  }, [boxW, boxH]);

  const calcArea = useCallback((bbox: { min_lat: number; max_lat: number; min_lon: number; max_lon: number }) => {
    const kmPerLat = 111.0;
    const kmPerLon = 111.0 * Math.cos(((bbox.min_lat + bbox.max_lat) / 2) * Math.PI / 180);
    return Math.abs((bbox.max_lat - bbox.min_lat) * kmPerLat * (bbox.max_lon - bbox.min_lon) * kmPerLon);
  }, []);

  // 地图视窗变化时更新面积
  const handleCameraIdle = useCallback((event: any) => {
    const ne = event?.nativeEvent;
    
    // 提取 zoom
    const z = ne?.zoom ?? ne?.zoomLevel ?? ne?.cameraPosition?.zoom;
    if (typeof z === 'number' && Number.isFinite(z)) {
      setMapZoom(z);
    }

    // 提取 bounds
    const bounds = ne?.bounds || ne?.bound;
    const northEast = bounds?.northEast || bounds?.northeast || ne?.northEast;
    const southWest = bounds?.southWest || bounds?.southwest || ne?.southWest;

    let minLat: number, maxLat: number, minLon: number, maxLon: number;

    if (northEast && southWest) {
      minLat = southWest.latitude;
      maxLat = northEast.latitude;
      minLon = southWest.longitude;
      maxLon = northEast.longitude;
    } else {
      // fallback: 从 zoom 和 center 估算
      const center = ne?.cameraPosition?.target || ne?.target || mapCenter;
      const lat = center?.latitude ?? mapCenter.latitude;
      const lon = center?.longitude ?? mapCenter.longitude;
      const degreesPerTile = 360 / Math.pow(2, z || mapZoom);
      const span = degreesPerTile * 2;
      minLat = lat - span / 2;
      maxLat = lat + span / 2;
      minLon = lon - span / 2;
      maxLon = lon + span / 2;
    }

    mapBoundsRef.current = { minLat, maxLat, minLon, maxLon };

    // 更新面积
    const bbox = calcSelectedBbox();
    if (bbox) {
      setAreaKm2(calcArea(bbox));
    }
  }, [mapCenter, mapZoom, calcSelectedBbox, calcArea]);

  // 选取框大小变化时也更新面积
  useEffect(() => {
    const bbox = calcSelectedBbox();
    if (bbox) {
      setAreaKm2(calcArea(bbox));
    }
  }, [boxW, boxH, calcSelectedBbox, calcArea]);

  // ===== 选取框右下角拖拽调整大小 =====
  const baseBoxRef = useRef({ w: INITIAL_BOX_W, h: INITIAL_BOX_H });
  const isResizingRef = useRef(false);

  const resizePanResponder = useRef(
    PanResponder.create({
      // 只在触摸开始时设置为响应者，阻止地图响应
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // 如果已经开始调整大小，继续拦截手势
        return isResizingRef.current;
      },
      onPanResponderGrant: () => {
        isResizingRef.current = true;
        baseBoxRef.current = { w: boxW, h: boxH };
      },
      onPanResponderMove: (_, gesture) => {
        if (!isResizingRef.current) return;
        const newW = Math.max(MIN_BOX, Math.min(MAX_BOX, baseBoxRef.current.w + gesture.dx * 2));
        const newH = Math.max(MIN_BOX, Math.min(MAX_BOX, baseBoxRef.current.h + gesture.dy * 2));
        setBoxW(newW);
        setBoxH(newH);
      },
      onPanResponderRelease: () => {
        isResizingRef.current = false;
      },
      onPanResponderTerminate: () => {
        isResizingRef.current = false;
      },
    })
  ).current;

  // ===== 确认选取 =====
  const handleConfirmSelect = useCallback(async () => {
    if (areaKm2 > 2) {
      Alert.alert('选取窗口超出建模生成区域', `当前选区面积约 ${areaKm2.toFixed(2)} km²，请控制在 2 km² 以内`);
      return;
    }

    const bbox = calcSelectedBbox();
    if (!bbox) {
      Alert.alert('提示', '地图尚未就绪，请稍后再试');
      return;
    }

    let captureData: string | null = null;
    try {
      console.log('[Building3D] osmMapRef.current:', osmMapRef.current ? 'exists' : 'null');
      if (osmMapRef.current) {
        console.log('[Building3D] Calling captureMap...');
        captureData = await osmMapRef.current.captureMap({
          minLat: bbox.min_lat,
          maxLat: bbox.max_lat,
          minLon: bbox.min_lon,
          maxLon: bbox.max_lon,
        });
        console.log('[Building3D] Map captured, data length:', captureData?.length || 0);
      } else {
        console.warn('[Building3D] osmMapRef.current is null');
      }
    } catch (e) {
      console.warn('[Building3D] Map capture failed:', e);
    }

    setMode('loading');
    
    fetchBuildingsFromOverpass(bbox.min_lat, bbox.min_lon, bbox.max_lat, bbox.max_lon, bbox.boxAspectRatio || 1, captureData);
  }, [areaKm2, calcSelectedBbox]);

  const fetchBuildingsFromOverpass = useCallback(async (minLat: number, minLon: number, maxLat: number, maxLon: number, boxAspectRatio: number, captureData: string | null) => {
    try {
      // OSM 使用 WGS-84 坐标系，与本地 PostGIS 建筑数据一致，无需坐标转换
      const queryMinLat = minLat;
      const queryMinLon = minLon;
      const queryMaxLat = maxLat;
      const queryMaxLon = maxLon;

      const query = `[out:json][timeout:30];(way["building"](${queryMinLat},${queryMinLon},${queryMaxLat},${queryMaxLon}););out body;>;out skel qt;`;

      // 使用 API_CONFIG 中的配置，支持云服务器和生产环境
      const apiBase = API_CONFIG.BASE_URL;
      let result: any = null;
      let lastError = '';

      // 方案1: 本地 OSM PostGIS 数据库查询（最快，无需 Overpass）
      try {
        const localResponse = await fetch(`${apiBase}/api/map/buildings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            min_lat: queryMinLat,
            min_lon: queryMinLon,
            max_lat: queryMaxLat,
            max_lon: queryMaxLon,
            limit: 2000,
          }),
        });
        if (localResponse.ok) {
          result = await localResponse.json();
        } else {
          lastError = `本地 OSM 返回 HTTP ${localResponse.status}`;
        }
      } catch (e: any) {
        lastError = `本地 OSM 请求失败: ${e.message}`;
      }

      // 方案2: 通过后端代理 Overpass（备用）
      if (!result) {
        try {
          const proxyResponse = await fetch(`${apiBase}/api/map/overpass`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
          });
          if (proxyResponse.ok) {
            result = await proxyResponse.json();
          } else {
            lastError = `Overpass 代理返回 HTTP ${proxyResponse.status}`;
          }
        } catch (e: any) {
          lastError = `Overpass 代理请求失败: ${e.message}`;
        }
      }

      // 方案3: 直连 Overpass 服务器（最后的备用）
      if (!result) {
        const servers = [
          `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
          `https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`,
        ];

        for (const url of servers) {
          try {
            const response = await fetch(url);
            if (!response.ok) {
              lastError = `HTTP ${response.status}`;
              continue;
            }
            const contentType = response.headers.get('content-type') || '';
            const text = await response.text();
            if (!contentType.includes('json') && text.trimStart().startsWith('<')) {
              lastError = '服务器返回了非 JSON 数据（可能被限流），正在尝试备用服务器...';
              continue;
            }
            result = JSON.parse(text);
            break;
          } catch (e: any) {
            lastError = e.message || '请求失败';
            continue;
          }
        }
      }

      if (!result) {
        throw new Error(lastError || '所有 Overpass 服务器均不可用');
      }

      if (!result.elements || result.elements.length === 0) {
        Alert.alert('未找到建筑', '当前区域内没有 OSM 建筑数据，请尝试其他区域');
        setMode('select');
        return;
      }

      // 解析 OSM 数据为建筑轮廓
      const nodes = new Map<number, { lat: number; lon: number }>();
      const ways: any[] = [];

      result.elements.forEach((el: any) => {
        if (el.type === 'node') {
          nodes.set(el.id, { lat: el.lat, lon: el.lon });
        } else if (el.type === 'way' && el.tags?.building) {
          ways.push(el);
        }
      });

      const buildingsData = ways.map((way: any) => {
        const coords = (way.nodes || [])
          .map((nid: number) => nodes.get(nid))
          .filter(Boolean)
          .map((n: any) => [n.lon, n.lat]);

        if (coords.length < 3) return null;

        // 高度策略
        const levels = way.tags?.['building:levels'];
        const osmHeight = way.tags?.height;
        let height = 15;
        if (osmHeight) {
          height = parseFloat(String(osmHeight).replace(/m/gi, '')) || 15;
        } else if (levels) {
          height = (parseInt(levels) || 5) * 3;
        } else {
          // 随机高度（8-80米），模拟高低错落
          height = 8 + Math.random() * 60;
        }

        return {
          id: `bld_${way.id}`,
          name: way.tags?.name || null,
          coordinates: coords,
          height: Math.round(height * 10) / 10,
        };
      }).filter(Boolean);

      setBuildingCount(buildingsData.length);
      setBuildings(buildingsData);
      // boxAspectRatio 通过参数传入，来自 handleConfirmSelect 中 calcSelectedBbox 的结果
      const wgs = { minLat: queryMinLat, maxLat: queryMaxLat, minLon: queryMinLon, maxLon: queryMaxLon, boxAspectRatio };
      setWgsBbox(wgs);

      // 使用截图作为底图，不再下载 OSM 瓦片
      if (captureData && captureData.length > 100) {
        console.log('[Building3D] Setting tileData with captureData, length:', captureData.length);
        setTileData({
          dark: [],
          light: [],
          cols: 0,
          rows: 0,
          tileInfo: null,
          captureData: captureData,
        });
      } else {
        console.warn('[Building3D] No captureData available, tileData will be null');
      }

      setMode('preview');
    } catch (err: any) {
      Alert.alert('获取失败', err.message || '无法从 OSM 获取建筑数据，请检查网络');
      setMode('select');
    }
  }, []);

  const isAreaTooLarge = areaKm2 > 2;
  const overpassAreaStr = isAreaTooLarge ? `${areaKm2.toFixed(1)} km² ⚠️` : `${areaKm2.toFixed(2)} km²`;

  // ===== Three.js 3D 预览 HTML =====
  const generate3dHtml = useCallback(() => {
    const buildingsJson = JSON.stringify(buildings);
    const bboxJson = JSON.stringify(wgsBbox);
    const tileDataJson = JSON.stringify(tileData);
    const initialTheme = dayMode ? 'light' : 'dark';
    return `
<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:${initialTheme === 'light' ? '#f5f5f5' : '#1a1a2e'}}canvas{display:block}#err{position:fixed;top:40%;left:0;right:0;text-align:center;color:#f66;font:14px sans-serif;display:none}input[type=range]{-webkit-tap-highlight-color:transparent;touch-action:none}input[type=range]:focus{outline:none}</style>
</head><body>
<div id="err"></div>
<script>
window.onerror=function(m){document.getElementById('err').style.display='block';document.getElementById('err').textContent='Error: '+m;};
</script>
<script src="file:///android_asset/three-r128.min.js"></script>
<script>if(typeof THREE==='undefined'){document.write('<scr'+'ipt src="https://unpkg.com/three@0.128.0/build/three.min.js"><\/scr'+'ipt>')}</script>
<script src="file:///android_asset/OrbitControls-r128.js"></script>
<script>if(!THREE.OrbitControls){document.write('<scr'+'ipt src="https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js"><\/scr'+'ipt>')}</script>
<script>
(function() {
  var buildings = ${buildingsJson};
  var bbox = ${bboxJson};
  var tileDataFromRN = ${tileDataJson};
  if (!buildings || buildings.length === 0) return;

  // 使用 tileData 中的原始 bbox 作为统一参考系（与瓦片裁剪使用相同的 bbox）
  var originalBbox = (tileDataFromRN && tileDataFromRN.originalBbox) ? tileDataFromRN.originalBbox : bbox;
  var centerLon = (originalBbox.minLon + originalBbox.maxLon) / 2;
  var centerLat = (originalBbox.minLat + originalBbox.maxLat) / 2;
  var metersPerLon = 111000 * Math.cos(centerLat * Math.PI / 180);
  var metersPerLat = 111000;
  
  // 选区范围（米）
  var rawBboxWidth = (originalBbox.maxLon - originalBbox.minLon) * metersPerLon;
  var rawBboxHeight = (originalBbox.maxLat - originalBbox.minLat) * metersPerLat;
  
  // 使用屏幕选取框的宽高比来修正底图尺寸，确保3D底图与用户在地图上看到的选取框比例一致
  var boxAspectRatio = originalBbox.boxAspectRatio || (rawBboxWidth / rawBboxHeight);
  // 以较大维度为基准，用屏幕宽高比修正另一维度
  var bboxWidth, bboxHeight;
  if (boxAspectRatio >= 1) {
    // 宽 >= 高，以宽度为基准
    bboxWidth = rawBboxWidth;
    bboxHeight = rawBboxWidth / boxAspectRatio;
  } else {
    // 高 > 宽，以高度为基准
    bboxHeight = rawBboxHeight;
    bboxWidth = rawBboxHeight * boxAspectRatio;
  }
  
  // 计算建筑坐标需要应用的缩放因子，使其与底图尺寸匹配
  var scaleX = bboxWidth / rawBboxWidth;
  var scaleZ = bboxHeight / rawBboxHeight;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(currentTheme === 'light' ? 0xf5f5f5 : 0x1a1a2e);
  // 增加雾的起始距离，避免给近处的建筑蒙上一层“白色遮罩”
  scene.fog = new THREE.Fog(currentTheme === 'light' ? 0xf5f5f5 : 0x1a1a2e, 2500, 8000);

  // 增加 camera 的 near plane 以提升深度缓冲精度，避免 Z-fighting 闪烁
  var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 10, 5000);
  camera.position.set(200, 300, 400);

  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  var controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.0;
  controls.maxPolarAngle = Math.PI / 2.1;

  // 默认暮夜光照
  var ambLight = new THREE.AmbientLight(0x8ab0ff, 0.3);
  scene.add(ambLight);
  var dirLight = new THREE.DirectionalLight(0xffffff, 0.2);
  dirLight.position.set(200, 400, 300);
  dirLight.castShadow = true;
  scene.add(dirLight);
  // 补光（背光）- 从太阳相反方向照亮建筑背面
  var backLight = new THREE.DirectionalLight(0xaaccff, 0.3);
  backLight.position.set(-200, 300, -300);
  scene.add(backLight);
  // 半球光（天空/地面）
  var hemLight = new THREE.HemisphereLight(0x1a2a6a, 0x050a1a, 0.6);
  scene.add(hemLight);
  // 霓虹点光源（暮夜专用）
  var pointLight = new THREE.PointLight(0x4488ff, 1.2, 2000);
  pointLight.position.set(0, 200, 0);
  scene.add(pointLight);

  // ===== 主题配置 =====
  // dark = 暮夜：深蓝夜空 + 自发光建筑 + 霓虹轮廓
  // light = 白天：天蓝色天空 + 灰白建筑 + 阳光照射
  var themes = {
    dark: {
      bg: 0x060d1f, fog: 0x060d1f,
      fill: '#10183a',
      // 建筑：透明黑灰色系
      colors: [0x3a3a3a, 0x2e2e2e, 0x404040, 0x353535, 0x383838, 0x303030],
      buildingOpacity: 0.75,
      ambient: 0.3, dirIntensity: 0.2,
      // 夜幕辅助光
      pointColor: 0x4488ff, pointIntensity: 1.2,
      hemSkyColor: 0x1a2a6a, hemGroundColor: 0x050a1a, hemIntensity: 0.6,
      wireColor: 0x4488ff, wireOpacity: 0.8,
      emissive: 0x1a3060, emissiveIntensity: 0.4,
    },
    light: {
      bg: 0xf5f5f5, fog: 0xf5f5f5,
      fill: '#d0d8e0',
      // 建筑：灰白砖石色系
      colors: [0xdee0e6, 0xcfd1d8, 0xd8dae2, 0xc8cad2, 0xd2d4dc, 0xe0e2ea],
      buildingOpacity: 1.0,
      ambient: 0.6, dirIntensity: 1.8,
      pointColor: 0xfff4e0, pointIntensity: 0.3,
      hemSkyColor: 0xf5f5f5, hemGroundColor: 0x8a8a7a, hemIntensity: 0.3,
      wireColor: 0x6a7080, wireOpacity: 0.35,
      emissive: 0x000000, emissiveIntensity: 0,
    },
  };
  var currentTheme = '${initialTheme}';
  var groundStandard = null;
  var mapScreenshotB64 = tileDataFromRN && tileDataFromRN.captureData ? tileDataFromRN.captureData : null;
  console.log('[3D] mapScreenshotB64 length:', mapScreenshotB64 ? mapScreenshotB64.length : 0);

  function createScreenshotGroundMesh(canvas) {
    // 左右镜像底图纹理，与建筑坐标的X轴镜像保持一致
    var mirrorCanvas = document.createElement('canvas');
    mirrorCanvas.width = canvas.width;
    mirrorCanvas.height = canvas.height;
    var mirrorCtx = mirrorCanvas.getContext('2d');
    mirrorCtx.translate(canvas.width, 0);
    mirrorCtx.scale(-1, 1);
    mirrorCtx.drawImage(canvas, 0, 0);

    var groundWidth = bboxWidth * 1.1;
    var groundHeight = bboxHeight * 1.1;
    var groundGroup = new THREE.Group();
    groundGroup.position.set(0, -0.5, 0);

    var bgMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(groundWidth * 1.1, groundHeight * 1.1),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    bgMesh.rotation.x = -Math.PI / 2;
    bgMesh.position.set(0, -2.0, 0);
    bgMesh.receiveShadow = true;
    groundGroup.add(bgMesh);

    var tex = new THREE.CanvasTexture(mirrorCanvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    var mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(groundWidth, groundHeight),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0, 0);
    mesh.scale.y = -1;
    mesh.receiveShadow = true;
    groundGroup.add(mesh);
    return groundGroup;
  }

  function createFallbackGround() {
    var groundWidth = bboxWidth * 1.1;
    var groundHeight = bboxHeight * 1.1;
    var groundGroup = new THREE.Group();
    groundGroup.position.set(0, -0.5, 0);

    var bgMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(groundWidth * 1.1, groundHeight * 1.1),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    bgMesh.rotation.x = -Math.PI / 2;
    bgMesh.position.set(0, -2.0, 0);
    bgMesh.receiveShadow = true;
    groundGroup.add(bgMesh);

    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(groundWidth, groundHeight),
      new THREE.MeshLambertMaterial({ color: 0x2a2a3e })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 0);
    ground.scale.y = -1;
    ground.receiveShadow = true;
    groundGroup.add(ground);

    scene.add(groundGroup);
  }

  // 优先使用截图作为底图
  if (mapScreenshotB64 && mapScreenshotB64.length > 100) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      var mesh = createScreenshotGroundMesh(canvas);
      groundStandard = mesh;
      scene.add(mesh);
      mesh.visible = true;
    };
    img.onerror = function() { createFallbackGround(); };
    img.src = mapScreenshotB64;
  } else {
    createFallbackGround();
  }
  var ground = null; // 兼容 raycaster 排除

  // ===== 高度标签 =====
  var labelDiv = document.createElement('div');
  labelDiv.style.cssText = 'position:fixed;display:none;background:rgba(178,0,0,0.9);color:#fff;padding:4px 10px;border-radius:6px;font:bold 13px sans-serif;pointer-events:none;z-index:999;white-space:nowrap;';
  document.body.appendChild(labelDiv);

  var colors = themes[currentTheme].colors;
  var selectedColor = 0xB20000;

  var buildingMeshes = [];
  var selectedIdx = -1;
  // camera focus animation
  var focusTarget=null,focusPos=null,focusActive=false;
  var origTarget=null,origPos=null; // 将在相机设置后初始化

  function createBuildingMesh(b, idx) {
    var shape = new THREE.Shape();
    // 左右镜像：取反X轴，解决OSM与天地图坐标镜像问题
    // 同时应用缩放因子，使建筑与底图尺寸匹配
    // 镜像后需要反转顶点顺序以恢复正确的面法线方向（CCW绕序）
    var mirroredCoords = b.coordinates.map(function(c) {
      return [-((c[0] - centerLon) * metersPerLon * scaleX), -((c[1] - centerLat) * metersPerLat * scaleZ)];
    });
    mirroredCoords.reverse();
    mirroredCoords.forEach(function(mc, j) {
      if (j === 0) shape.moveTo(mc[0], mc[1]);
      else shape.lineTo(mc[0], mc[1]);
    });
    shape.closePath();
    return rebuildMesh(shape, b.height, colors[idx % colors.length], idx);
  }

  function rebuildMesh(shape, height, color, idx) {
    var geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    var t = themes[currentTheme];
    var material = new THREE.MeshPhongMaterial({
      color: color,
      transparent: true,
      opacity: 0.92,
      emissive: new THREE.Color(t.emissive),
      emissiveIntensity: t.emissiveIntensity,
      shininess: currentTheme === 'dark' ? 80 : 30,
    });
    var mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.buildingIdx = idx;

    var edges = new THREE.EdgesGeometry(geometry, 15);
    var wireframe = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: t.wireColor, opacity: t.wireOpacity, transparent: true })
    );

    return { mesh: mesh, wireframe: wireframe };
  }

  // 初始化建筑
  buildings.forEach(function(b, i) {
    if (b.coordinates.length < 3) return;

    var shape = new THREE.Shape();
    // 左右镜像：取反X轴，解决OSM与天地图坐标镜像问题
    // 同时应用缩放因子，使建筑与底图尺寸匹配
    // 镜像后需要反转顶点顺序以恢复正确的面法线方向（CCW绕序）
    var mirroredCoords = b.coordinates.map(function(c) {
      return [-((c[0] - centerLon) * metersPerLon * scaleX), -((c[1] - centerLat) * metersPerLat * scaleZ)];
    });
    mirroredCoords.reverse();
    mirroredCoords.forEach(function(mc, j) {
      if (j === 0) shape.moveTo(mc[0], mc[1]);
      else shape.lineTo(mc[0], mc[1]);
    });
    shape.closePath();

    var result = rebuildMesh(shape, b.height, colors[i % colors.length], i);
    scene.add(result.mesh);
    scene.add(result.wireframe);

    buildingMeshes.push({
      mesh: result.mesh,
      wireframe: result.wireframe,
      shape: shape,
      height: b.height,
      origColor: colors[i % colors.length],
      idx: i,
      cornerRadius: 0,
      taperRatio: 0,
      topType: 'flat',
      capMesh: null,
    });
  });

  // 自适应相机
  var sceneBox = new THREE.Box3();
  scene.traverse(function(obj) { if (obj.isMesh && obj !== ground) sceneBox.expandByObject(obj); });
  var boxCenter = new THREE.Vector3();
  var boxSize = new THREE.Vector3();
  sceneBox.getCenter(boxCenter);
  sceneBox.getSize(boxSize);
  var maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z);
  var dist = maxDim * 1.5;
  
  // 使用选取区域的地理中心作为旋转中心，而不是建筑包围盒中心
  // 这样旋转中心会与底图中心对齐，避免偏心感
  var geoCenter = new THREE.Vector3(0, 0, 0);
  camera.position.set(geoCenter.x + dist * 0.6, dist * 0.8, geoCenter.z + dist * 0.6);
  controls.target.copy(geoCenter);
  controls.update();
  // 初始化相机原位（在相机设置后）
  origTarget = geoCenter.clone();
  origPos = camera.position.clone();
  var shadowCamHalf = Math.max(maxDim * 1.3, Math.max(bboxWidth, bboxHeight) * 0.9);
  dirLight.shadow.camera.left = -shadowCamHalf; dirLight.shadow.camera.right = shadowCamHalf;
  dirLight.shadow.camera.top = shadowCamHalf; dirLight.shadow.camera.bottom = -shadowCamHalf;
  dirLight.shadow.camera.near = 10; dirLight.shadow.camera.far = shadowCamHalf * 6;
  dirLight.shadow.mapSize.width = 2048; dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.bias = -0.0005;
  dirLight.shadow.camera.updateProjectionMatrix();

  // ===== 交互 =====
  var raycaster = new THREE.Raycaster();
  var mouse = new THREE.Vector2();
  var isDragging = false;
  var dragStartY = 0;
  var dragStartHeight = 0;

  function getMeshes() {
    return buildingMeshes.map(function(b) { return b.mesh; });
  }

  function selectBuilding(idx) {
    // deselect previous
    if (selectedIdx >= 0 && selectedIdx < buildingMeshes.length) {
      var prev = buildingMeshes[selectedIdx];
      prev.mesh.material.color.setHex(prev.origColor);
      prev.mesh.material.opacity = 0.92;
      if (prev.mesh.material.emissive) prev.mesh.material.emissive.setHex(themes[currentTheme].emissive);
      prev.wireframe.material.color.setHex(themes[currentTheme].wireColor);
      prev.wireframe.material.opacity = themes[currentTheme].wireOpacity;
      // remove cap if exists
      if (prev.capMesh) { scene.remove(prev.capMesh); prev.capMesh.geometry.dispose(); prev.capMesh = null; }
    }
    selectedIdx = idx;
    var ep = document.getElementById('editPanel');
    if (idx >= 0 && idx < buildingMeshes.length) {
      var cur = buildingMeshes[idx];
      cur.mesh.material.color.setHex(selectedColor);
      cur.mesh.material.opacity = 0.85;
      if (cur.mesh.material.emissive) cur.mesh.material.emissive.setHex(0x330000);
      cur.wireframe.material.color.setHex(0xff4444);
      cur.wireframe.material.opacity = 1.0;
      // camera focus
      var bb = new THREE.Box3().setFromObject(cur.mesh);
      var bc = new THREE.Vector3(); bb.getCenter(bc);
      var bs = new THREE.Vector3(); bb.getSize(bs);
      var fd = Math.max(bs.x, bs.y, bs.z) * 3.5;
      focusTarget = bc.clone(); focusTarget.x += bs.x * 1.5;
      focusPos = new THREE.Vector3(bc.x - fd * 0.4, bc.y + fd * 0.6, bc.z + fd * 0.5);
      focusActive = true;
      controls.autoRotate = false;
      // show edit panel
      if (ep) {
        ep.style.display = 'block';
        var hs = document.getElementById('epHeight'); if (hs) { hs.max = '200'; hs.value = String(Math.round(cur.height)); }
        var ht = document.getElementById('epHeightVal'); if (ht) ht.textContent = Math.round(cur.height) + 'm';
        var rs = document.getElementById('epRadius'); if (rs) rs.value = String(cur.cornerRadius || 0);
        var rv = document.getElementById('epRadiusVal'); if (rv) rv.textContent = (cur.cornerRadius || 0) + '%';
        var ts = document.getElementById('epTaper'); if (ts) ts.value = String(cur.taperRatio || 0);
        var tv = document.getElementById('epTaperVal'); if (tv) tv.textContent = (cur.taperRatio || 0) + '%';
        updTopBtns(cur.topType || 'flat');
      }
    } else {
      focusActive = true; focusTarget = origTarget.clone(); focusPos = origPos.clone();
      if (ep) ep.style.display = 'none';
    }
    updateLabel();
  }

  function updateLabel() {
    if (selectedIdx < 0 || selectedIdx >= buildingMeshes.length) {
      labelDiv.style.display = 'none';
      return;
    }
    var b = buildingMeshes[selectedIdx];
    labelDiv.style.display = 'block';
    labelDiv.textContent = Math.round(b.height) + 'm ↕';
    // 将建筑顶部3D坐标投影到屏幕
    var bbox = new THREE.Box3().setFromObject(b.mesh);
    var topCenter = new THREE.Vector3((bbox.min.x+bbox.max.x)/2, bbox.max.y, (bbox.min.z+bbox.max.z)/2);
    topCenter.project(camera);
    var sx = (topCenter.x * 0.5 + 0.5) * window.innerWidth;
    var sy = (-topCenter.y * 0.5 + 0.5) * window.innerHeight;
    labelDiv.style.left = Math.round(sx - 30) + 'px';
    labelDiv.style.top = Math.round(sy - 32) + 'px';
  }

  function rebuildSelectedMesh(newHeight) {
    if (selectedIdx < 0 || selectedIdx >= buildingMeshes.length) return;
    var b = buildingMeshes[selectedIdx];
    b.height = Math.max(3, Math.round(newHeight));
    // use rebuildWithParams to keep cornerRadius/taper/topType in sync
    rebuildWithParams('height', b.height);
  }

  // ===== 参数化重建 =====
  function roundShape(origShape, radiusPct) {
    if (radiusPct <= 0) return origShape;
    var pts = origShape.getPoints();
    if (pts.length < 3) return origShape;
    var ns = new THREE.Shape();
    var n = pts.length; if (pts[n-1].distanceTo(pts[0]) < 0.01) n--;
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      var d1 = p0.distanceTo(p1), d2 = p1.distanceTo(p2);
      var maxR = Math.min(d1, d2) * 0.45;
      var r = maxR * radiusPct / 100;
      if (r < 0.1) { if (i === 0) ns.moveTo(p1.x, p1.y); else ns.lineTo(p1.x, p1.y); continue; }
      var a1x = p1.x + (p0.x - p1.x) / d1 * r, a1y = p1.y + (p0.y - p1.y) / d1 * r;
      var a2x = p1.x + (p2.x - p1.x) / d2 * r, a2y = p1.y + (p2.y - p1.y) / d2 * r;
      if (i === 0) ns.moveTo(a1x, a1y); else ns.lineTo(a1x, a1y);
      ns.quadraticCurveTo(p1.x, p1.y, a2x, a2y);
    }
    ns.closePath();
    return ns;
  }

  function addCapGeometry(b) {
    if (b.capMesh) { scene.remove(b.capMesh); b.capMesh.geometry.dispose(); b.capMesh = null; }
    var tp = b.topType || 'flat';
    if (tp === 'flat') return;
    var bb = new THREE.Box3().setFromObject(b.mesh);
    var cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    var sx = (bb.max.x - bb.min.x), sz = (bb.max.z - bb.min.z);
    var rad = Math.min(sx, sz) / 2;
    var capH = rad * 0.8;
    var geo, mat;
    if (tp === 'dome') {
      geo = new THREE.SphereGeometry(rad, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      geo.scale(sx / (rad * 2), capH / rad, sz / (rad * 2));
    } else {
      geo = new THREE.ConeGeometry(rad, capH, 16);
      geo.scale(sx / (rad * 2), 1, sz / (rad * 2));
      geo.translate(0, capH / 2, 0);
    }
    mat = new THREE.MeshPhongMaterial({ color: b.idx === selectedIdx ? selectedColor : b.origColor, transparent: true, opacity: 0.9 });
    var m = new THREE.Mesh(geo, mat);
    m.position.set(cx, bb.max.y, cz);
    m.castShadow = true;
    scene.add(m);
    b.capMesh = m;
  }

  function rebuildWithParams(paramName, val) {
    if (selectedIdx < 0) return;
    var b = buildingMeshes[selectedIdx];
    if (paramName === 'height') b.height = Math.max(3, parseInt(val));
    if (paramName === 'radius') b.cornerRadius = parseInt(val);
    if (paramName === 'taper') b.taperRatio = parseInt(val);
    if (paramName === 'top') b.topType = val;
    scene.remove(b.mesh); scene.remove(b.wireframe);
    b.mesh.geometry.dispose(); b.mesh.material.dispose(); b.wireframe.geometry.dispose();
    var shape = roundShape(b.shape, b.cornerRadius || 0);
    var result = rebuildMesh(shape, b.height, selectedColor, b.idx);
    // apply taper
    if ((b.taperRatio || 0) > 0) {
      var pos = result.mesh.geometry.attributes.position;
      var bb = new THREE.Box3().setFromBufferAttribute(pos);
      for (var vi = 0; vi < pos.count; vi++) {
        var y = pos.getY(vi);
        var t = Math.max(0, y / b.height);
        var s = 1 - (b.taperRatio / 100) * t;
        var cx2 = (bb.min.x + bb.max.x) / 2, cz2 = (bb.min.z + bb.max.z) / 2;
        pos.setX(vi, cx2 + (pos.getX(vi) - cx2) * s);
        pos.setZ(vi, cz2 + (pos.getZ(vi) - cz2) * s);
      }
      pos.needsUpdate = true;
      result.mesh.geometry.computeVertexNormals();
      // rebuild wireframe for tapered
      result.wireframe.geometry.dispose();
      var newEdges = new THREE.EdgesGeometry(result.mesh.geometry, 15);
      result.wireframe.geometry = newEdges;
    }
    result.mesh.material.emissive && result.mesh.material.emissive.setHex(0x330000);
    result.wireframe.material.color.setHex(0xff4444);
    result.wireframe.material.opacity = 1.0;
    result.mesh.material.opacity = 0.85;
    scene.add(result.mesh); scene.add(result.wireframe);
    b.mesh = result.mesh; b.wireframe = result.wireframe;
    addCapGeometry(b);
    updateLabel();
  }

  function updTopBtns(tp) {
    ['flat','dome','cone'].forEach(function(t) {
      var btn = document.getElementById('topBtn_' + t);
      if (!btn) return;
      btn.style.background = t === tp ? 'rgba(178,0,0,0.7)' : 'rgba(255,255,255,0.1)';
      btn.style.color = t === tp ? '#fff' : 'rgba(255,255,255,0.6)';
      btn.style.borderColor = t === tp ? '#B20000' : 'rgba(255,255,255,0.2)';
    });
  }
  function onTopType(tp) {
    if (selectedIdx < 0) return;
    buildingMeshes[selectedIdx].topType = tp;
    updTopBtns(tp);
    rebuildWithParams('top', tp);
  }

  function getEventXY(e) {
    if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }

  // 触摸/点击开始
  var tapStartTime = 0;
  var tapStartPos = { x: 0, y: 0 };

  renderer.domElement.addEventListener('touchstart', onPointerDown, { passive: false });
  renderer.domElement.addEventListener('mousedown', onPointerDown);

  function onPointerDown(e) {
    var pos = getEventXY(e);
    tapStartTime = Date.now();
    tapStartPos = pos;

    // 检测是否点击到已选中的建筑（开始拖拽）
    if (selectedIdx >= 0) {
      mouse.x = (pos.x / window.innerWidth) * 2 - 1;
      mouse.y = -(pos.y / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      var hits = raycaster.intersectObject(buildingMeshes[selectedIdx].mesh);
      if (hits.length > 0) {
        isDragging = true;
        dragStartY = pos.y;
        dragStartHeight = buildingMeshes[selectedIdx].height;
        controls.enabled = false;
        e.preventDefault && e.preventDefault();
        return;
      }
    }
  }

  renderer.domElement.addEventListener('touchmove', onPointerMove, { passive: false });
  renderer.domElement.addEventListener('mousemove', onPointerMove);

  function onPointerMove(e) {
    if (!isDragging) return;
    e.preventDefault && e.preventDefault();
    var pos = getEventXY(e);
    var dy = dragStartY - pos.y; // 向上拖 = 增高
    var heightChange = dy * 0.5; // 灵敏度
    var newHeight = dragStartHeight + heightChange;
    rebuildSelectedMesh(newHeight);
  }

  renderer.domElement.addEventListener('touchend', onPointerUp);
  renderer.domElement.addEventListener('mouseup', onPointerUp);

  function onPointerUp(e) {
    var wasDragging = isDragging;
    isDragging = false;
    controls.enabled = true;

    if (wasDragging) return; // 拖拽结束，不执行选取

    // 判断是 tap（短按 + 小位移）
    var pos = getEventXY(e);
    var elapsed = Date.now() - tapStartTime;
    var moved = Math.abs(pos.x - tapStartPos.x) + Math.abs(pos.y - tapStartPos.y);
    if (elapsed > 400 || moved > 20) return; // 不是 tap

    // Raycast 选取建筑
    mouse.x = (pos.x / window.innerWidth) * 2 - 1;
    mouse.y = -(pos.y / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    var meshes = getMeshes();
    var hits = raycaster.intersectObjects(meshes);
    if (hits.length > 0) {
      var hitIdx = hits[0].object.userData.buildingIdx;
      if (hitIdx !== undefined) {
        selectBuilding(hitIdx === selectedIdx ? -1 : hitIdx);
      }
    } else {
      selectBuilding(-1);
    }
  }

  // 动画
  function animate() {
    requestAnimationFrame(animate);
    if (sunActive && sunPlaying) {
      var now = performance.now();
      if (sunRafLast !== null) { sunHour += (now - sunRafLast) / 1000 * sunSpeed / 3600; if (sunHour > 18) sunHour = 6; applySun(sunHour); }
      sunRafLast = now;
    } else { sunRafLast = null; }
    // camera focus lerp
    if (focusActive && focusTarget && focusPos) {
      controls.target.lerp(focusTarget, 0.08);
      camera.position.lerp(focusPos, 0.08);
      if (controls.target.distanceTo(focusTarget) < 0.5) focusActive = false;
    }
    controls.update();
    renderer.render(scene, camera);
    if (selectedIdx >= 0) updateLabel();
  }
  animate();

  // 应用初始主题
  switchTheme(currentTheme);

  window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // 主题切换（暮夜 / 白天）
  function switchTheme(theme) {
    currentTheme = theme;
    var t = themes[theme];

    // 背景色 & 雾气
    scene.background.setHex(t.bg);
    scene.fog.color.setHex(t.fog);
    // 增加雾的起始距离，避免画面被白色或深色“半透明遮罩”覆盖
    scene.fog.near = theme === 'dark' ? 2000 : 2500;
    scene.fog.far  = theme === 'dark' ? 6000 : 8000;

    // 环境光
    ambLight.color.setHex(theme === 'dark' ? 0x8ab0ff : 0xfff8f0);
    ambLight.intensity = t.ambient;

    // 方向光（太阳）
    dirLight.color.setHex(theme === 'dark' ? 0x3355aa : 0xfff0d0);
    dirLight.intensity = t.dirIntensity;
    dirLight.position.set(
      theme === 'dark' ? 200 : 400,
      theme === 'dark' ? 400 : 600,
      theme === 'dark' ? 300 : 200
    );

    // 补光（背光）- 白昼模式下增强背光
    backLight.color.setHex(theme === 'dark' ? 0x445588 : 0xcce0ff);
    backLight.intensity = theme === 'dark' ? 0.2 : 0.5;

    // 半球光
    hemLight.color.setHex(t.hemSkyColor);
    hemLight.groundColor.setHex(t.hemGroundColor);
    hemLight.intensity = t.hemIntensity;

    // 霓虹点光源
    pointLight.color.setHex(t.pointColor);
    pointLight.intensity = t.pointIntensity;

    // 建筑颜色 & 自发光 & 边线颜色 & 透明度
    buildingMeshes.forEach(function(b) {
      b.origColor = t.colors[b.idx % t.colors.length];
      if (b.idx !== selectedIdx) {
        b.mesh.material.color.setHex(b.origColor);
        b.mesh.material.opacity = t.buildingOpacity;
        b.mesh.material.transparent = t.buildingOpacity < 1;
        b.mesh.material.needsUpdate = true;
        if (b.mesh.material.emissive) {
          b.mesh.material.emissive.setHex(t.emissive);
          b.mesh.material.emissiveIntensity = t.emissiveIntensity;
        }
        if (b.wireframe && b.wireframe.material) {
          b.wireframe.material.color.setHex(t.wireColor);
          b.wireframe.material.opacity = t.wireOpacity;
          b.wireframe.material.needsUpdate = true;
        }
      }
      // update cap mesh color if exists
      if (b.capMesh) {
        b.capMesh.material.color.setHex(b.idx === selectedIdx ? selectedColor : b.origColor);
        b.capMesh.material.opacity = t.buildingOpacity;
        b.capMesh.material.transparent = t.buildingOpacity < 1;
        b.capMesh.material.needsUpdate = true;
      }
    });
  }

  // ===== 日照轨迹 =====
  var sunActive=false,sunHour=9,sunPlaying=false,sunSpeed=10,sunSeason='winter',sunRafLast=null;
  var speedOpts=[100,500,1000,2000],speedIdx=1;
  var SEASONS={spring:79,summer:172,autumn:266,winter:356};
  function calcSunPos(lat,lon,doy,h){
    var PI=Math.PI,r=PI/180;
    var decl=-23.45*Math.cos(2*PI/365*(doy+10))*r;
    var B=2*PI*(doy-1)/365;
    var eot=229.18*(0.000075+0.001868*Math.cos(B)-0.032077*Math.sin(B)-0.014615*Math.cos(2*B)-0.04089*Math.sin(2*B));
    var ha=(h*60+(lon-120)*4+eot)/4*r-PI;
    var lr=lat*r,sa=Math.sin(lr)*Math.sin(decl)+Math.cos(lr)*Math.cos(decl)*Math.cos(ha);
    var alt=Math.asin(Math.max(-1,Math.min(1,sa))),ca=Math.cos(alt),az=0;
    if(ca>0.001){var caz=(Math.sin(decl)-Math.sin(lr)*Math.sin(alt))/(Math.cos(lr)*ca);az=Math.acos(Math.max(-1,Math.min(1,caz)));if(ha>0)az=2*PI-az;}
    return{alt:alt,az:az};
  }
  function applySun(hour){
    if(!sunActive)return;
    var s=calcSunPos(centerLat,centerLon,SEASONS[sunSeason],hour),ad=s.alt*180/Math.PI,R=shadowCamHalf*2;
    // 定义颜色常量 - 白昼和夜幕的主题色
    var DAY_BG = 0xf5f5f5, DAY_FOG = 0xf5f5f5;
    var NIGHT_BG = 0x1a1a2e, NIGHT_FOG = 0x1a1a2e;
    var SUNRISE_BG = 0xffddaa, SUNRISE_FOG = 0xffddaa; // 日出/日落暖色
    if(ad>0){
      dirLight.position.set(R*Math.cos(s.alt)*Math.sin(s.az),Math.max(20,R*Math.sin(s.alt)),-R*Math.cos(s.alt)*Math.cos(s.az));
      dirLight.target.position.set(0,0,0);dirLight.target.updateMatrixWorld();dirLight.shadow.camera.updateProjectionMatrix();dirLight.visible=true;
      if(ad<5){
        // 日出/日落初期：从夜幕到暖色的过渡
        var f=ad/5;
        dirLight.intensity=f*0.4;dirLight.color.setHex(0xff5500);
        ambLight.color.setHex(0xff8833);ambLight.intensity=0.1+f*0.15;
        // 背景：夜幕 -> 暖色
        scene.background.setHex(NIGHT_BG).lerp(new THREE.Color(SUNRISE_BG), f);
        scene.fog.color.setHex(NIGHT_FOG).lerp(new THREE.Color(SUNRISE_FOG), f);
      }
      else if(ad<15){
        // 日出/日落中期：从暖色到白昼的过渡
        var f=(ad-5)/10;
        dirLight.intensity=0.4+f*0.4;dirLight.color.setHex(0xffaa33);
        ambLight.color.setHex(0xffcc66);ambLight.intensity=0.25+f*0.35;
        // 背景：暖色 -> 白昼
        scene.background.setHex(SUNRISE_BG).lerp(new THREE.Color(DAY_BG), f);
        scene.fog.color.setHex(SUNRISE_FOG).lerp(new THREE.Color(DAY_FOG), f);
      }
      else{
        // 正午：白昼
        var f=Math.min(1,(ad-15)/45);
        dirLight.intensity=0.8+f*0.5;dirLight.color.setHex(0xfff0d0);
        ambLight.color.setHex(0xfff8f0);ambLight.intensity=0.6+f*0.5;
        scene.background.setHex(DAY_BG);scene.fog.color.setHex(DAY_FOG);
      }
    }else{
      // 夜晚：夜幕
      dirLight.visible=false;
      ambLight.color.setHex(0x1a2a6a);ambLight.intensity=0.08;
      scene.background.setHex(NIGHT_BG);scene.fog.color.setHex(NIGHT_FOG);
    }
    var sl=document.getElementById('sunSlider');if(sl)sl.value=hour;
    var tt=document.getElementById('sunTimeText');if(tt){var hh=Math.floor(hour),mm=Math.floor((hour-hh)*60);tt.textContent=(hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm;}
  }
  function updSeasonBtns(){
    ['spring','summer','autumn','winter'].forEach(function(s){
      var b=document.getElementById('sbtn_'+s);if(!b)return;
      b.style.borderColor=s===sunSeason?'rgba(255,193,7,0.7)':'rgba(255,255,255,0.15)';
      b.style.background=s===sunSeason?'rgba(255,193,7,0.25)':'rgba(0,0,0,0.65)';
      b.style.color=s===sunSeason?'#ffd700':'rgba(255,255,255,0.75)';
    });
  }
  function toggleSunPlay(){sunPlaying=!sunPlaying;sunRafLast=null;var b=document.getElementById('sunPlayBtn');if(b)b.textContent=sunPlaying?'⏸':'▶';}
  function cycleSunSpeed(){speedIdx=(speedIdx+1)%speedOpts.length;sunSpeed=speedOpts[speedIdx];var b=document.getElementById('sunSpeedBtn');if(b)b.textContent=(sunSpeed/100)+'×';}
  function setSeason(s){sunSeason=s;updSeasonBtns();applySun(sunHour);}
  function onSunSlider(v){sunHour=parseFloat(v);sunPlaying=false;sunRafLast=null;var b=document.getElementById('sunPlayBtn');if(b)b.textContent='▶';applySun(sunHour);}
  function toggleSunTrail(){
    sunActive=!sunActive;
    var ov=document.getElementById('sunOverlay');if(ov)ov.style.display=sunActive?'block':'none';
    if(sunActive){selectBuilding(-1);sunPlaying=true;sunHour=9;updSeasonBtns();applySun(sunHour);}else{sunPlaying=false;switchTheme(currentTheme);}
  }
  function handleMsg(e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.type === 'toggleAutoRotate') controls.autoRotate = msg.value;
      if (msg.type === 'switchTheme') switchTheme(msg.value);
      if (msg.type === 'toggleSunTrail') toggleSunTrail();
    } catch(ex) {}
  }
  window.addEventListener('message', handleMsg);
  document.addEventListener('message', handleMsg);
  // ===== 将 HTML 内联事件引用的函数暴露到全局作用域 =====
  window.rebuildWithParams = rebuildWithParams;
  window.onTopType = onTopType;
  window.onSunSlider = onSunSlider;
  window.toggleSunPlay = toggleSunPlay;
  window.cycleSunSpeed = cycleSunSpeed;
  window.setSeason = setSeason;
})();
</script>
<style>#sunSlider{-webkit-appearance:none;width:100%;height:4px;border-radius:2px;background:rgba(255,255,255,0.22);outline:none;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:none;}#sunSlider:focus{outline:none;}#sunSlider::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:#ffd700;border:2px solid #fff;box-shadow:0 0 6px rgba(255,193,7,0.5);cursor:pointer;}</style>
<div id="sunOverlay" style="display:none;position:fixed;inset:0;pointer-events:none;z-index:90;">
  <div style="position:absolute;left:10px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:7px;pointer-events:auto;">
    <button id="sbtn_spring" onclick="setSeason('spring')" style="width:50px;padding:4px 2px;border-radius:4px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.65);color:rgba(255,255,255,0.75);font:600 10px sans-serif;cursor:pointer;">🌸春分</button>
    <button id="sbtn_summer" onclick="setSeason('summer')" style="width:50px;padding:4px 2px;border-radius:4px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.65);color:rgba(255,255,255,0.75);font:600 10px sans-serif;cursor:pointer;">☀️夏至</button>
    <button id="sbtn_autumn" onclick="setSeason('autumn')" style="width:50px;padding:4px 2px;border-radius:4px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.65);color:rgba(255,255,255,0.75);font:600 10px sans-serif;cursor:pointer;">🍂秋分</button>
    <button id="sbtn_winter" onclick="setSeason('winter')" style="width:50px;padding:4px 2px;border-radius:4px;border:1px solid rgba(255,193,7,0.7);background:rgba(255,193,7,0.22);color:#ffd700;font:600 10px sans-serif;cursor:pointer;">❄️冬至</button>
  </div>
  <div style="position:absolute;bottom:12px;left:10px;right:10px;background:rgba(0,0,0,0.72);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:10px 12px;pointer-events:auto;">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:16px;">☀️</span>
      <span id="sunTimeText" style="color:#fff;font:700 14px monospace;min-width:46px;">09:00</span>
      <button id="sunPlayBtn" onclick="toggleSunPlay()" style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.3);color:#fff;font-size:12px;cursor:pointer;-webkit-tap-highlight-color:transparent;outline:none;">⏸</button>
      <button id="sunSpeedBtn" onclick="cycleSunSpeed()" style="padding:3px 8px;border-radius:10px;background:rgba(255,193,7,0.18);border:1px solid rgba(255,193,7,0.5);color:#ffd700;font:700 11px sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent;outline:none;">1×</button>
      <div style="flex:1;min-width:0;">
        <input type="range" id="sunSlider" min="6" max="18" step="0.05" value="9" oninput="onSunSlider(this.value)" style="width:100%;">
      </div>
    </div>
  </div>
</div>
<div id="editPanel" style="display:none;position:fixed;right:8px;top:50%;transform:translateY(-50%);width:fit-content;min-width:0;background:rgba(0,0,0,0.78);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:14px;pointer-events:auto;z-index:95;"><div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:rgba(255,255,255,0.6);font-size:11px;">高度</span><span id="epHeightVal" style="color:#fff;font:700 11px monospace;">45m</span></div><input type="range" id="epHeight" min="3" max="200" value="45" class="epSlider" style="width:120px;" oninput="rebuildWithParams('height',this.value);document.getElementById('epHeightVal').textContent=this.value+'m'"></div><div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:rgba(255,255,255,0.6);font-size:11px;">圆角</span><span id="epRadiusVal" style="color:#fff;font:700 11px monospace;">0%</span></div><input type="range" id="epRadius" min="0" max="100" value="0" class="epSlider" style="width:120px;" oninput="rebuildWithParams('radius',this.value);document.getElementById('epRadiusVal').textContent=this.value+'%'"></div><div style="margin-bottom:10px;"><span style="color:rgba(255,255,255,0.6);font-size:11px;display:block;margin-bottom:6px;">顶部形态</span><div style="display:flex;gap:4px;justify-content:flex-start;"><button id="topBtn_flat" onclick="onTopType('flat')" style="padding:6px 8px;border-radius:8px;border:1px solid #B20000;background:rgba(178,0,0,0.7);color:#fff;font:600 10px sans-serif;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent;outline:none;">平顶</button><button id="topBtn_dome" onclick="onTopType('dome')" style="padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);font:600 10px sans-serif;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent;outline:none;">穹顶</button><button id="topBtn_cone" onclick="onTopType('cone')" style="padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);font:600 10px sans-serif;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent;outline:none;">尖顶</button></div></div><div><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:rgba(255,255,255,0.6);font-size:11px;">锥度</span><span id="epTaperVal" style="color:#fff;font:700 11px monospace;">0%</span></div><input type="range" id="epTaper" min="0" max="80" value="0" class="epSlider" style="width:120px;" oninput="rebuildWithParams('taper',this.value);document.getElementById('epTaperVal').textContent=this.value+'%'"></div></div>
<style>.epSlider{-webkit-appearance:none;width:100%;height:3px;border-radius:2px;background:rgba(255,255,255,0.2);outline:none;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:none;}.epSlider:focus{outline:none;}.epSlider::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#B20000;border:2px solid #fff;box-shadow:0 0 4px rgba(178,0,0,0.5);cursor:pointer}</style>
</body></html>`;
  }, [buildings, wgsBbox, tileData, dayMode]);

  // ===== 选取模式 UI =====
  if (mode === 'select') {
    return (
      <View style={styles.container}>
        {/* 本地 OSM 地图（完全离线） */}
        <OSMSelectMap
          ref={osmMapRef}
          key="osm-map"
          style={styles.mapView}
          initialCenter={mapCenter}
          initialZoom={mapZoom}
          onBoundsChange={handleTianDiTuBoundsChange}
        />

        {/* 顶部标题栏 */}
        <View style={[styles.headerBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>3D 建筑白模</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        {/* 右上角行政区划与经纬度信息面板 */}
        <View style={[styles.mapInfoPanel, { top: insets.top + 16 }]}>
          <Text style={styles.mapInfoRegion}>{mapInfo.region || '定位中...'}</Text>
          <Text style={styles.mapInfoCoords}>{mapInfo.coords}</Text>
        </View>

        {/* 遮罩 + 选取框 */}
        <View style={styles.overlayContainer} pointerEvents="box-none">
          {/* 上部遮罩：flex 1 自动填充 */}
          <View style={styles.maskFlex} pointerEvents="none" />
          {/* 中间行 */}
          <View style={[styles.maskRow, { height: boxH }]} pointerEvents="box-none">
            <View style={styles.maskSide} pointerEvents="none" />
            <View style={[styles.selectBox, { width: boxW, height: boxH }, isAreaTooLarge && styles.selectBoxOversize]} pointerEvents="box-none">
              {/* 4 个角点 - 居中对齐在边线交点上 */}
              <View style={[styles.cornerDot, styles.dotTL]} />
              <View style={[styles.cornerDot, styles.dotTR]} />
              <View style={[styles.cornerDot, styles.dotBL]} />
              {/* 右下角调整大小按钮 - 增大热区防止与地图交互冲突 */}
              <View
                style={styles.resizeHandleContainer}
                {...resizePanResponder.panHandlers}
              >
                <View style={[styles.cornerDot, styles.dotBR]}>
                  <Image source={require('@/assets/images/move.png')} style={styles.moveIcon} />
                </View>
              </View>
              <Text style={styles.boxAreaText}>{overpassAreaStr}</Text>
            </View>
            <View style={styles.maskSide} pointerEvents="none" />
          </View>
          {/* 下部遮罩：flex 1 自动填充 */}
          <View style={styles.maskFlex} pointerEvents="none" />
        </View>

        {/* 底部确认 */}
        <View style={[styles.floatingBtnWrap, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.blackBtn, isAreaTooLarge && styles.blackBtnDisabled]}
            onPress={handleConfirmSelect}
            disabled={isAreaTooLarge}
            activeOpacity={0.8}
          >
            <View style={styles.blackBtnInner}>
              <View style={styles.blackBtnHighlight} />
              <Text style={styles.blackBtnText}>
                {isAreaTooLarge ? '选取窗口超出建模生成区域' : '确认选取，生成 3D 白模'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ===== 加载中 UI =====
  if (mode === 'loading') {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#B20000" />
          <Text style={styles.loadingText}>正在从 OSM 获取建筑数据...</Text>
          <Text style={styles.loadingSubtext}>正在连接 Overpass API</Text>
        </View>
      </LinearGradient>
    );
  }

  // ===== 3D 预览模式 UI =====


  const EXPORT_FORMATS = [
    { key: 'PNG', label: 'PNG 截图', desc: '高清 3D 效果图' },
    { key: 'OBJ', label: 'OBJ 模型', desc: '通用 3D 模型格式' },
    { key: 'GLTF', label: 'glTF 模型', desc: '高性能 3D 格式' },
    { key: 'DXF', label: 'DXF 工程图', desc: 'AutoCAD 兼容格式' },
  ];

  const toggleExportFormat = (key: string) => {
    setSelectedExportFormats(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // 图标按钮数据 - 使用本地图片
  const iconButtons = [
    {
      key: 'dayNight',
      iconOff: require('@/assets/images/3dbuild/light_of.png'),
      iconOn: require('@/assets/images/3dbuild/light_on.png'),
      active: !dayMode,
      onPress: () => {
        const next = !dayMode;
        setDayMode(next);
        preview3dRef.current?.postMessage(JSON.stringify({ type: 'switchTheme', value: next ? 'light' : 'dark' }));
      },
    },
    {
      key: 'rotate',
      iconOff: require('@/assets/images/3dbuild/360_of.png'),
      iconOn: require('@/assets/images/3dbuild/360_on.png'),
      active: autoRotate,
      onPress: () => {
        const next = !autoRotate;
        setAutoRotate(next);
        preview3dRef.current?.postMessage(JSON.stringify({ type: 'toggleAutoRotate', value: next }));
      },
    },
    {
      key: 'fullscreen',
      iconOff: require('@/assets/images/3dbuild/quanping_of.png'),
      active: false,
      onPress: () => {
        const next = !fullscreen;
        setFullscreen(next);
        if (next) {
          Orientation.unlockAllOrientations();
          setTimeout(() => {
            Orientation.lockToLandscape();
          }, 100);
        } else {
          Orientation.unlockAllOrientations();
          setTimeout(() => {
            Orientation.lockToPortrait();
          }, 100);
        }
      },
    },
    {
      key: 'sun',
      iconOff: require('@/assets/images/3dbuild/guangzhao_of.png'),
      iconOn: require('@/assets/images/3dbuild/guangzhao_on.png'),
      active: sunTrail,
      onPress: () => {
        const next = !sunTrail;
        setSunTrail(next);
        preview3dRef.current?.postMessage(JSON.stringify({ type: 'toggleSunTrail' }));
      },
    },
  ];

  if (fullscreen) {
    // 全屏只显示 3D 预览 + 退出按钮
    return (
      <View style={[styles.container, { backgroundColor: dayMode ? '#f5f5f5' : '#0a0a14' }]}>
        <WebView
          key={`fullscreen-3d-${dayMode ? 'light' : 'dark'}`}
          ref={preview3dRef}
          source={{ html: generate3dHtml(), baseUrl: 'file:///android_asset/' }}
          style={[styles.fullscreenPreview, { backgroundColor: dayMode ? '#f5f5f5' : '#1a1a2e' }]}
          javaScriptEnabled
          domStorageEnabled
            scrollEnabled={false}
            originWhitelist={['*']}
            allowFileAccess
            allowUniversalAccessFromFileURLs
            mixedContentMode="always"
            onError={(e) => console.warn('[3D WebView Error]', e.nativeEvent)}
          />
        <TouchableOpacity
          style={[styles.exitFullscreenBtn, { top: insets.top + 10 }]}
          onPress={() => {
            setFullscreen(false);
            Orientation.unlockAllOrientations();
            setTimeout(() => {
              Orientation.lockToPortrait();
            }, 100);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.exitFullscreenText}>✕ 退出全屏</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 顶部返回 */}
      <View style={{ position: 'absolute', left: 12, top: insets.top + 16, zIndex: 100 }}>
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 3D 预览窗口 */}
      <WebView
        ref={preview3dRef}
        source={{ html: generate3dHtml(), baseUrl: 'file:///android_asset/' }}
        style={[styles.previewView, { backgroundColor: dayMode ? '#f5f5f5' : '#1a1a2e' }]}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        originWhitelist={['*']}
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        onError={(e) => console.warn('[3D WebView Error]', e.nativeEvent)}
      />

      {/* 下方面板 */}
      <View style={[styles.previewPanel, { paddingBottom: insets.bottom + 70 }]}>
        {/* 统计信息 + 图标按钮 */}
        <View style={styles.panelHeader}>
          <View style={styles.panelTitleRow}>
            <View>
              <Text style={styles.panelTitle}>3D 建筑白模</Text>
              <Text style={styles.panelStat}>共 {buildingCount} 栋建筑 · {areaKm2.toFixed(2)} km²</Text>
            </View>
            {/* 四个圆形图标按钮 */}
            <View style={styles.iconBtnRow}>
              {iconButtons.map((btn) => (
                <TouchableOpacity
                  key={btn.key}
                  style={[styles.iconBtn, btn.active && styles.iconBtnActive]}
                  onPress={btn.onPress}
                  activeOpacity={0.7}
                >
                  <Image
                    source={btn.active && btn.iconOn ? btn.iconOn : btn.iconOff}
                    style={styles.iconBtnImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* 导出格式选项 */}
        <ScrollView style={styles.exportSection} showsVerticalScrollIndicator={false}>
          {EXPORT_FORMATS.map(fmt => (
            <TouchableOpacity
              key={fmt.key}
              style={[styles.exportRow, selectedExportFormats.has(fmt.key) && styles.exportRowActive]}
              onPress={() => toggleExportFormat(fmt.key)}
              activeOpacity={0.7}
            >
              <View style={styles.exportRowLeft}>
                <View style={[styles.exportCheck, selectedExportFormats.has(fmt.key) && styles.exportCheckActive]}>
                  {selectedExportFormats.has(fmt.key) && <Text style={styles.exportCheckMark}>✓</Text>}
                </View>
                <View>
                  <Text style={[styles.exportLabel, selectedExportFormats.has(fmt.key) && styles.exportLabelActive]}>{fmt.label}</Text>
                  <Text style={styles.exportDesc}>{fmt.desc}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}

        </ScrollView>
      </View>

      {/* 底部固定导出按钮 */}
      <View style={[styles.floatingBtnWrap, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.blackBtn}
          onPress={() => Alert.alert('导出', `将导出 ${[...selectedExportFormats].join(', ')} 格式`)}
          activeOpacity={0.8}
        >
          <View style={styles.blackBtnInner}>
            <View style={styles.blackBtnHighlight} />
            <Text style={styles.blackBtnText}>导出</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },

  // 统一标题栏样式
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, position: 'absolute', left: 0, right: 0, zIndex: 100 },
  headerBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  headerRightPlaceholder: { width: 40 },

  // 地图
  mapView: { flex: 1, backgroundColor: '#000' },

  // 遮罩
  overlayContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center' },
  maskFlex: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  maskRow: { flexDirection: 'row' },
  maskSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },

  // 选取框
  selectBox: {
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectBoxOversize: { borderColor: '#888', borderStyle: 'dashed', backgroundColor: 'rgba(128,128,128,0.15)' },
  boxAreaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  // TopoExport 风格的大圆角点
  cornerDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#000',
  },
  dotTL: { top: -8, left: -8 },
  dotTR: { top: -8, right: -8 },
  dotBL: { bottom: -8, left: -8 },
  // 右下角调整大小按钮容器 - 增大热区到 60x60，确保触摸不冲突
  resizeHandleContainer: {
    position: 'absolute',
    bottom: -30,
    right: -30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    // 背景透明但可触摸
    backgroundColor: 'transparent',
  },
  dotBR: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moveIcon: {
    width: 16,
    height: 16,
    tintColor: '#fff',
  },
  // 返回
  backBtn: {
    position: 'absolute',
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  
  mapInfoPanel: {
    position: 'absolute',
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'flex-end',
    pointerEvents: 'none',
  },
  mapInfoRegion: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  mapInfoCoords: {
    color: '#ccc',
    fontSize: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  mapSwitchBtn: {
    position: 'absolute',
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 100,
  },

  // 纯黑悬浮按钮（复刻 BottomActionBar 的双圈结构）
  floatingBtnWrap: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20,
  },
  blackBtn: {
    borderRadius: 25,
    height: 50,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#000',
    overflow: 'hidden',
  },
  blackBtnInner: {
    flex: 1,
    width: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    height: 42,
  },
  blackBtnHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  blackBtnDisabled: { opacity: 0.4 },
  blackBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // 底部
  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  bottomHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  confirmBtn: {
    backgroundColor: '#B20000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: '#444' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // 加载中
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loadingSubtext: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },

  // 3D 预览 / 2D 瓦片预览 - 统一高度
  previewView: {
    height: SCREEN_H * 0.42,
    backgroundColor: '#1a1a2e',
    overflow: 'hidden',
  },
  fullscreenPreview: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  tileFullImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a2e',
  },
  exitFullscreenBtn: {
    position: 'absolute',
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    zIndex: 100,
  },
  exitFullscreenText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // 下方面板
  previewPanel: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  panelHeader: {
    marginBottom: 14,
  },
  panelTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelTitle: { color: '#111', fontSize: 18, fontWeight: '700' },
  panelStat: { color: 'rgba(0,0,0,0.4)', fontSize: 12, marginTop: 3 },
  // 图标按钮行
  iconBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {
    backgroundColor: '#000',
  },
  iconBtnImage: {
    width: 20,
    height: 20,
  },

  // 导出格式
  exportSection: {
    flex: 1,
    marginTop: 5,
  },
  exportSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
  },
  exportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  exportRowActive: {
    backgroundColor: 'rgba(178,0,0,0.04)',
    borderColor: 'rgba(178,0,0,0.2)',
  },
  exportRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exportCheck: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportCheckActive: {
    backgroundColor: '#B20000',
    borderColor: '#B20000',
  },
  exportCheckMark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  exportLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  exportLabelActive: {
    color: '#B20000',
  },
  exportDesc: {
    fontSize: 11,
    color: '#999',
    marginTop: 1,
  },
});

export default Building3DGuard;
