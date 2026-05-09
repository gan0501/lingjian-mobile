/**
 * 协作功能 API 服务
 *
 * 管理项目协作者的邀请、查询、移除。
 */
import api from './api';

export interface InviteCollaboratorRequest {
  project_id: string;
  collaborator_contact: string;
  collaborator_contact_type: string;
}

export interface CollaboratorInfo {
  user_id: number | string;
  username: string;
  avatar?: string;
  role: 'creator' | 'collaborator';
  joined_at?: string;
}

export const collaborationApi = {
  /** 邀请协作者 */
  inviteCollaborator: (data: InviteCollaboratorRequest) =>
    api.post<any, { collaborator_name: string; project_name: string }>(
      '/api/projects/collaborate/invite',
      data,
    ),

  /** 获取项目协作者列表 */
  getCollaborators: (projectId: string) =>
    api.get<any, CollaboratorInfo[]>(`/api/user/projects/${projectId}/collaborators`),

  /** 移除协作者 */
  removeCollaborator: (projectId: string, collaboratorId: number) =>
    api.delete<any, any>(`/api/user/projects/${projectId}/collaborators/${collaboratorId}`),
};
