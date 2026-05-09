export type EnterpriseType = 1 | 2 | 3 | 4 | 5 | 6 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

export interface Enterprise {
  enterprise_id: number;
  enterprise_name: string;
  enterprise_type: number;
  credit_code?: string;
  legal_person?: string;
  register_address: string;
  register_capital: string;
  establish_date: string;
  enterprise_status: string;
  is_verified: string;
  qualification: string;
  qualification2?: string;
  logo_url?: string;
  contact_phone?: string;
  province?: string;
  city?: string;
  area?: string;
  contributors_in?: string;
  url?: string;
  lat: number;
  lon: number;
  claim_status?: number;
  claim_user_id?: number;
  claim_time?: string;
  description?: string;
  vr_url?: string;
  video_url?: string;
  brochure_url?: string;
  license_url?: string;
  membership_end_date?: string;
  vip_start_time?: string;
  is_vip?: boolean;
}

export interface EnterpriseAlbum {
  album_id: number;
  enterprise_id: number;
  image_url: string;
  image_title?: string;
  sort_order?: number;
}

export interface EnterpriseContact {
  contact_id: number;
  enterprise_id: number;
  contact_name: string;
  contact_phone: string;
  contact_position?: string;
  is_primary?: boolean;
  sort_order?: number;
}

export interface EnterpriseHonor {
  honor_id: number;
  enterprise_id: number;
  honor_title: string;
  honor_image?: string;
  honor_date?: string;
  sort_order?: number;
}

export interface EnterpriseNews {
  news_id: number;
  enterprise_id: number;
  news_title: string;
  news_content?: string;
  news_image?: string;
  news_date?: string;
  sort_order?: number;
}

export interface EnterpriseProduct {
  product_id: number;
  enterprise_id: number;
  product_name: string;
  product_desc?: string;
  product_image?: string;
  sort_order?: number;
}

export interface EnterpriseProject {
  project_id: number;
  enterprise_id: number;
  project_name: string;
  project_desc?: string;
  project_image?: string;
  project_date?: string;
  sort_order?: number;
}

export interface EnterpriseVipDetail extends Enterprise {
  album: EnterpriseAlbum[];
  contacts: EnterpriseContact[];
  honors: EnterpriseHonor[];
  news: EnterpriseNews[];
  products: EnterpriseProduct[];
  projects: EnterpriseProject[];
}

export interface Manufacturer extends Enterprise {
  distance: number | null;
}

export interface EnterpriseQuery {
  enterprise_type?: number;
  page?: number;
  page_size?: number;
  search?: string;
  qualification?: string;
  min_capital?: number;
  max_capital?: number;
}

export interface ManufacturerQuery {
  enterprise_type?: number;
  page?: number;
  page_size?: number;
  search?: string;
  user_lat?: number;
  user_lon?: number;
  min_distance?: number;
  max_distance?: number;
}

export const ManufacturerTypeName: Record<number, string> = {
  1: '材料厂家',
  2: '劳务班组',
  3: '机械设备',
  4: '商务服务',
  5: '智能化',
  6: '运维服务',
};

export const EnterpriseTypeName: Record<number, string> = {
  8: '施工单位',
  9: '设计单位',
  10: '勘察单位',
  11: '监理单位',
  12: '招标代理',
  13: '造价咨询',
  14: '审图单位',
  15: '检测单位',
  16: '其他企业',
};

export const AllEnterpriseTypeName: Record<number, string> = {
  ...ManufacturerTypeName,
  ...EnterpriseTypeName,
};
