import React, { useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/common';
import { FontSize, FontWeight } from '@/constants/typography';
import { Colors } from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const HR_3D_URI = Platform.OS === 'android'
  ? 'file:///android_asset/hrBuilding3D.html'
  : 'about:blank';

const HR_MODULES = [
  {
    id: 'roster',
    name: '人员花名册',
    icon: 'users',
    color: '#f472b6',
    desc: '员工档案 · 部门分布 · 人员结构',
    stats: { total: 0, newThisMonth: 0 },
  },
  {
    id: 'attendance',
    name: '考勤时钟',
    icon: 'clock',
    color: '#22d3ee',
    desc: '出勤统计 · 迟到早退 · 加班记录',
    stats: { rate: '0%', late: 0 },
  },
  {
    id: 'leave',
    name: '请假审批',
    icon: 'calendar',
    color: '#a78bfa',
    desc: '请假申请 · 审批流程 · 假期余额',
    stats: { pending: 0, approved: 0 },
  },
  {
    id: 'salary',
    name: '薪资结算',
    icon: 'wallet',
    color: '#34d399',
    desc: '工资单 · 绩效奖金 · 社保公积金',
    stats: { month: '--', status: '待核算' },
  },
  {
    id: 'recruit',
    name: '招聘市场',
    icon: 'briefcase',
    color: '#fbbf24',
    desc: '职位发布 · 简历管理 · 面试安排',
    stats: { positions: 0, candidates: 0 },
  },
];

interface Props {
  navigation: any;
}

const HRHallScreen: React.FC<Props> = ({ navigation }) => {
  const webViewRef = useRef<WebView>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    attendanceRate: '0%',
    pendingLeaves: 0,
    monthlySalary: '--',
  });

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.action === 'hr_building_click') {
        setSelectedModule(data.icon);
        handleModulePress(data.icon);
      }
    } catch (e) {}
  }, []);

  const handleModulePress = useCallback((moduleId: string) => {
    switch (moduleId) {
      case 'employees':
      case 'roster':
        navigation.navigate('HREmployeeRoster');
        break;
      case 'clock':
      case 'attendance':
        navigation.navigate('HRAttendance');
        break;
      case 'calendar':
      case 'leave':
        navigation.navigate('HRLeaveApproval');
        break;
      case 'wallet':
      case 'salary':
        navigation.navigate('HRSalary');
        break;
      case 'users':
      case 'recruit':
        navigation.navigate('HRRecruit');
        break;
      default:
        break;
    }
  }, [navigation]);

  const renderModuleCard = (module: typeof HR_MODULES[0]) => (
    <TouchableOpacity
      key={module.id}
      style={styles.moduleCard}
      activeOpacity={0.7}
      onPress={() => handleModulePress(module.id)}
    >
      <View style={[styles.moduleIconWrap, { backgroundColor: module.color + '20' }]}>
        <Icon name={module.icon as any} size={24} color={module.color} />
      </View>
      <View style={styles.moduleContent}>
        <Text style={styles.moduleName}>{module.name}</Text>
        <Text style={styles.moduleDesc} numberOfLines={1}>{module.desc}</Text>
      </View>
      <Icon name="chevronRight" size={18} color="#94a3b8" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fdf4ff" />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Icon name="chevronLeft" size={22} color="#94A3B8" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>人事大厅</Text>
            <Text style={styles.headerSub}>HR Management Center</Text>
          </View>

          <TouchableOpacity
            style={styles.aiBtn}
            activeOpacity={0.7}
          >
            <Icon name="mic" size={20} color="#ec4899" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={styles.webviewContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: HR_3D_URI }}
          style={styles.webview}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onMessage={handleMessage}
          startInLoadingState={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        />

        <View style={styles.statsOverlay}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalEmployees}</Text>
            <Text style={styles.statLabel}>在职人数</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.attendanceRate}</Text>
            <Text style={styles.statLabel}>今日出勤</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.pendingLeaves}</Text>
            <Text style={styles.statLabel}>待审批</Text>
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.moduleList}
        contentContainerStyle={styles.moduleListContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>功能模块</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.sectionMore}>查看全部</Text>
          </TouchableOpacity>
        </View>

        {HR_MODULES.map(renderModuleCard)}

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>快捷操作</Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity style={styles.quickBtn} activeOpacity={0.7}>
              <View style={[styles.quickIcon, { backgroundColor: '#fef3c7' }]}>
                <Icon name="user-plus" size={20} color="#f59e0b" />
              </View>
              <Text style={styles.quickText}>入职办理</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} activeOpacity={0.7}>
              <View style={[styles.quickIcon, { backgroundColor: '#dbeafe' }]}>
                <Icon name="file-text" size={20} color="#3b82f6" />
              </View>
              <Text style={styles.quickText}>请假申请</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} activeOpacity={0.7}>
              <View style={[styles.quickIcon, { backgroundColor: '#dcfce7' }]}>
                <Icon name="check-circle" size={20} color="#22c55e" />
              </View>
              <Text style={styles.quickText}>考勤补卡</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} activeOpacity={0.7}>
              <View style={[styles.quickIcon, { backgroundColor: '#fce7f3' }]}>
                <Icon name="dollar-sign" size={20} color="#ec4899" />
              </View>
              <Text style={styles.quickText}>工资查询</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdf4ff',
  },
  safeArea: {
    backgroundColor: '#fdf4ff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fdf4ff',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
  },
  headerSub: {
    fontSize: FontSize.xs,
    color: '#ec4899',
    marginTop: 2,
    fontWeight: FontWeight.medium,
  },
  aiBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(236,72,153,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webviewContainer: {
    height: 280,
    position: 'relative',
  },
  webview: {
    flex: 1,
  },
  statsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: '#64748b',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
  },
  moduleList: {
    flex: 1,
    backgroundColor: '#fdf4ff',
  },
  moduleListContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
  },
  sectionMore: {
    fontSize: FontSize.sm,
    color: '#ec4899',
    fontWeight: FontWeight.medium,
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  moduleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleContent: {
    flex: 1,
    marginLeft: 12,
  },
  moduleName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#1e293b',
  },
  moduleDesc: {
    fontSize: FontSize.xs,
    color: '#64748b',
    marginTop: 2,
  },
  quickActions: {
    marginTop: 20,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  quickBtn: {
    width: (SCREEN_WIDTH - 32 - 36) / 4,
    alignItems: 'center',
  },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickText: {
    fontSize: FontSize.xs,
    color: '#475569',
    fontWeight: FontWeight.medium,
  },
  bottomSpacer: {
    height: 32,
  },
});

export default HRHallScreen;
