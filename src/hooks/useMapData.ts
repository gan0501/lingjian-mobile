/**
 * 统一地图数据管理 Hooks
 *
 * 三个地图页面共用的数据获取逻辑：
 *   - useProjectMapData: 找项目（聚合/详细/搜索三模式）
 *   - useEnterpriseMapData: 找建企（散点模式）
 *   - useManufacturerMapData: 找厂家（散点模式）
 *   - useProjectTotals: 项目全局总数（缓存 24h）
 *   - useEnterpriseTotals: 建企全局总数（缓存 24h）
 *   - useManufacturerTotals: 厂家全局总数（缓存 24h）
 */
import { useQuery } from '@tanstack/react-query';
import { CACHE_CONFIG, getEnterpriseDbTypes, getManufacturerDbTypes } from '@/constants';
import { projectApi, enterpriseApi, manufacturerApi } from '@/services';
import type { MapBounds } from '@/types';

// ─── 工具函数 ───

/** 坐标取整（减少 query churn） */
const roundCoord = (v: number) => Math.round(v * 10000) / 10000;
const roundBounds = (b: MapBounds): MapBounds => ({
  min_lat: roundCoord(b.min_lat),
  max_lat: roundCoord(b.max_lat),
  min_lon: roundCoord(b.min_lon),
  max_lon: roundCoord(b.max_lon),
});
/** 缩放等级取整到 0.5 */
const normalizeZoom = (z: number) => Math.round(z * 2) / 2;

// ─── 项目地图 Hook ───

interface ProjectBrowseParams {
  bounds: MapBounds;
  zoom: number;
  projectTypes?: number[];
}
interface ProjectSearchParams {
  keyword: string;
  projectTypes?: number[];
}
type ProjectMapParams = ProjectBrowseParams | ProjectSearchParams;

const isProjectSearch = (p: ProjectMapParams): p is ProjectSearchParams =>
  'keyword' in p && p.keyword.length > 0;

const buildProjectKey = (params: ProjectMapParams): string => {
  const types = (params.projectTypes || [1, 2, 3, 4, 5]).slice().sort().join(',');
  if (isProjectSearch(params)) {
    return `search:${params.keyword}:${types}`;
  }
  const b = roundBounds(params.bounds);
  return `browse:${normalizeZoom(params.zoom)}:${b.min_lat},${b.max_lat},${b.min_lon},${b.max_lon}:${types}`;
};

export const useProjectMapData = (params: ProjectMapParams) => {
  const stableKey = buildProjectKey(params);

  return useQuery<any, Error>({
    queryKey: ['projectMapV2', stableKey],
    queryFn: async ({ signal }) => {
      if (isProjectSearch(params)) {
        const result = await projectApi.getProjectClusters({
          min_lat: -90, max_lat: 90, min_lon: -180, max_lon: 180,
          zoom: 10,
          search: params.keyword,
          project_types: (params.projectTypes || [1, 2, 3, 4, 5]).join(','),
        }, signal);

        return {
          mode: 'search' as const,
          projects: result.projects || [],
          searchResults: result.projects || [],
          totals: result.totals,
          totalCount: result.total_count,
        };
      }

      const { bounds, zoom, projectTypes } = params as ProjectBrowseParams;
      const rounded = roundBounds(bounds);
      const result = await projectApi.getProjectClusters({
        min_lat: rounded.min_lat,
        max_lat: rounded.max_lat,
        min_lon: rounded.min_lon,
        max_lon: rounded.max_lon,
        zoom: normalizeZoom(zoom),
        search: '',
        project_types: (projectTypes || [1, 2, 3, 4, 5]).join(','),
      }, signal);

      if (result.mode === 'cluster') {
        return {
          mode: 'cluster' as const,
          clusters: (result.clusters || []).map((c: any) => ({
            id: String(c.id),
            lat: c.lat,
            lng: c.lng,
            count: c.count,
            type: c.type,
          })),
          totals: result.totals,
          totalCount: result.total_count,
        };
      }

      return {
        mode: 'detail' as const,
        projects: result.projects || [],
        totals: result.totals,
        totalCount: result.total_count,
      };
    },
    placeholderData: (prev: any) => prev,
    staleTime: CACHE_CONFIG.STALE_TIME,
    gcTime: CACHE_CONFIG.GC_TIME,
  });
};

// ─── 建企地图 Hook ───

interface EnterpriseMapParams {
  bounds: MapBounds;
  zoom: number;
  search?: string;
  enterpriseTypes?: number[];
}

