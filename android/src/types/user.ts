export interface User {
  id: number;
  phone?: string;
  nickname?: string;
  avatar?: string;
  email?: string;
  created_at?: string;
  age?: string;
  profession?: string;
  province?: string;
  city?: string;
  company?: string;
}

export interface UserInfo extends User {
  name: string;
  role: UserRole;
}

export interface UserRole {
  id: string;
  name: string;
  permissions: Permission[];
}

export interface Permission {
  permissionId: string;
  permissionName: string;
  actionEntitySet: { action: string }[];
  actionList: string[];
}

export interface UserProfileUpdate {
  nickname?: string;
  avatar?: string;
  email?: string;
  phone?: string;
  age?: string;
  profession?: string;
  province?: string;
  city?: string;
  company?: string;
}

export interface LoginResponse {
  token: string;
  refresh_token?: string;
  expires_at?: number;
  user: User;
}

export interface SendCodeRequest {
  phone_number: string;
}

export interface PhoneLoginRequest {
  phone_number: string;
  verification_code: string;
}

export type MembershipType = 'free' | 'monthly' | 'yearly';

export interface MembershipInfo {
  type: MembershipType;
  expires_at?: string;
  features: string[];
}
