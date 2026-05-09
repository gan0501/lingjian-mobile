import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  // 主页
  Home: undefined;
  Login: undefined;
  AgentOffice: undefined;
  AgentWorkbench: {
    agentId: string;
    agentName: string;
    agentType: string;
    agentIcon?: string;
    agentColor?: string;
  };
  ProjectFinderResult: { taskId: string };
  ProjectAnalysisReport: { reportId?: string; projectId: string; projectName?: string };

  // AI 工具
  AITools: undefined;
  BidWriter: { bidId?: string; step?: number } | undefined;
  BidHtmlPreview: { bidId: string } | undefined;
  PileComparison: { reportId?: string; bidId?: string; initialRoute?: string } | undefined;
  IDPhoto: undefined;
  Building3D: undefined;
  CADViewer: { sharedFile?: { name: string; uri: string } } | undefined;
  TokenPrice: undefined;
  BlueprintTo3D: undefined;
  BlueprintList: undefined;
  BlueprintCamera: { imageBase64?: string } | undefined;
  BlueprintLoading: { imageBase64: string; cropArea?: { x: number; y: number; width: number; height: number } } | undefined;
  BlueprintPreview: { componentParams: any; confidence?: string; qualityIssues?: string[] } | undefined;
  Paizhao: undefined;
  WatermarkCameraRN: undefined;
  // PileComparison 子屏幕
  ReportViewer: { reportId: string };

  // 找资源
  Resource: undefined;
  ResourceSearchResult: { query: string; category: string };
  NormReader: { normId: number };
  AtlasViewer: { atlasId: number };
  ResourceUpload: { uploadType: 'norm' | 'atlas' | 'material' };

  // 地图三页面
  ProjectMap: undefined;
  EnterpriseMap: undefined;
  ManufacturerMap: undefined;

  // 详情页（参数部分可选，便于从不同入口跳转）
  ProjectDetail: { projectId: string; projectName?: string; projectType?: number };
  ProjectFollow: { projectId: string; projectName?: string; projectType?: number; initialTab?: string };
  EnterpriseDetail: { enterpriseId: number; enterpriseType?: number; enterpriseName?: string };
  EnterpriseClaim: { enterpriseId: number; enterpriseName: string };
  EnterpriseVipApply: { enterpriseId: number; enterpriseName: string };
  EnterpriseEdit: { enterpriseId: number };
  EnterpriseAppeal: { enterpriseId: number; enterpriseName: string };
  ManufacturerDetail: { manufacturerId: number; manufacturerType?: number; manufacturerName?: string };
  ManufacturerClaim: { manufacturerId: number; manufacturerName: string };
  ManufacturerVipApply: { manufacturerId: number; manufacturerName: string };
  ManufacturerEdit: { manufacturerId: number };
  ManufacturerAppeal: { manufacturerId: number; manufacturerName: string };
  ManufacturerMapFullScreen: { lat: number; lon: number; name: string };

  // 会员 & 通用
  Membership: undefined;
  MembershipPay: undefined;
  MemberCenter: undefined;
  BillList: undefined;
  MessageCenter: undefined;
  Profile: undefined;
  Settings: undefined;
  HelpCenter: undefined;
  Feedback: undefined;
  Agreement: { type: 'user' | 'privacy' | 'membership' };

  // 企业 ERP
  EnterpriseERP: undefined;

  // 人事模块
  HRHall: undefined;
  HREmployeeRoster: undefined;
  HREmployeeDetail: { employeeId: string };
  HRAttendance: undefined;
  HRLeaveApproval: undefined;
  HRLeaveDetail: { leaveId: string };
  HRSalary: undefined;
  HRRecruit: undefined;
  OrgManage: undefined;
  DepartmentManage: undefined;
  RolePermission: undefined;
  StaffAssign: undefined;

  // 采购模块
  PurchaseSupplier: undefined;
  PurchaseOrder: undefined;

  // 生产模块
  ProductionLine: undefined;
  QualityInspection: undefined;

  // 销售模块
  SalesCustomer: undefined;
  SalesOrder: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
