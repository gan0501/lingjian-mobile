import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '@/services';
import { useProjectStore } from '@/stores';

const STALE_TIME = 10 * 1000;

export const useProjects = (type: 'planning' | 'land' | 'bidding' | 'procurement', params?: { page?: number; page_size?: number }) => {
  const queryFn = {
    planning: () => projectApi.getPlanning(params),
    land: () => projectApi.getLand(params),
    bidding: () => projectApi.getBidding(params),
    procurement: () => projectApi.getProcurement(params),
  }[type];

  return useQuery({
    queryKey: ['projects', type, params],
    queryFn,
    staleTime: STALE_TIME,
  });
};

export const useProjectClusters = (params: {
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
  zoom: number;
  search?: string;
  project_types?: string;
}) => {
  return useQuery({
    queryKey: ['projectClusters', params],
    queryFn: () => projectApi.getClusters(params),
    staleTime: STALE_TIME,
    enabled: params.zoom > 0,
  });
};

export const useFollowedProjects = () => {
  return useQuery({
    queryKey: ['followedProjects'],
    queryFn: () => projectApi.getFollowed(),
    staleTime: STALE_TIME,
  });
};

export const useFollowProject = () => {
  const queryClient = useQueryClient();
  const { addFollowedProject } = useProjectStore.getState();

  return useMutation({
    mutationFn: (data: { project_id: string; project_type: number; project_name: string }) =>
      projectApi.follow(data),
    onSuccess: (_, variables) => {
      addFollowedProject({ id: variables.project_id, name: variables.project_name, type: variables.project_type, latitude: 0, longitude: 0 });
      queryClient.invalidateQueries({ queryKey: ['followedProjects'] });
    },
  });
};

export const useUnfollowProject = () => {
  const queryClient = useQueryClient();
  const { removeFollowedProject } = useProjectStore.getState();

  return useMutation({
    mutationFn: (projectId: string) => projectApi.unfollow(projectId),
    onSuccess: (_, projectId) => {
      removeFollowedProject(projectId);
      queryClient.invalidateQueries({ queryKey: ['followedProjects'] });
    },
  });
};
