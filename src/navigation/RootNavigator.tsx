import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '@/constants/colors';
import type { RootStackParamList } from './types';
import { GlobalAgentFloat } from '@/components/home';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

import HomeScreen from '@/screens/home/HomeScreen';
import { LoginScreen } from '@/screens/auth';
import { AIToolsScreen, IDPhotoScreen } from '@/screens/aitools';
import CADViewerScreen from '@/screens/aitools/cadviewer/CADViewerScreen';
import Building3DScreen from '@/screens/aitools/building3d/Building3DScreen';
import BidWriterContainer from '@/screens/aitools/bidwriter/BidWriterContainer';
import BidHtmlPreviewScreen from '@/screens/aitools/bidwriter/BidHtmlPreviewScreen';
import { PileComparisonContainer, MarpSlideViewerScreen } from '@/screens/aitools/pileComparison';
import BlueprintTo3DScreen from '@/screens/aitools/blueprint3d/BlueprintTo3DScreen';
import BlueprintListScreen from '@/screens/aitools/blueprint3d/ListScreen';
import BlueprintCameraScreen from '@/screens/aitools/blueprint3d/CameraScreen';
import BlueprintLoadingScreen from '@/screens/aitools/blueprint3d/LoadingScreen';
import BlueprintPreviewScreen from '@/screens/aitools/blueprint3d/PreviewScreen';
import PaizhaoContainer from '@/screens/aitools/paizhao/PaizhaoContainer';
import WatermarkCameraRNScreen from '@/screens/aitools/watermark/WatermarkCameraRNScreen';
import { ProjectMapScreen, EnterpriseMapScreen, ManufacturerMapScreen } from '@/screens/map';
import { ProjectDetailScreen, ProjectFollowScreen } from '@/screens/project';
import { EnterpriseDetailScreen, EnterpriseERPScreen, EnterpriseClaimScreen, EnterpriseVipApplyScreen, EnterpriseEditScreen, EnterpriseAppealScreen } from '@/screens/enterprise';
import { ManufacturerDetailScreen, ManufacturerClaimScreen, ManufacturerVipApplyScreen, ManufacturerEditScreen, ManufacturerAppealScreen, ManufacturerMapFullScreen } from '@/screens/manufacturer';
import { MembershipScreen, MembershipPayScreen, MemberCenterScreen, BillListScreen } from '@/screens/membership';
import { MessageCenterScreen, ProfileScreen, HelpCenterScreen, FeedbackScreen, AgreementScreen } from '@/screens/common';
import { ResourceScreen, ResourceSearchResultScreen, NormReaderScreen, AtlasViewerScreen, ResourceUploadScreen } from '@/screens/resource';
import { AgentOfficeScreen, AgentWorkbenchScreen, ProjectFinderResultScreen, ProjectAnalysisReportScreen } from '@/screens/agent';
import { HRHallScreen, HREmployeeRosterScreen, HREmployeeDetailScreen, HRAttendanceScreen, HRLeaveApprovalScreen, HRLeaveDetailScreen, HRSalaryScreen, HRRecruitScreen, OrgManageScreen, DepartmentManageScreen, RolePermissionScreen, StaffAssignScreen } from '@/screens/enterprise/hr';
import { PurchaseSupplierScreen, PurchaseOrderScreen } from '@/screens/enterprise/purchase';
import { ProductionLineScreen, QualityInspectionScreen } from '@/screens/enterprise/production';
import { SalesCustomerScreen, SalesOrderScreen } from '@/screens/enterprise/sales';

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  return (
    <View style={rootStyles.root}>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background.primary },
            animation: 'slide_from_right',
          }}
        >
          {/* 主页 */}
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />

          {/* 智能体 */}
          <Stack.Screen name="AgentOffice" component={AgentOfficeScreen} />
          <Stack.Screen name="AgentWorkbench" component={AgentWorkbenchScreen} />
          <Stack.Screen name="ProjectFinderResult" component={ProjectFinderResultScreen} />
          <Stack.Screen name="ProjectAnalysisReport" component={ProjectAnalysisReportScreen} />

          {/* AI 工具 */}
          <Stack.Screen name="AITools" component={AIToolsScreen} />
          <Stack.Screen name="IDPhoto" component={IDPhotoScreen} />
          <Stack.Screen name="CADViewer" component={CADViewerScreen} />
          <Stack.Screen name="Building3D" component={Building3DScreen} />
          <Stack.Screen name="BidWriter" component={BidWriterContainer} />
          <Stack.Screen name="BidHtmlPreview" component={BidHtmlPreviewScreen} />
          <Stack.Screen name="PileComparison" component={PileComparisonContainer} />
          <Stack.Screen name="ReportViewer" component={MarpSlideViewerScreen} />
          <Stack.Screen name="BlueprintTo3D" component={BlueprintTo3DScreen} />
          <Stack.Screen name="BlueprintList" component={BlueprintListScreen} />
          <Stack.Screen name="BlueprintCamera" component={BlueprintCameraScreen} />
          <Stack.Screen name="BlueprintLoading" component={BlueprintLoadingScreen} />
          <Stack.Screen name="BlueprintPreview" component={BlueprintPreviewScreen} />
          <Stack.Screen name="Paizhao" component={PaizhaoContainer} />
          <Stack.Screen name="WatermarkCameraRN" component={WatermarkCameraRNScreen} />

          {/* 找资源 */}
          <Stack.Screen name="Resource" component={ResourceScreen} />
          <Stack.Screen name="ResourceSearchResult" component={ResourceSearchResultScreen} />
          <Stack.Screen name="NormReader" component={NormReaderScreen} />
          <Stack.Screen name="AtlasViewer" component={AtlasViewerScreen} />
          <Stack.Screen name="ResourceUpload" component={ResourceUploadScreen} />

          {/* 地图三页面 */}
          <Stack.Screen name="ProjectMap" component={ProjectMapScreen} />
          <Stack.Screen name="EnterpriseMap" component={EnterpriseMapScreen} />
          <Stack.Screen name="ManufacturerMap" component={ManufacturerMapScreen} />

          {/* 详情页 */}
          <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
          <Stack.Screen name="ProjectFollow" component={ProjectFollowScreen} />
          <Stack.Screen name="EnterpriseDetail" component={EnterpriseDetailScreen} />
          <Stack.Screen name="EnterpriseClaim" component={EnterpriseClaimScreen} />
          <Stack.Screen name="EnterpriseVipApply" component={EnterpriseVipApplyScreen} />
          <Stack.Screen name="EnterpriseEdit" component={EnterpriseEditScreen} />
          <Stack.Screen name="EnterpriseAppeal" component={EnterpriseAppealScreen} />
          <Stack.Screen name="ManufacturerDetail" component={ManufacturerDetailScreen} />
          <Stack.Screen name="ManufacturerClaim" component={ManufacturerClaimScreen} />
          <Stack.Screen name="ManufacturerVipApply" component={ManufacturerVipApplyScreen} />
          <Stack.Screen name="ManufacturerEdit" component={ManufacturerEditScreen} />
          <Stack.Screen name="ManufacturerAppeal" component={ManufacturerAppealScreen} />
          <Stack.Screen name="ManufacturerMapFullScreen" component={ManufacturerMapFullScreen} />

          {/* 会员 & 通用 */}
          <Stack.Screen name="Membership" component={MembershipScreen} />
          <Stack.Screen name="MembershipPay" component={MembershipPayScreen} />
          <Stack.Screen name="MemberCenter" component={MemberCenterScreen} />
          <Stack.Screen name="BillList" component={BillListScreen} />
          <Stack.Screen name="MessageCenter" component={MessageCenterScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
          <Stack.Screen name="Feedback" component={FeedbackScreen} />
          <Stack.Screen name="Agreement" component={AgreementScreen} />

          {/* 企业 ERP 3D 管理 */}
          <Stack.Screen name="EnterpriseERP" component={EnterpriseERPScreen} />

          {/* 人事模块 */}
          <Stack.Screen name="HRHall" component={HRHallScreen} />
          <Stack.Screen name="HREmployeeRoster" component={HREmployeeRosterScreen} />
          <Stack.Screen name="HREmployeeDetail" component={HREmployeeDetailScreen} />
          <Stack.Screen name="HRAttendance" component={HRAttendanceScreen} />
          <Stack.Screen name="HRLeaveApproval" component={HRLeaveApprovalScreen} />
          <Stack.Screen name="HRLeaveDetail" component={HRLeaveDetailScreen} />
          <Stack.Screen name="HRSalary" component={HRSalaryScreen} />
          <Stack.Screen name="HRRecruit" component={HRRecruitScreen} />
          <Stack.Screen name="OrgManage" component={OrgManageScreen} />
          <Stack.Screen name="DepartmentManage" component={DepartmentManageScreen} />
          <Stack.Screen name="RolePermission" component={RolePermissionScreen} />
          <Stack.Screen name="StaffAssign" component={StaffAssignScreen} />

          {/* 采购模块 */}
          <Stack.Screen name="PurchaseSupplier" component={PurchaseSupplierScreen} />
          <Stack.Screen name="PurchaseOrder" component={PurchaseOrderScreen} />

          {/* 生产模块 */}
          <Stack.Screen name="ProductionLine" component={ProductionLineScreen} />
          <Stack.Screen name="QualityInspection" component={QualityInspectionScreen} />

          {/* 销售模块 */}
          <Stack.Screen name="SalesCustomer" component={SalesCustomerScreen} />
          <Stack.Screen name="SalesOrder" component={SalesOrderScreen} />
        </Stack.Navigator>

        {/* 跨页面浮窗 —— 悬浮在所有页面之上 */}
        <GlobalAgentFloat />
      </NavigationContainer>
    </View>
  );
};

const rootStyles = StyleSheet.create({
  root: { flex: 1 },
});

export default RootNavigator;
