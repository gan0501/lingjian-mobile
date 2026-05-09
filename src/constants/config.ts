/**
 * 领建 - 应用配置常量
 *
 * 包含 API地址、地图配置、分页配置、业务类型定义、地图瓦片策略。
 * 所有环境相关配置通过 __DEV__ 自动切换。
 */

// ─── API 地址 ───

export const API_BASE_URLS = {
  LOCAL: 'http://192.168.50.166:8000',
  LINGJIANAI: 'https://api.lingjianai.cn',
  LINKBUILD: 'https://linkbuild.com.cn',
  CLOUD: 'http://115.190.218.156:8000',
} as const;

export const getApiBaseUrl = (): string => {
  // 开发环境使用本地后端进行调试
  if (__DEV__) return API_BASE_URLS.LOCAL;
  return API_BASE_URLS.LINGJIANAI;
};

export const API_CONFIG = {
  get BASE_URL() {
    return getApiBaseUrl();
  },
  TIMEOUT: 30000,
} as const;

// ─── 应用信息 ───

export const APP_CONFIG = {
  APP_NAME: '领建',
  VERSION: '5.0',
} as const;

// ─── 分页 ───

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 30,
  MAX_PAGE_SIZE: 100,
} as const;

// ─── 缓存策略 ───

export const CACHE_CONFIG = {
  /** 数据新鲜时间：10秒内不重新请求 */
  STALE_TIME: 10 * 1000,
  /** 缓存保留时间：5分钟后清除未使用缓存 */
  GC_TIME: 5 * 60 * 1000,
} as const;

// ─── 地图配置 ───

export const MAP_CONFIG = {
  /** 天地图浏览器端密钥（用于WebView） */
  TIANDITU_BROWSER_KEY: '5f0faa0b93213cc747eebab0891c2cfc',
  /** 天地图服务端密钥（RN直接请求，不限Referer） */
  TIANDITU_SERVER_KEY: '0c6848d508cb374782cf1481056e23cf',
  /** 默认中心点（杭州） */
  DEFAULT_CENTER: {
    latitude: 30.2741,
    longitude: 120.1551,
  },
  /** 杭州中心坐标（数组格式，MapLibreGL专用） */
  HANGZHOU_CENTER: [120.1551, 30.2741] as [number, number],
  /** 默认缩放级别 */
  DEFAULT_ZOOM: 10,
  /** 聚合球显示阈值（低于此zoom显示聚合） */
  CLUSTER_THRESHOLD: 9,
  /** 最大可见标记数量 */
  MAX_VISIBLE_MARKERS: 4000,
  /** 标记渲染上限（GPU安全阈值） */
  MAX_RENDER_MARKERS: 2000,
} as const;

// ─── 省市区数据 ───

export const DEFAULT_PROVINCES = [
  '北京市', '天津市', '上海市', '重庆市',
  '河北省', '山西省', '辽宁省', '吉林省', '黑龙江省',
  '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省',
  '河南省', '湖北省', '湖南省', '广东省', '海南省',
  '四川省', '贵州省', '云南省', '陕西省', '甘肃省', '青海省', '台湾省',
  '内蒙古自治区', '广西壮族自治区', '西藏自治区', '宁夏回族自治区', '新疆维吾尔自治区',
  '香港特别行政区', '澳门特别行政区',
] as const;

export const PROVINCE_CODE_BY_NAME: Record<string, string> = {
  北京市: '11', 天津市: '12', 上海市: '31', 重庆市: '50',
  河北省: '13', 山西省: '14', 辽宁省: '21', 吉林省: '22', 黑龙江省: '23',
  江苏省: '32', 浙江省: '33', 安徽省: '34', 福建省: '35', 江西省: '36', 山东省: '37',
  河南省: '41', 湖北省: '42', 湖南省: '43', 广东省: '44', 海南省: '46',
  四川省: '51', 贵州省: '52', 云南省: '53', 陕西省: '61', 甘肃省: '62', 青海省: '63', 台湾省: '71',
  内蒙古自治区: '15', 广西壮族自治区: '45', 西藏自治区: '54', 宁夏回族自治区: '64', 新疆维吾尔自治区: '65',
  香港特别行政区: '81', 澳门特别行政区: '82',
};

// ─── 业务类型定义 ───

export const PROJECT_TYPES = [
  { id: 1, name: '规划工程', key: 'planning' },
  { id: 2, name: '土地拍卖', key: 'landAuction' },
  { id: 3, name: '招标信息', key: 'bidding' },
  { id: 4, name: '采购公告', key: 'procurement' },
  { id: 5, name: '自建项目', key: 'custom' },
] as const;

export const ENTERPRISE_TYPES = [
  { id: 1, name: '招标造价', key: 'consultancy' },
  { id: 2, name: '设计勘察', key: 'design' },
  { id: 3, name: '施工安装', key: 'construction' },
  { id: 4, name: '监理检测', key: 'supervision' },
] as const;

export const MANUFACTURER_TYPES = [
  { id: 1, name: '材料厂家', key: 'material' },
  { id: 2, name: '劳务班组', key: 'labor' },
  { id: 3, name: '机械设备', key: 'equipment' },
  { id: 4, name: '商务服务', key: 'service' },
] as const;

export const ENTERPRISE_DB_TYPE_RANGE = { min: 8, max: 16 } as const;
export const MANUFACTURER_DB_TYPE_RANGE = { min: 1, max: 7 } as const;

export const ENTERPRISE_CATEGORY_TO_DB_TYPES: Record<number, number[]> = {
  1: [12, 13],
  2: [9, 10, 14],
  3: [8],
  4: [11, 15],
};

