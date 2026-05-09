import React, { FC, useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Image,
  Alert,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMessageStore } from '@/stores/useMessageStore';
import { useAgentWindowStore } from '@/stores';
import { useMembershipStore, MEMBER_NAMES } from '@/stores/useMembershipStore';
import { EmbeddedAgentWindow, LanyardBadge } from '@/components/home';
import { Icon, UserSidebar, MessageSidebar } from '@/components/common';
import { Spacing } from '@/constants/spacing';
import { FontSize, FontWeight } from '@/constants/typography';
import { API_CONFIG } from '@/constants/config';
import { authenticatedFetch } from '@/services/authenticatedFetch';
import { showSystemAlert } from '@/components/common/CustomAlert';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

interface AIToolItem {
  id: string;
  title: string;
  icon: string;
  bgColor: string;
  iconColor: string;
  screen: keyof RootStackParamList;
  isMemberOnly: boolean;
}

const AI_TOOLS: AIToolItem[] = [
  { id: 'pile_comparison', title: '桩基比选', icon: 'barChart', bgColor: '#F5F5F5', iconColor: '#22C55E', screen: 'PileComparison', isMemberOnly: true },
  { id: 'bid_writer', title: '指尖标书', icon: 'fileText', bgColor: '#F5F5F5', iconColor: '#3B82F6', screen: 'BidWriter', isMemberOnly: true },
  { id: 'building_3d', title: '3D建筑', icon: 'box', bgColor: '#F5F5F5', iconColor: '#60A5FA', screen: 'Building3D', isMemberOnly: true },
  { id: 'cad_viewer', title: 'CAD看图', icon: 'image', bgColor: '#F5F5F5', iconColor: '#F59E0B', screen: 'CADViewer', isMemberOnly: true },
  { id: 'watermark_camera', title: '水印相机', icon: 'droplets', bgColor: '#F5F5F5', iconColor: '#06B6D4', screen: 'WatermarkCameraRN', isMemberOnly: false },
  // { id: 'blueprint_to_3d', title: '图纸转3D', icon: 'cube', bgColor: '#F5F5F5', iconColor: '#E67E22', screen: 'BlueprintList', isMemberOnly: false },
  // { id: 'paizhao_count', title: '拍照计数', icon: 'scan', bgColor: '#F5F5F5', iconColor: '#10B981', screen: 'Paizhao', isMemberOnly: false },
  { id: 'id_photo', title: '证件照', icon: 'camera', bgColor: '#F5F5F5', iconColor: '#A78BFA', screen: 'IDPhoto', isMemberOnly: true },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = Spacing.screenPadding;

type HomeStats = {
  project: { count: number; unit: string };
  enterprise: { count: number; unit: string };
  manufacturer: { count: number; unit: string };
  resource: { count: number; unit: string };
} | null;

const getPersonalCards = (stats: HomeStats) => [
  { id: 'project', countNum: stats?.project?.count?.toString() ?? '0', countUnit: stats?.project?.unit ?? '万', title: '找项目', sub: 'Maps', route: 'ProjectMap', icon: 'map-pin', color: '#DC2626', bgColor: '#FEF2F2', gradientColors: ['#FFFAFA', '#FEF2F2'], iconImage: require('@/assets/images/project.png') },
  { id: 'enterprise', countNum: stats?.enterprise?.count?.toString() ?? '0', countUnit: stats?.enterprise?.unit ?? '万', title: '找建企', sub: 'Enterprise', route: 'EnterpriseMap', icon: 'home', color: '#1D4ED8', bgColor: '#DBEAFE', gradientColors: ['#EFF6FF', '#E0EFFF'], iconImage: require('@/assets/images/enterprise.png') },
  { id: 'manufacturer', countNum: stats?.manufacturer?.count?.toString() ?? '0', countUnit: stats?.manufacturer?.unit ?? '万', title: '找厂家', sub: 'Factory', route: 'ManufacturerMap', icon: 'truck', color: '#D97706', bgColor: '#FFFBEB', gradientColors: ['#FFFDF5', '#FEF9E3'], iconImage: require('@/assets/images/factory.png') },
  { id: 'resource', countNum: stats?.resource?.count?.toString() ?? '0', countUnit: stats?.resource?.unit ?? '份', title: '找资源', sub: 'Resource', route: 'Resource', icon: 'layers', color: '#7C3AED', bgColor: '#FAF5FF', gradientColors: ['#FDFCFF', '#FAF5FF'], iconImage: require('@/assets/images/books.png') },
];

// 人事部门一级入口
const HR_PRIMARY_ENTRIES = [
  { id: 'attendance', title: '考勤管理', icon: 'clock', bgColor: '#EFF6FF', iconColor: '#3B82F6' },
  { id: 'salary', title: '薪资管理', icon: 'wallet', bgColor: '#F0FDF4', iconColor: '#22C55E' },
  { id: 'admin', title: '行政管理', icon: 'briefcase', bgColor: '#FFFBEB', iconColor: '#F59E0B' },
  { id: 'employee', title: '人员管理', icon: 'users', bgColor: '#FAF5FF', iconColor: '#A78BFA' },
  { id: 'org', title: '组织管理', icon: 'git-branch', bgColor: '#FEF2F2', iconColor: '#EF4444' },
  { id: 'recruit', title: '招聘管理', icon: 'user-plus', bgColor: '#F0F9FF', iconColor: '#0EA5E9' },
  { id: 'userbook', title: '用户之书', icon: 'book-open', bgColor: '#FDF4FF', iconColor: '#D946EF' },
];

// 人事部门二级入口 - 根据一级菜单分类
const HR_SECONDARY_CARDS: Record<string, any[]> = {
  attendance: [
    { id: 'attendance_record', title: '考勤记录', desc: '每日打卡、出勤明细', icon: 'calendar', color: '#3B82F6', route: 'HRAttendance' },
    { id: 'attendance_stat', title: '考勤统计', desc: '出勤率、迟到早退', icon: 'bar-chart-2', color: '#22C55E', route: 'HRAttendance' },
    { id: 'leave_approval', title: '请假管理', desc: '申请、审批、余额', icon: 'check-circle', color: '#F59E0B', route: 'HRLeaveApproval' },
    { id: 'attendance_approval', title: '考勤审批', desc: '考勤申请、修正', icon: 'file-text', color: '#8B5CF6', route: 'HRAttendance' },
    { id: 'checkin', title: '打卡管理', desc: '签到签退、位置', icon: 'clock', color: '#0EA5E9', route: 'HRAttendance' },
  ],
  salary: [
    { id: 'salary_structure', title: '薪资结构', desc: '设定薪资组成、公式', icon: 'sliders', color: '#3B82F6', route: 'HRSalary' },
    { id: 'salary_slip', title: '工资单', desc: '计算、发放、查询', icon: 'file-text', color: '#22C55E', route: 'HRSalary' },
    { id: 'salary_approval', title: '薪资审批', desc: '批量提交、审批', icon: 'check-circle', color: '#F59E0B', route: 'HRSalary' },
    { id: 'performance', title: '绩效管理', desc: 'KRA评分、评估周期', icon: 'award', color: '#8B5CF6', route: 'HRSalary' },
    { id: 'salary_report', title: '薪资报表', desc: '薪资汇总、趋势', icon: 'bar-chart-2', color: '#0EA5E9', route: 'HRSalary' },
  ],
  admin: [
    { id: 'notice', title: '发布通知', desc: '部门通知、企业通知', icon: 'bell', color: '#3B82F6', route: 'HRAttendance' },
    { id: 'archive', title: '企业档案', desc: '文件汇总、归档', icon: 'folder', color: '#22C55E', route: 'HRAttendance' },
    { id: 'meeting', title: '会议管理', desc: '会议记录、会议通知', icon: 'users', color: '#F59E0B', route: 'HRAttendance' },
  ],
  employee: [
    { id: 'employee_list', title: '员工花名册', desc: '员工档案、部门分布', icon: 'users', color: '#3B82F6', route: 'HREmployeeRoster' },
    { id: 'onboarding', title: '入职管理', desc: '入职流程、任务清单', icon: 'user-plus', color: '#22C55E', route: 'HREmployeeRoster' },
    { id: 'separation', title: '离职管理', desc: '离职流程、交接', icon: 'user-minus', color: '#F59E0B', route: 'HREmployeeRoster' },
    { id: 'transfer', title: '转岗管理', desc: '调岗、晋升', icon: 'repeat', color: '#8B5CF6', route: 'HREmployeeRoster' },
    { id: 'expense_claim', title: '费用报销', desc: '申请、审批、支付', icon: 'wallet', color: '#0EA5E9', route: 'HREmployeeRoster' },
    { id: 'talent_pool', title: '人才库', desc: '离职/未入职/储备', icon: 'database', color: '#D946EF', route: 'HREmployeeRoster' },
  ],
  org: [
    { id: 'department', title: '部门管理', desc: '创建、编辑、删除部门', icon: 'folder', color: '#3B82F6', route: 'DepartmentManage' },
    { id: 'role', title: '角色权限', desc: '设置权限级别与角色', icon: 'shield', color: '#22C55E', route: 'RolePermission' },
    { id: 'staff', title: '人员分配', desc: '分配人员到部门与角色', icon: 'user-plus', color: '#F59E0B', route: 'StaffAssign' },
  ],
  recruit: [
    { id: 'job_request', title: '需求审批', desc: '招聘需求、审批', icon: 'file-text', color: '#3B82F6', route: 'HRRecruit' },
    { id: 'job_opening', title: '职位空缺', desc: '职位发布、管理', icon: 'briefcase', color: '#22C55E', route: 'HRRecruit' },
    { id: 'job_applicant', title: '求职者', desc: '简历筛选、状态', icon: 'users', color: '#F59E0B', route: 'HRRecruit' },
    { id: 'interview', title: '面试管理', desc: '安排、记录、评价', icon: 'message', color: '#8B5CF6', route: 'HRRecruit' },
    { id: 'job_offer', title: '录用通知', desc: '发offer、确认', icon: 'mail', color: '#0EA5E9', route: 'HRRecruit' },
    { id: 'recruit_report', title: '招聘报表', desc: '招聘进度、统计', icon: 'bar-chart-2', color: '#D946EF', route: 'HRRecruit' },
  ],
  userbook: [
    { id: 'my_profile', title: '我的档案', desc: '个人信息、工作经历', icon: 'user', color: '#3B82F6', route: 'HREmployeeRoster' },
    { id: 'chat_history', title: '对话记录', desc: 'AI对话历史', icon: 'message-circle', color: '#22C55E', route: 'HREmployeeRoster' },
    { id: 'knowledge', title: '知识库', desc: '个人知识沉淀', icon: 'book', color: '#F59E0B', route: 'HREmployeeRoster' },
  ],
};

// 采购中心一级入口
const PURCHASE_PRIMARY_ENTRIES = [
  { id: 'supplier', title: '供应商管理', icon: 'truck', bgColor: '#EFF6FF', iconColor: '#3B82F6' },
  { id: 'purchase_order', title: '采购订单', icon: 'file-text', bgColor: '#F0FDF4', iconColor: '#22C55E' },
  { id: 'material', title: '物料管理', icon: 'package', bgColor: '#FFFBEB', iconColor: '#F59E0B' },
  { id: 'contract', title: '合同管理', icon: 'file', bgColor: '#FAF5FF', iconColor: '#A78BFA' },
];

// 采购中心二级入口
const PURCHASE_SECONDARY_CARDS: Record<string, any[]> = {
  supplier: [
    { id: 'supplier_list', title: '供应商列表', desc: '合作供应商档案', icon: 'list', color: '#3B82F6', route: 'PurchaseSupplier' },
    { id: 'supplier_eval', title: '供应商评估', desc: '评分、等级管理', icon: 'star', color: '#22C55E', route: 'PurchaseSupplier' },
    { id: 'supplier_add', title: '新增供应商', desc: '录入供应商信息', icon: 'plus-circle', color: '#F59E0B', route: 'PurchaseSupplier' },
  ],
  purchase_order: [
    { id: 'order_list', title: '订单列表', desc: '采购订单查询', icon: 'list', color: '#3B82F6', route: 'PurchaseOrder' },
    { id: 'order_create', title: '新建订单', desc: '创建采购订单', icon: 'plus-circle', color: '#22C55E', route: 'PurchaseOrder' },
    { id: 'order_pending', title: '待审批', desc: '等待审批的订单', icon: 'clock', color: '#F59E0B', route: 'PurchaseOrder' },
  ],
  material: [
    { id: 'material_list', title: '物料清单', desc: '物料基础信息', icon: 'list', color: '#3B82F6', route: 'PurchaseSupplier' },
    { id: 'material_stock', title: '库存查询', desc: '实时库存状态', icon: 'database', color: '#22C55E', route: 'PurchaseSupplier' },
  ],
  contract: [
    { id: 'contract_list', title: '合同列表', desc: '采购合同管理', icon: 'file', color: '#3B82F6', route: 'PurchaseOrder' },
    { id: 'contract_sign', title: '待签署', desc: '等待签署合同', icon: 'edit', color: '#22C55E', route: 'PurchaseOrder' },
  ],
};

// 生产中心一级入口
const PRODUCTION_PRIMARY_ENTRIES = [
  { id: 'production_line', title: '生产线管理', icon: 'activity', bgColor: '#EFF6FF', iconColor: '#3B82F6' },
  { id: 'quality', title: '质量检验', icon: 'check-square', bgColor: '#F0FDF4', iconColor: '#22C55E' },
  { id: 'equipment', title: '设备管理', icon: 'tool', bgColor: '#FFFBEB', iconColor: '#F59E0B' },
  { id: 'warehouse', title: '仓库管理', icon: 'archive', bgColor: '#FAF5FF', iconColor: '#A78BFA' },
];

// 生产中心二级入口
const PRODUCTION_SECONDARY_CARDS: Record<string, any[]> = {
  production_line: [
    { id: 'line_status', title: '生产线状态', desc: '运行、停止、维护', icon: 'activity', color: '#3B82F6', route: 'ProductionLine' },
    { id: 'production_plan', title: '生产计划', desc: '排产、调度', icon: 'calendar', color: '#22C55E', route: 'ProductionLine' },
    { id: 'production_output', title: '产量统计', desc: '日/周/月产量', icon: 'bar-chart-2', color: '#F59E0B', route: 'ProductionLine' },
  ],
  quality: [
    { id: 'quality_inspect', title: '质量检验', desc: '检验批次、结果', icon: 'check-circle', color: '#3B82F6', route: 'QualityInspection' },
    { id: 'quality_report', title: '质量报告', desc: '合格率、问题分析', icon: 'file-text', color: '#22C55E', route: 'QualityInspection' },
    { id: 'quality_issue', title: '问题跟踪', desc: '质量问题处理', icon: 'alert-circle', color: '#F59E0B', route: 'QualityInspection' },
  ],
  equipment: [
    { id: 'equipment_list', title: '设备台账', desc: '设备档案信息', icon: 'list', color: '#3B82F6', route: 'ProductionLine' },
    { id: 'maintenance', title: '维护保养', desc: '保养计划、记录', icon: 'tool', color: '#22C55E', route: 'ProductionLine' },
  ],
  warehouse: [
    { id: 'inventory', title: '库存管理', desc: '原材料、成品库存', icon: 'package', color: '#3B82F6', route: 'ProductionLine' },
    { id: 'inbound', title: '入库管理', desc: '入库登记', icon: 'log-in', color: '#22C55E', route: 'ProductionLine' },
    { id: 'outbound', title: '出库管理', desc: '出库登记', icon: 'log-out', color: '#F59E0B', route: 'ProductionLine' },
  ],
};

// 销售中心一级入口
const SALES_PRIMARY_ENTRIES = [
  { id: 'customer', title: '客户管理', icon: 'users', bgColor: '#EFF6FF', iconColor: '#3B82F6' },
  { id: 'sales_order', title: '销售订单', icon: 'shopping-cart', bgColor: '#F0FDF4', iconColor: '#22C55E' },
  { id: 'crm', title: 'CRM跟进', icon: 'target', bgColor: '#FFFBEB', iconColor: '#F59E0B' },
  { id: 'sales_report', title: '销售报表', icon: 'bar-chart', bgColor: '#FAF5FF', iconColor: '#A78BFA' },
];

// 销售中心二级入口
const SALES_SECONDARY_CARDS: Record<string, any[]> = {
  customer: [
    { id: 'customer_list', title: '客户列表', desc: '客户档案管理', icon: 'list', color: '#3B82F6', route: 'SalesCustomer' },
    { id: 'customer_level', title: '客户分级', desc: 'A/B/C级分类', icon: 'award', color: '#22C55E', route: 'SalesCustomer' },
    { id: 'customer_add', title: '新增客户', desc: '录入客户信息', icon: 'user-plus', color: '#F59E0B', route: 'SalesCustomer' },
  ],
  sales_order: [
    { id: 'order_list', title: '订单列表', desc: '销售订单查询', icon: 'list', color: '#3B82F6', route: 'SalesOrder' },
    { id: 'order_create', title: '新建订单', desc: '创建销售订单', icon: 'plus-circle', color: '#22C55E', route: 'SalesOrder' },
    { id: 'order_shipping', title: '发货管理', desc: '物流、发货', icon: 'truck', color: '#F59E0B', route: 'SalesOrder' },
  ],
  crm: [
    { id: 'follow_list', title: '跟进列表', desc: '客户跟进记录', icon: 'list', color: '#3B82F6', route: 'SalesCustomer' },
    { id: 'follow_task', title: '跟进任务', desc: '待跟进事项', icon: 'clock', color: '#22C55E', route: 'SalesCustomer' },
    { id: 'follow_map', title: '跟进地图', desc: '项目分布地图', icon: 'map', color: '#F59E0B', route: 'ProjectMap' },
  ],
  sales_report: [
    { id: 'sales_stat', title: '销售统计', desc: '销售额、订单量', icon: 'bar-chart-2', color: '#3B82F6', route: 'SalesOrder' },
    { id: 'rank', title: '业绩排行', desc: '销售员排名', icon: 'trending-up', color: '#22C55E', route: 'SalesOrder' },
  ],
};

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const HomeScreen: FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { isLoggedIn, logout, user, token } = useAuthStore();
  const { unreadCount, fetchMessages } = useMessageStore();
  const { membership, fetchMembership, isMember, getMemberName } = useMembershipStore();
  const [userSidebarVisible, setUserSidebarVisible] = useState(false);
  const [messageSidebarVisible, setMessageSidebarVisible] = useState(false);
  const [showLanyardBadge, setShowLanyardBadge] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [homeStats, setHomeStats] = useState<HomeStats>(null);

  useEffect(() => {
    if (isLoggedIn && token) {
      fetchMembership(token);
    }
  }, [isLoggedIn, token, fetchMembership]);

  const CURRENT_VERSION_CODE = 50;
  const VERSION_CHECK_CACHE_KEY = 'version_check_cache';
  const CACHE_DURATION = 24 * 60 * 60 * 1000;
  const [versionInfo, setVersionInfo] = useState<string>('5.0');
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string>('');

  useEffect(() => {
    const checkVersionWithCache = async () => {
      try {
        const cachedData = await AsyncStorage.getItem(VERSION_CHECK_CACHE_KEY);
        if (cachedData) {
          const { timestamp, hasUpdate, versionName } = JSON.parse(cachedData);
          // 检查缓存是否过期，或者版本号是否是旧版本（1.0开头）
          const isOldVersion = versionName && versionName.startsWith('1.0');
          if (Date.now() - timestamp < CACHE_DURATION && !isOldVersion) {
            setHasNewVersion(hasUpdate);
            if (versionName) setVersionInfo(versionName);
            return;
          }
          // 如果是旧版本缓存，清除缓存
          if (isOldVersion) {
            await AsyncStorage.removeItem(VERSION_CHECK_CACHE_KEY);
          }
        }

        const response = await fetch(`${API_CONFIG.BASE_URL}/api/app/version/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_version_code: CURRENT_VERSION_CODE }),
        });
        
        const data = await response.json();
        if (data?.code === 200 && data?.data) {
          const { has_update, latest_version } = data.data;
          setHasNewVersion(has_update);
          if (latest_version?.version_name) {
            setVersionInfo(latest_version.version_name);
          }
          if (latest_version?.download_url) {
            setDownloadUrl(latest_version.download_url);
          }
          
          await AsyncStorage.setItem(VERSION_CHECK_CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            hasUpdate: has_update,
            versionName: latest_version?.version_name,
          }));
        }
      } catch (error) {
        console.log('[HomeScreen] 版本检查失败:', error);
      }
    };
    checkVersionWithCache();
  }, []);

  const handleVersionPress = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/app/version/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_version_code: CURRENT_VERSION_CODE }),
      });
      
      const data = await response.json();
      if (data?.code === 200 && data?.data) {
        const { has_update, latest_version } = data.data;
        
        if (has_update && latest_version?.download_url) {
          // 有新版本，显示下载弹窗
          const versionName = latest_version?.version_name?.replace(/\.0+$/, '') || '5.0';
          showSystemAlert(
            '发现新版本',
            `发现新版本 beta ${versionName}，建议升级\n\n更新内容：${latest_version.release_notes || '无'}`,
            [
              { text: '稍后再说', style: 'cancel' },
              { text: '立即下载', onPress: () => Linking.openURL(latest_version.download_url) },
            ]
          );
        } else {
          // 已是最新版
          showSystemAlert('版本信息', '当前已是最新版本');
        }
      }
    } catch (error) {
      showSystemAlert('提示', '检查版本失败，请稍后重试');
    }
  };

  useEffect(() => {
    if (isLoggedIn) fetchMessages(true);
  }, [isLoggedIn]);

  useEffect(() => {
    const fetchHomeStats = async () => {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/home-stats`);
        const data = await response.json();
        if (data.code === 200 && data.result) {
          setHomeStats(data.result);
        }
      } catch (error) {
        console.log('[HomeScreen] 获取统计数据失败:', error);
      }
    };
    fetchHomeStats();
  }, []);

  const handleLogin = () => {
    setUserSidebarVisible(false);
    navigation.navigate('Login');
  };

  const handleLogout = () => {
    logout();
    setUserSidebarVisible(false);
  };

  const handleOpenMembership = () => {
    setUserSidebarVisible(false);
    navigation.navigate('MembershipPay');
  };

  const handleOpenMemberCenter = () => {
    setUserSidebarVisible(false);
    navigation.navigate('MemberCenter' as any);
  };

  // 视窗模式状态：'personal' = 牛马视窗(红色), 'enterprise' = 企业视窗(蓝色)
  const [windowMode, setWindowMode] = useState<'personal' | 'enterprise'>('personal');
  
  // 当前部门状态（企业视窗模式下）- null 表示企业整体视图
  const [currentDept, setCurrentDept] = useState<string | null>(null);
  
  // 当前选中的一级菜单（人事部门内）
  const [selectedPrimaryMenu, setSelectedPrimaryMenu] = useState<string | null>(null);

  // 处理企业视窗点击 - 切换到企业模式，显示企业整体视图
  const handleEnterprisePress = () => {
    setWindowMode('enterprise');
    setCurrentDept(null); // 重置为 null，显示企业整体视图
    setSelectedPrimaryMenu(null);
  };

  // 处理牛马视窗点击 - 切换到个人模式
  const handlePersonalPress = () => {
    setWindowMode('personal');
    setCurrentDept(null);
    setSelectedPrimaryMenu(null);
  };

  // 处理从部门场景返回企业整体视图
  const handleBackToEnterpriseOverview = () => {
    setCurrentDept(null);
    setSelectedPrimaryMenu(null);
  };

  const TOOL_ID_MAP: Record<string, string> = {
    bid_writer: 'bid_writer',
    pile_comparison: 'pile_comparison',
    building_3d: 'building_3d',
    cad_viewer: 'cad_viewer',
    id_photo: 'id_photo',
  };

  const handleAIToolPress = useCallback(async (tool: AIToolItem) => {
    if (!isLoggedIn) {
      navigation.navigate('Login');
      return;
    }

    try {
      const backendToolId = TOOL_ID_MAP[tool.id] || tool.id;
      const res = await authenticatedFetch(`${API_CONFIG.BASE_URL}/api/billing/pre-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_id: backendToolId }),
      });
      const json = await res.json();

      if (json.success && json.data && !json.data.allowed) {
        const reason = json.data.reason || 'insufficient_balance';

        if (reason === 'no_membership' || reason === 'membership_expired') {
          Alert.alert(
            reason === 'membership_expired' ? '会员已过期' : '需要开通会员',
            json.data.message || 'AI 工具仅限会员使用',
            [
              { text: '取消', style: 'cancel' },
              {
                text: reason === 'membership_expired' ? '去续费' : '开通会员',
                onPress: () => navigation.navigate('MembershipPay'),
              },
            ],
          );
        } else {
          Alert.alert(
            '余额不足',
            json.data.message || '当前余额不足以使用该工具，请先充值',
            [
              { text: '取消', style: 'cancel' },
              {
                text: '去充值',
                onPress: () => navigation.navigate('TokenPrice'),
              },
            ],
          );
        }
        return;
      }
    } catch (e) {
      console.warn('[Home] pre-check 异常，降级放行', e);
    }

    navigation.navigate(tool.screen);
  }, [isLoggedIn, navigation]);

  // 处理一级菜单点击 - 更新选中状态，显示对应的二级菜单
  const handlePrimaryMenuPress = (menuId: string) => {
    if (selectedPrimaryMenu === menuId) {
      setSelectedPrimaryMenu(null);
    } else {
      setSelectedPrimaryMenu(menuId);
    }
  };

  // 根据当前模式和部门获取卡片数据
  const getDepartmentData = () => {
    if (windowMode === 'personal') {
      return {
        tools: AI_TOOLS,
        cards: getPersonalCards(homeStats),
      };
    }
    // 企业视窗模式下，如果 currentDept 为 null，显示企业整体视图（无菜单和卡片）
    if (currentDept === null) {
      return {
        tools: [],
        cards: [],
      };
    }
    // 人事部门
    if (currentDept === 'hr') {
      return {
        tools: HR_PRIMARY_ENTRIES,
        cards: selectedPrimaryMenu ? (HR_SECONDARY_CARDS[selectedPrimaryMenu] || []) : [],
      };
    }
    // 采购中心
    if (currentDept === 'purchase') {
      return {
        tools: PURCHASE_PRIMARY_ENTRIES,
        cards: selectedPrimaryMenu ? (PURCHASE_SECONDARY_CARDS[selectedPrimaryMenu] || []) : [],
      };
    }
    // 生产中心
    if (currentDept === 'production') {
      return {
        tools: PRODUCTION_PRIMARY_ENTRIES,
        cards: selectedPrimaryMenu ? (PRODUCTION_SECONDARY_CARDS[selectedPrimaryMenu] || []) : [],
      };
    }
    // 销售中心
    if (currentDept === 'sales') {
      return {
        tools: SALES_PRIMARY_ENTRIES,
        cards: selectedPrimaryMenu ? (SALES_SECONDARY_CARDS[selectedPrimaryMenu] || []) : [],
      };
    }
    // 默认
    return {
      tools: HR_PRIMARY_ENTRIES,
      cards: [],
    };
  };
  
  const currentCards = getDepartmentData().cards;
  const currentTools = getDepartmentData().tools;

  const renderCard = (card: any) => {
    const isDeptCard = currentDept !== null;
    const bgColor = card.bgColor || '#F0F4F7';
    // 使用卡片定义的渐变颜色，如果没有定义则使用默认渐变
    const bgBaseColor = '#F0F4F8';
    const gradientColors = card.gradientColors && card.gradientColors.length >= 2
      ? [bgBaseColor, card.gradientColors[0], card.gradientColors[1]]
      : [bgBaseColor, bgBaseColor, bgColor];
    
    return (
      <View key={card.id} style={styles.cardOuter}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.card, styles.cardNeumorphism]}
          onPress={() => {
            if (card.route) {
              navigation.navigate(card.route as any);
            }
          }}
        >
          <LinearGradient
            colors={gradientColors}
            locations={[0.5, 0.75, 1]}
            style={styles.cardGradient}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardLeft}>
                {isDeptCard ? (
                  <>
                    <Text style={[styles.cardTitle, { color: card.color, marginBottom: 4 }]}>{card.title}</Text>
                    <Text style={styles.cardDesc}>{card.desc}</Text>
                  </>
                ) : (
                  <>
                    <View style={styles.cardCountRow}>
                      <Text style={[styles.cardCountNum, { color: card.color }]}>{card.countNum}</Text>
                      <Text style={[styles.cardCountUnit, { color: card.color }]}>{card.countUnit}</Text>
                    </View>
                    <View style={styles.cardBottom}>
                      <Text style={styles.cardTitle}>{card.title}</Text>
                      <Text style={styles.cardSub}>{card.sub}</Text>
                    </View>
                  </>
                )}
              </View>
              {card.iconImage ? (
                <Image source={card.iconImage} style={styles.cardIconImage} resizeMode="contain" />
              ) : (
                <View style={[styles.cardIconBox, { backgroundColor: card.color }]}>
                  <Icon name={card.icon} size={20} color="#FFFFFF" />
                </View>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* 顶部导航 - 透明悬浮层 */}
      <View style={[styles.topNavOverlay, { paddingTop: insets.top + 12 }]}>
        <View style={styles.logoArea}>
          <Text style={styles.logo}>LINKBUILD</Text>
          <View style={styles.navRight}>
            <TouchableOpacity
              style={styles.iconBtn}
              activeOpacity={0.7}
              onPress={() => setMessageSidebarVisible(true)}
            >
              <Icon name="message" size={22} color="#1e293b" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              activeOpacity={0.7}
              onPress={() => setUserSidebarVisible(true)}
            >
              <Icon name="user" size={22} color="#1e293b" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.logoLine} />
        <TouchableOpacity
          style={styles.membershipRow}
          onPress={() => {
            if (windowMode === 'enterprise') {
              setShowLanyardBadge(true);
            } else {
              if (isMember()) {
                navigation.navigate('MemberCenter' as any);
              } else {
                navigation.navigate('MembershipPay');
              }
            }
          }}
        >
          <Image
            source={windowMode === 'personal'
              ? (isMember() ? require('@/assets/images/plus.png') : require('@/assets/images/noplus.png'))
              : require('@/assets/images/nomax.png')
            }
            style={styles.membershipBadge}
            resizeMode="contain"
          />
          <Text style={styles.membershipText}>
            {windowMode === 'personal'
              ? (isLoggedIn ? getMemberName() : '普通用户')
              : '企业会员'
            }
          </Text>
        </TouchableOpacity>
      </View>

      {/* 滚动内容 - 3D场景直接嵌入ScrollView（类似小米汽车App融合模式） */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        nestedScrollEnabled={true}
        overScrollMode="never"
      >
        {/* 3D窗口 - 直接嵌入ScrollView，随页面一起滚动 */}
        <View style={styles.windowInScroll}>
          <EmbeddedAgentWindow
            onPress={() => navigation.navigate('AgentOffice' as any)}
            onFloat={() => useAgentWindowStore.getState().showFloat()}
            onAgentListPress={() => navigation.navigate('AgentOffice' as any)}
            onInteractionStart={() => setScrollEnabled(false)}
            onInteractionEnd={() => setScrollEnabled(true)}
            mode={windowMode}
            onPersonalPress={handlePersonalPress}
            onEnterprisePress={handleEnterprisePress}
            enterpriseEnabled={false}
            onBuildingClick={(buildingName) => {
              const deptMap: Record<string, string> = {
                '行政大厅': 'hr',
                '采购中心': 'purchase',
                '生产车间': 'production',
                '销售据点': 'sales',
              };
              const dept = deptMap[buildingName];
              if (dept) {
                setCurrentDept(dept);
                const primaryMap: Record<string, string> = {
                  'hr': HR_PRIMARY_ENTRIES[0]?.id || 'attendance',
                  'purchase': PURCHASE_PRIMARY_ENTRIES[0]?.id || 'supplier',
                  'production': PRODUCTION_PRIMARY_ENTRIES[0]?.id || 'production_line',
                  'sales': SALES_PRIMARY_ENTRIES[0]?.id || 'customer',
                };
                setSelectedPrimaryMenu(primaryMap[dept]);
              }
            }}
            onBackToOverview={handleBackToEnterpriseOverview}
            department={currentDept}
          />
        </View>



        {/* 部门一级菜单 - 蓝色腰线下方 */}
        {currentTools.length > 0 && (
          <View style={styles.aiToolsSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.aiToolsScrollContent}
            >
              {currentTools.map((tool: any) => (
                <TouchableOpacity
                  key={tool.id}
                  style={[
                    styles.aiToolItem,
                    currentDept !== null && selectedPrimaryMenu === tool.id && styles.aiToolItemActive
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (currentDept !== null) {
                      handlePrimaryMenuPress(tool.id);
                    } else {
                      handleAIToolPress(tool as AIToolItem);
                    }
                  }}
                >
                  <View style={[styles.aiToolIconBox, { backgroundColor: tool.bgColor }]}>
                    <Icon name={tool.icon} size={24} color={tool.iconColor} />
                  </View>
                  <Text style={styles.aiToolTitle}>{tool.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 功能卡片 - 自动换行布局 */}
        {currentCards.length > 0 ? (
          <View style={styles.cardsContainer}>
            {currentCards.map((card: any) => renderCard(card))}
          </View>
        ) : (
          currentDept !== null && (
            <View style={styles.emptyCardsHint}>
              <Text style={styles.emptyCardsText}>点击上方一级菜单查看功能</Text>
            </View>
          )
        )}

        {/* 底部信息栏 - 小米汽车风格 */}
        <View style={styles.footerSection}>
          <View style={styles.footerBrandRow}>
            <Image source={require('@/assets/images/icon-64.png')} style={styles.footerLogo} />
            <Text style={styles.footerBrand}>领建</Text>
            <TouchableOpacity style={styles.versionRowInline} onPress={handleVersionPress} activeOpacity={0.7}>
              <Text style={styles.footerVersionInline}>Version {versionInfo.replace(/\s*beta\s*/i, '')}</Text>
              <View style={styles.betaTagInline}>
                <Text style={styles.betaTagTextInline}>BETA</Text>
              </View>
              {hasNewVersion && <View style={styles.redDot} />}
            </TouchableOpacity>
          </View>
          <View style={styles.footerInfoRow}>
            <Text style={styles.footerBuild}>备案号: 浙ICP备2023011512号-2A</Text>
          </View>
          <View style={styles.footerCopyrightRow}>
            <Text style={styles.footerCopyright}>© 2026 领建科技 版权所有</Text>
            <View style={styles.footerLinks}>
              <TouchableOpacity style={styles.footerLinkBox} onPress={() => navigation.navigate('HelpCenter' as never)}>
                <Text style={styles.footerLinkText}>帮助中心</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.footerLinkBox} onPress={() => navigation.navigate('Feedback' as never)}>
                <Text style={styles.footerLinkText}>用户反馈</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <UserSidebar
        visible={userSidebarVisible}
        onClose={() => setUserSidebarVisible(false)}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onOpenMembership={handleOpenMembership}
        onOpenMemberCenter={handleOpenMemberCenter}
      />

      <MessageSidebar
        visible={messageSidebarVisible}
        onClose={() => setMessageSidebarVisible(false)}
      />

      {showLanyardBadge && (
        <LanyardBadge />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F7',
  },
  // 根容器样式
  root: {
    flex: 1,
    backgroundColor: '#F0F4F7',
  },
  // 顶部导航悬浮层
  topNavOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: CARD_PADDING,
    paddingBottom: 8,
    backgroundColor: 'transparent', // 透明背景
    zIndex: 10,
  },
  logoArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
    letterSpacing: 4,
    fontFamily: 'AstronBold',
  },
  logoLine: {
    height: 1,
    backgroundColor: '#4a5568',
    width: 120,
    marginTop: 0,
  },
  membershipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginLeft: 0,
    paddingLeft: 0,
  },
  membershipBadge: {
    width: 44,
    height: 18,
    marginLeft: 0,
    marginRight: 0,
  },
  membershipText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: FontWeight.normal,
    marginLeft: 0,
  },
  navRight: {
    flexDirection: 'row',
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent', // 去掉背景，更美观
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#B20000',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // 3D窗口嵌入ScrollView - 直接参与滚动流
  windowInScroll: {
    width: SCREEN_WIDTH,
    height: 400,
    backgroundColor: 'transparent',
  },
  // AI工具图标行样式 - 轻量简约
  aiToolsSection: {
    marginTop: 17,
    paddingVertical: 4,
  },
  aiToolsScrollContent: {
    paddingHorizontal: CARD_PADDING,
    gap: 16,
  },
  aiToolItem: {
    alignItems: 'center',
    width: 60,
  },
  aiToolItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#3B82F6',
    paddingBottom: 4,
  },
  aiToolIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  aiToolTitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
  emptyCardsHint: {
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyCardsText: {
    fontSize: FontSize.sm,
    color: '#9CA3AF',
  },
  cardsContainer: {
    paddingHorizontal: CARD_PADDING,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cardOuter: {
    width: (SCREEN_WIDTH - CARD_PADDING * 2 - 12) / 2,
    height: 100,
    borderRadius: 4,
    backgroundColor: '#E4E8EC',
    padding: 2,
  },
  card: {
    flex: 1,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#F0F4F8',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: -2, height: -2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 4,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.95)',
    borderLeftColor: 'rgba(255, 255, 255, 0.95)',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRightColor: 'rgba(163, 177, 191, 0.6)',
    borderBottomColor: 'rgba(163, 177, 191, 0.6)',
  },
  cardGradient: {
    flex: 1,
  },
  cardNeumorphism: {
    shadowColor: '#A3B1BF',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 4,
    elevation: 4,
  },
  cardNeumorphismDark: {
    shadowColor: '#94a3b8',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    flex: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flex: 1,
  },
  cardCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginBottom: 8,
  },
  cardCountNum: {
    fontSize: 20,
    fontWeight: FontWeight.bold,
  },
  cardCountUnit: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    opacity: 0.8,
  },
  cardBottom: {
    gap: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
  },
  cardSub: {
    fontSize: 10,
    fontWeight: FontWeight.normal,
    color: '#64748b',
    letterSpacing: 0.3,
  },
  cardDesc: {
    fontSize: 12,
    fontWeight: FontWeight.normal,
    color: '#64748b',
    letterSpacing: 0.3,
  },
  cardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  cardIconImage: {
    width: 58,
    height: 58,
    alignSelf: 'flex-end',
  },
  // 底部信息栏 - 小米汽车风格
  footerSection: {
    marginTop: 32,
    marginBottom: 6,
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 5,
    backgroundColor: 'transparent',
    marginHorizontal: CARD_PADDING,
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  footerLogo: {
    width: 32,
    height: 32,
    marginRight: 8,
    borderRadius: 6,
  },
  footerBrand: {
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
    letterSpacing: 0.5,
  },
  versionRowInline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginLeft: 8,
    marginBottom: 2,
  },
  footerVersionInline: {
    fontSize: 10,
    color: '#94a3b8',
  },
  betaTagInline: {
    marginLeft: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 2,
  },
  betaTagTextInline: {
    fontSize: 6,
    color: '#94a3b8',
    fontWeight: FontWeight.medium,
  },
  footerInfoRow: {
    marginBottom: 4,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  footerVersion: {
    fontSize: 12,
    color: '#64748b',
  },
  betaTag: {
    marginLeft: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRadius: 2,
  },
  betaTagText: {
    fontSize: 6,
    color: '#64748b',
    fontWeight: FontWeight.medium,
  },
  redDot: {
    marginLeft: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  footerBuild: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  footerCopyrightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerLinkBox: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  footerLinkText: {
    fontSize: 11,
    color: '#64748b',
    textDecorationLine: 'underline',
  },
  footerCopyright: {
    fontSize: 11,
    color: '#94a3b8',
  },
});

export default HomeScreen;
