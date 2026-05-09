export interface ApiResponse<T> {
  code: number;
  message: string;
  result: T | null;
}

export interface PaginatedResult<T> {
  list: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface PaginatedQuery {
  page?: number;
  page_size?: number;
  search?: string;
}

export type AgentType = 'chat' | 'note' | 'followup' | 'summary';

export interface ChatRequest {
  message: string;
  user_id: number;
  project_id?: string;
  agent_type?: AgentType;
  menu_name?: string;
  section_name?: string;
}

export interface ChatResponse {
  response: string;
  user_id: number;
  agent_type: string;
}

export interface NoteRequest {
  note: string;
  user_id: number;
  project_id: string;
  menu_name?: string;
  section_name?: string;
}

export interface FollowUpRequest {
  user_id: number;
  project_id: string;
  context?: string;
  menu_name?: string;
  section_name?: string;
}

export interface SummaryRequest {
  user_id: number;
  project_id: string;
  force_update?: boolean;
  menu_name?: string;
  section_name?: string;
}
