import { useQuery } from '@tanstack/react-query';
import { enterpriseApi, manufacturerApi } from '@/services';

const STALE_TIME = 10 * 1000;

export const useEnterpriseClusters = (params: {
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
  zoom: number;
  enterprise_types?: string;
}) => {
  return useQuery({
    queryKey: ['enterpriseClusters', params],
    queryFn: () => enterpriseApi.getClusters(params),
    staleTime: STALE_TIME,
    enabled: params.zoom > 0,
  });
};

export const useEnterpriseDetail = (id: number, enterpriseType?: number) => {
  return useQuery({
    queryKey: ['enterprise', id, enterpriseType],
    queryFn: () => enterpriseApi.getDetail(id, enterpriseType),
    enabled: !!id,
  });
};

export const useManufacturerDetail = (id: string | number, manufacturerType?: number) => {
  return useQuery({
    queryKey: ['manufacturer', id, manufacturerType],
    queryFn: () => manufacturerApi.getDetail(Number(id), manufacturerType),
    enabled: !!id,
    staleTime: STALE_TIME,
  });
};

export const useManufacturerVipDetail = (id: string | number, isVip: boolean) => {
  return useQuery({
    queryKey: ['manufacturerVip', id],
    queryFn: async () => {
      const res = await manufacturerApi.getDetail(Number(id));
      return res?.data?.result || res?.result || res?.data || res;
    },
    enabled: !!id && isVip,
    staleTime: STALE_TIME,
  });
};

export const useEnterpriseVipDetail = (id: string | number, isVip: boolean, enterpriseType?: number) => {
  return useQuery({
    queryKey: ['enterpriseVip', id, enterpriseType],
    queryFn: async () => {
      const res = await enterpriseApi.getDetail(Number(id), enterpriseType);
      return res?.data?.result || res?.result || res?.data || res;
    },
    enabled: !!id && isVip,
    staleTime: STALE_TIME,
  });
};
