/**
 * 地图相关类型定义
 *
 * 统一三个地图页面（找项目/找建企/找厂家）的数据类型，
 * 避免各页面各自定义接口导致的不一致。
 */

/** 地图视窗边界 */
export interface MapBounds {
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
}

/** 地图标记点 */
export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  /** 业务类型编号（项目1-5, 建企1-4, 厂家1-4） */
  type: number;
  /** 原始数据 */
  data?: any;
  /** 是否为聚合球 */
  isCluster?: boolean;
  /** 聚合球内项目数量 */
  count?: number;
  /** 是否已跟进/收藏 */
  isFollowed?: boolean;
  /** 时间维度透明度（0.25 ~ 1.0） */
  opacity?: number;
}

/** 搜索结果条目（统计面板中的LOGO圈） */
export interface SearchResultItem {
  id: string;
  name: string;
  icon?: string;
  latitude?: number;
  longitude?: number;
  data?: any;
}

/** 统计面板插槽 */
export interface StatsSlot {
  label: string;
  value: number;
  isAccent?: boolean;
}

/** 筛选选项 */
export interface FilterOption {
  id: number;
  label: string;
  shortLabel?: string; // 简短标签，用于筛选组件图标下方文字
  icon: string;
  color?: string;
  count?: number;
}

/** 侧边抽屉列表项 */
export interface DrawerListItem {
  id: string;
  name: string;
  subText?: string;
  icon?: string;
  type?: number;
  data?: any;
}

/** 项目详情（底部卡片使用） */
export interface ProjectDetails {
  name: string;
  type: number;
  constructor: string;
  scale: string;
  address: string;
  publishTime: string;
  region?: string;
}

/** 建企/厂家详情（底部卡片使用） */
export interface EnterpriseDetails {
  name: string;
  type: number;
  typeName: string;
  registeredCapital: string;
  qualification: string;
  address: string;
}

/** 地图聚合数据 */
export interface ClusterData {
  id: string;
  lat: number;
  lng: number;
  count: number;
  type: number;
}

/** 地图数据模式 */
export type MapDataMode = 'cluster' | 'detail' | 'search';

/** 统一地图数据响应 */
export interface MapDataResponse {
  mode: MapDataMode;
  projects?: any[];
  clusters?: ClusterData[];
  searchResults?: any[];
  followedProjects?: any[];
  followedIdsWithCoords?: Set<string>;
  totals?: Record<string, number>;
  totalCount?: number;
}