export const ENTERPRISE_DB_TYPE_TO_CATEGORY: Record<number, number> = {
  8: 3, 9: 2, 10: 2, 11: 4, 12: 1, 13: 1, 14: 2, 15: 4,
};

export const MANUFACTURER_CATEGORY_TO_DB_TYPES: Record<number, number[]> = {
  1: [1],
  2: [2],
  3: [3],
  4: [4, 5, 6, 7],
};

export const MANUFACTURER_DB_TYPE_TO_CATEGORY: Record<number, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 4, 6: 4, 7: 4,
};

export const getEnterpriseDbTypes = (categoryIds: number[]): number[] => {
  const types = new Set<number>();
  categoryIds.forEach(id => {
    (ENTERPRISE_CATEGORY_TO_DB_TYPES[id] || []).forEach(t => types.add(t));
  });
  return Array.from(types);
};

export const getManufacturerDbTypes = (categoryIds: number[]): number[] => {
  const types = new Set<number>();
  categoryIds.forEach(id => {
    (MANUFACTURER_CATEGORY_TO_DB_TYPES[id] || []).forEach(t => types.add(t));
  });
  return Array.from(types);
};

export const normalizeEnterpriseType = (dbType: number): number => {
  return ENTERPRISE_DB_TYPE_TO_CATEGORY[dbType] ?? 3;
};

export const normalizeManufacturerType = (dbType: number): number => {
  return MANUFACTURER_DB_TYPE_TO_CATEGORY[dbType] ?? 1;
};

/** 筛选栏 Emoji 图标 */
export const FILTER_ICONS = {
  project: { 1: '🪧', 2: '⛰️', 3: '🎯', 4: '📦', 5: '📌' } as Record<number, string>,
  enterprise: { 1: '🏗️', 2: '📐', 3: '🔧', 4: '🔍' } as Record<number, string>,
  manufacturer: { 1: '🧱', 2: '👷', 3: '🚜', 4: '💼' } as Record<number, string>,
};

// ─── 地图瓦片样式（双源策略：天地图 + 高德兜底） ───

// ============================================================
// 🗺️ 地图源自动切换：
//   开发环境 → 高德优先（避免VPN导致天地图418报错）
//   生产环境 → 天地图优先（上架要求使用国产地图），高德兜底
// ============================================================
const USE_GAODE_PRIMARY = __DEV__;

/**
 * 天地图 WMTS 瓦片 URL（通过服务器代理，解决 IP 白名单问题）
 */
const getTianDiTuTiles = (layer: string): string[] => [
  `${getApiBaseUrl()}/api/map/${layer}/{z}/{x}/{y}`,
];

/**
 * 高德地图栅格瓦片 URL（免 key 的 Web 瓦片服务）
 * scale=2 返回 512×512 高清瓦片，配合 tileSize:256 在高 DPI 屏幕上显示清晰
 */
const getGaoDeTiles = (): string[] => [
  'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=2&style=8&x={x}&y={y}&z={z}',
  'https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=2&style=8&x={x}&y={y}&z={z}',
  'https://webrd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=2&style=8&x={x}&y={y}&z={z}',
  'https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=2&style=8&x={x}&y={y}&z={z}',
];

/**
 * 生成 MapLibreGL 瓦片样式对象
 *
 * 双源策略：
 *   - 主源（primary-raster）：生产用天地图、开发用高德
 *   - 兜底源（fallback-raster）：与主源互补
 *   - 注记层（tianditu-cva）：仅天地图主源时叠加（高德自带中文标注）
 *
 * 高清渲染策略：
 *   - 高德瓦片：scale=2 返回 512×512 实际像素，声明 tileSize:256 → 原生 @2x 高清
 *   - 天地图瓦片：WMTS 标准只返回 256×256，声明 tileSize:128 → 让 MapLibre
 *     在每个逻辑位置请求 zoom+1 级别的 4 张瓦片，等效 @2x 高清
 */
export const getMapTileStyle = () => {
  const isGaode = USE_GAODE_PRIMARY;

  const primaryTiles = isGaode ? getGaoDeTiles() : getTianDiTuTiles('vec_w');
  const fallbackTiles = isGaode ? getTianDiTuTiles('vec_w') : getGaoDeTiles();
  const useTdtLabels = !isGaode;

  // 高德 512px 配 tileSize:256 = 原生 @2x；天地图 256px 配 tileSize:128 = 强制 @2x
  const primarySize = isGaode ? 256 : 128;
  const fallbackSize = isGaode ? 128 : 256;
  const tdtLabelSize = 128;

  const sources: Record<string, any> = {
    'primary-raster': {
      type: 'raster' as const,
      tiles: primaryTiles,
      tileSize: primarySize,
      minzoom: 1,
      maxzoom: 18,
    },
    'fallback-raster': {
      type: 'raster' as const,
      tiles: fallbackTiles,
      tileSize: fallbackSize,
      minzoom: 1,
      maxzoom: 18,
    },
  };

  const layers: any[] = [
    { id: 'primary-raster-layer', type: 'raster' as const, source: 'primary-raster' },
  ];

  // 天地图主源时叠加注记层（中文标注）；高德自带中文标注无需额外叠加
  if (useTdtLabels) {
    sources['tianditu-cva'] = {
      type: 'raster' as const,
      tiles: getTianDiTuTiles('cva_w'),
      tileSize: tdtLabelSize,
      minzoom: 1,
      maxzoom: 18,
    };
    layers.push({
      id: 'tianditu-cva-layer',
      type: 'raster' as const,
      source: 'tianditu-cva',
    });
  }

  return {
    version: 8 as const,
    name: isGaode ? 'gaode' : 'tianditu',
    sources,
    layers,
  };
};

