import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/common';
import { FontSize, FontWeight } from '@/constants/typography';

const EMPLOYEE_DETAIL = {
  id: '1',
  name: '张三',
  employeeId: 'EMP20220315001',
  department: '技术部',
  position: '高级工程师',
  status: 'active',
  gender: '男',
  birthDate: '1990-05-15',
  phone: '138****1234',
  email: 'zhangsan@company.com',
  idCard: '110***********1234',
  joinDate: '2022-03-15',
  probationEnd: '2022-06-15',
  contractEnd: '2025-03-14',
  education: '本科 · 计算机科学',
  emergencyContact: '李四 139****5678',
  bankAccount: '6222 **** **** 1234',
  bankName: '工商银行',
  address: '北京市朝阳区xxx街道xxx小区',
};

const WORK_HISTORY = [
  { month: '2024年1月', attendance: 22, late: 1, leave: 0, overtime: 8 },
  { month: '2023年12月', attendance: 21, late: 0, leave: 1, overtime: 12 },
  { month: '2023年11月', attendance: 22, late: 2, leave: 0, overtime: 4 },
];

interface Props {
  navigation: any;
  route: {
    params: {
      employeeId: string;
    };
  };
}

const HREmployeeDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const [activeSection, setActiveSection] = useState<'info' | 'work'>('info');

  const renderInfoRow = (label: string, value: string, icon: string) => (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Icon name={icon as any} size={16} color="#94a3b8" />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Icon name="chevronLeft" size={22} color="#64748b" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>员工详情</Text>

          <TouchableOpacity style={styles.editBtn} activeOpacity={0.7}>
            <Icon name="edit-2" size={18} color="#f472b6" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{EMPLOYEE_DETAIL.name.charAt(0)}</Text>
            </View>
            <View style={[
              styles.statusDot,
              { backgroundColor: EMPLOYEE_DETAIL.status === 'active' ? '#22c55e' : '#94a3b8' }
            ]} />
          </View>
          
          <Text style={styles.employeeName}>{EMPLOYEE_DETAIL.name}</Text>
          <Text style={styles.employeePosition}>
            {EMPLOYEE_DETAIL.department} · {EMPLOYEE_DETAIL.position}
          </Text>
          <Text style={styles.employeeId}>工号: {EMPLOYEE_DETAIL.employeeId}</Text>

          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{EMPLOYEE_DETAIL.joinDate}</Text>
              <Text style={styles.quickStatLabel}>入职日期</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{EMPLOYEE_DETAIL.contractEnd}</Text>
              <Text style={styles.quickStatLabel}>合同到期</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeSection === 'info' && styles.tabActive]}
            activeOpacity={0.7}
            onPress={() => setActiveSection('info')}
          >
            <Text style={[styles.tabText, activeSection === 'info' && styles.tabTextActive]}>
              基本信息
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeSection === 'work' && styles.tabActive]}
            activeOpacity={0.7}
            onPress={() => setActiveSection('work')}
          >
            <Text style={[styles.tabText, activeSection === 'work' && styles.tabTextActive]}>
              工作记录
            </Text>
          </TouchableOpacity>
        </View>

        {activeSection === 'info' ? (
          <View style={styles.infoSection}>
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>个人信息</Text>
              {renderInfoRow('性别', EMPLOYEE_DETAIL.gender, 'user')}
              {renderInfoRow('出生日期', EMPLOYEE_DETAIL.birthDate, 'calendar')}
              {renderInfoRow('身份证号', EMPLOYEE_DETAIL.idCard, 'credit-card')}
              {renderInfoRow('手机号码', EMPLOYEE_DETAIL.phone, 'phone')}
              {renderInfoRow('电子邮箱', EMPLOYEE_DETAIL.email, 'mail')}
              {renderInfoRow('家庭住址', EMPLOYEE_DETAIL.address, 'map-pin')}
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>工作信息</Text>
              {renderInfoRow('入职日期', EMPLOYEE_DETAIL.joinDate, 'calendar')}
              {renderInfoRow('转正日期', EMPLOYEE_DETAIL.probationEnd, 'check-circle')}
              {renderInfoRow('合同到期', EMPLOYEE_DETAIL.contractEnd, 'file-text')}
              {renderInfoRow('学历', EMPLOYEE_DETAIL.education, 'book-open')}
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>财务信息</Text>
              {renderInfoRow('开户银行', EMPLOYEE_DETAIL.bankName, 'building')}
              {renderInfoRow('银行账号', EMPLOYEE_DETAIL.bankAccount, 'credit-card')}
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>紧急联系人</Text>
              {renderInfoRow('联系人', EMPLOYEE_DETAIL.emergencyContact, 'users')}
            </View>
          </View>
        ) : (
          <View style={styles.workSection}>
            {WORK_HISTORY.map((item, index) => (
              <View key={index} style={styles.workCard}>
                <Text style={styles.workMonth}>{item.month}</Text>
                <View style={styles.workStats}>
                  <View style={styles.workStatItem}>
                    <Text style={styles.workStatValue}>{item.attendance}</Text>
                    <Text style={styles.workStatLabel}>出勤</Text>
                  </View>
                  <View style={styles.workStatItem}>
                    <Text style={[styles.workStatValue, { color: '#f59e0b' }]}>{item.late}</Text>
                    <Text style={styles.workStatLabel}>迟到</Text>
                  </View>
                  <View style={styles.workStatItem}>
                    <Text style={[styles.workStatValue, { color: '#3b82f6' }]}>{item.leave}</Text>
                    <Text style={styles.workStatLabel}>请假</Text>
                  </View>
                  <View style={styles.workStatItem}>
                    <Text style={[styles.workStatValue, { color: '#9333ea' }]}>{item.overtime}h</Text>
                    <Text style={styles.workStatLabel}>加班</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actionSection}>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8}>
            <Icon name="file-text" size={18} color="#f472b6" />
            <Text style={styles.actionText}>查看档案</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8}>
            <Icon name="message-circle" size={18} color="#f472b6" />
            <Text style={styles.actionText}>发送消息</Text>
          </TouchableOpacity>
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
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(244,114,182,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fce7f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: FontWeight.bold,
    color: '#f472b6',
  },
  statusDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#fff',
  },
  employeeName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
    marginBottom: 4,
  },
  employeePosition: {
    fontSize: FontSize.sm,
    color: '#64748b',
    marginBottom: 2,
  },
  employeeId: {
    fontSize: FontSize.xs,
    color: '#94a3b8',
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    width: '100%',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
  },
  quickStatLabel: {
    fontSize: FontSize.xs,
    color: '#64748b',
    marginTop: 2,
  },
  quickStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e2e8f0',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  tabActive: {
    backgroundColor: '#f472b6',
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: '#64748b',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: FontWeight.semibold,
  },
  infoSection: {
    paddingHorizontal: 16,
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: FontSize.xs,
    color: '#94a3b8',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: FontSize.sm,
    color: '#1e293b',
    fontWeight: FontWeight.medium,
  },
  workSection: {
    paddingHorizontal: 16,
  },
  workCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  workMonth: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#1e293b',
    marginBottom: 12,
  },
  workStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  workStatItem: {
    alignItems: 'center',
  },
  workStatValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
  },
  workStatLabel: {
    fontSize: FontSize.xs,
    color: '#64748b',
    marginTop: 2,
  },
  actionSection: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,114,182,0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  actionText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#f472b6',
  },
  bottomSpacer: {
    height: 40,
  },
});

export default HREmployeeDetailScreen;