export const useEnterpriseMapData = (params: EnterpriseMapParams) => {
  const { bounds, zoom, search, enterpriseTypes } = params;
  const isSearch = !!search?.trim();
  const enabled = isSearch || !!bounds;

  const dbTypeList = getEnterpriseDbTypes(enterpriseTypes || [1, 2, 3, 4]);

  return useQuery<any, Error>({
    queryKey: ['enterpriseMap', { bounds, zoom, search, enterpriseTypes }],
    enabled,
    queryFn: async () => {
      const p: any = {
        min_lat: bounds?.min_lat ?? -90,
        max_lat: bounds?.max_lat ?? 90,
        min_lon: bounds?.min_lon ?? -180,
        max_lon: bounds?.max_lon ?? 180,
        zoom,
      };
      if (search?.trim()) p.search = search.trim();
      if (dbTypeList.length > 0) p.enterprise_types = dbTypeList.join(',');

      const resp = await enterpriseApi.getMapClusters(p);
      const result = resp?.result || resp;
      const details = result?.details || [];
      const totals = result?.totals || { total: 0 };

      return { enterprises: details, total: totals.total, totals };
    },
    placeholderData: (prev: any) => prev,
    staleTime: CACHE_CONFIG.STALE_TIME,
    gcTime: CACHE_CONFIG.GC_TIME,
  });
};

// ─── 厂家地图 Hook ───

interface ManufacturerMapParams {
  bounds: MapBounds;
  zoom: number;
  search?: string;
  enterpriseTypes?: number[];
}

export const useManufacturerMapData = (params: ManufacturerMapParams) => {
  const { bounds, zoom, search, enterpriseTypes } = params;
  const isSearch = !!search?.trim();
  const enabled = isSearch || !!bounds;

  const dbTypeList = getManufacturerDbTypes(enterpriseTypes || [1, 2, 3, 4]);

  return useQuery<any, Error>({
    queryKey: ['manufacturerMap', { bounds, zoom, search, enterpriseTypes }],
    enabled,
    queryFn: async () => {
      const p: any = {
        min_lat: bounds?.min_lat ?? -90,
        max_lat: bounds?.max_lat ?? 90,
        min_lon: bounds?.min_lon ?? -180,
        max_lon: bounds?.max_lon ?? 180,
        zoom,
      };
      if (search?.trim()) p.search = search.trim();
      if (dbTypeList.length > 0) p.enterprise_types = dbTypeList.join(',');

      const resp = await manufacturerApi.getMapClusters(p);
      const result = resp?.result || resp;
      const details = result?.details || [];
      const totals = result?.totals || { total: 0 };

      return { manufacturers: details, total: totals.total, totals };
    },
    placeholderData: (prev: any) => prev,
    staleTime: CACHE_CONFIG.STALE_TIME,
    gcTime: CACHE_CONFIG.GC_TIME,
  });
};

// ─── 全局总数 Hooks（缓存 24h） ───

const TOTALS_STALE_TIME = 24 * 60 * 60 * 1000;
const TOTALS_GC_TIME = 48 * 60 * 60 * 1000;

export const useProjectTotals = (projectTypes?: number[]) => {
  const typesKey = (projectTypes || [1, 2, 3, 4, 5]).sort().join(',');
  return useQuery<{ totals: any; totalCount: number }, Error>({
    queryKey: ['projectTotals', typesKey],
    queryFn: async ({ signal }) => {
      const result = await projectApi.getProjectClusters({
        min_lat: -90, max_lat: 90, min_lon: -180, max_lon: 180,
        zoom: 10, search: '', project_types: typesKey,
      }, signal);
      return { totals: result?.totals, totalCount: result?.total_count };
    },
    staleTime: TOTALS_STALE_TIME,
    gcTime: TOTALS_GC_TIME,
    refetchOnWindowFocus: false,
  });
};

export const useEnterpriseTotals = () => {
  return useQuery<{ total: number }, Error>({
    queryKey: ['enterpriseTotals'],
    queryFn: async () => {
      const resp = await enterpriseApi.getMapClusters({
        min_lat: -90, max_lat: 90, min_lon: -180, max_lon: 180, zoom: 10,
      });
      const result = resp?.result || resp;
      return { total: result?.totals?.total || 0 };
    },
    staleTime: TOTALS_STALE_TIME,
    gcTime: TOTALS_GC_TIME,
    refetchOnWindowFocus: false,
  });
};

export const useManufacturerTotals = () => {
  return useQuery<{ total: number }, Error>({
    queryKey: ['manufacturerTotals'],
    queryFn: async () => {
      const resp = await manufacturerApi.getMapClusters({
        min_lat: -90, max_lat: 90, min_lon: -180, max_lon: 180, zoom: 10,
      });
      const result = resp?.result || resp;
      return { total: result?.totals?.total || 0 };
    },
    staleTime: TOTALS_STALE_TIME,
    gcTime: TOTALS_GC_TIME,
    refetchOnWindowFocus: false,
  });
};

// ─── 防抖 Hook ───

import { useState, useEffect } from 'react';

export const useDebounce = <T,>(value: T, delay: number): T => {
  const [dv, setDv] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
};

export type { ProjectMapParams, EnterpriseMapParams, ManufacturerMapParams, MapBounds };
