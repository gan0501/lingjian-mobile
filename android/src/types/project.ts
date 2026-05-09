export type ProjectType = 'planning' | 'land' | 'bidding' | 'procurement';
export type ProjectCategory = 'system' | 'followed' | 'collaborated';
export type ProjectStatus = '进行中' | '已完成' | '已暂停' | '已流失';

export interface BaseProject {
  id: string;
  project_name: string;
  region_name: string;
  project_address?: string;
  publish_time: string;
  lat: number;
  lng: number;
}

export interface PlanningProject extends BaseProject {
  users_project_id: string | null;
  project_category: ProjectCategory;
  area_desc: string;
  project_number: string;
  building_company_name: string;
  type: number;
}

export interface LandProject extends BaseProject {
  land_name: string;
  land_area: string;
  land_use: string;
  auction_date: string;
  starting_price: string;
  transaction_price?: string;
}

export interface BiddingProject extends BaseProject {
  tender_type: string;
  deadline: string;
  budget: string;
  purchaser: string;
}

export interface ProcurementProject extends BaseProject {
  title: string;
  procurement_type: string;
  deadline: string;
  budget: string;
  purchaser: string;
}

export interface UserProject {
  id: string;
  user_id: number;
  section: string;
  project_name: string;
  project_description?: string;
  status: ProjectStatus;
  external_project_id?: string;
  project_id?: string;
  project_type?: string;
  project_category?: string;
  type?: number;
  lat?: number | string | null;
  lng?: number | string | null;
  follow_status?: string;
  created_at: string;
  updated_at: string;
  related_entities_data?: {
    lat?: number;
    lng?: number;
    constructor?: string;
    contact?: string;
    area?: string;
    custom_type?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface UserProjectCreate {
  section: string;
  project_name: string;
  project_description?: string;
  status?: ProjectStatus;
  external_project_id?: string;
}

export interface UserProjectUpdate {
  project_name?: string;
  project_description?: string;
  status?: ProjectStatus;
}
