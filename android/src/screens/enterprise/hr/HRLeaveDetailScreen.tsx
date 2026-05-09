import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/common';
import { FontSize, FontWeight } from '@/constants/typography';

const LEAVE_DETAIL = {
  id: '1',
  employeeName: '张三',
  department: '技术部',
  position: '高级工程师',
  leaveType: '年假',
  startDate: '2024-01-15',
  endDate: '2024-01-16',
  days: 2,
  reason: '家庭事务，需要处理一些紧急的个人事务',
  status: 'pending',
  createTime: '2024-01-10 09:30',
  approver: '李四',
  approverPosition: '技术部经理',
  approvalHistory: [
    { step: 1, name: '李四', position: '技术部经理', status: 'pending', time: null, comment: null },
    { step: 2, name: '王五', position: '人事主管', status: 'waiting', time: null, comment: null },
  ],
  leaveBalance: {
    annual: 8,
    sick: 10,
    personal: 3,
  },
};

interface Props {
  navigation: any;
  route: {
    params: {
      leaveId: string;
    };
  };
}

const HRLeaveDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const [leaveData] = useState(LEAVE_DETAIL);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: '待审批', color: '#f59e0b', bgColor: '#fef3c7', icon: 'clock' };
      case 'approved':
        return { label: '已通过', color: '#22c55e', bgColor: '#dcfce7', icon: 'check-circle' };
      case 'rejected':
        return { label: '已拒绝', color: '#ef4444', bgColor: '#fee2e2', icon: 'x-circle' };
      case 'waiting':
        return { label: '等待中', color: '#64748b', bgColor: '#f1f5f9', icon: 'minus-circle' };
      default:
        return { label: '未知', color: '#64748b', bgColor: '#f1f5f9', icon: 'help-circle' };
    }
  };

  const statusConfig = getStatusConfig(leaveData.status);

  const renderApprovalStep = (item: typeof LEAVE_DETAIL.approvalHistory[0], index: number, total: number) => {
    const stepConfig = getStatusConfig(item.status);
    
    return (
      <View key={index} style={styles.approvalStep}>
        <View style={styles.stepLineContainer}>
          <View style={[
            styles.stepDot,
            { backgroundColor: stepConfig.color }
          ]}>
            <Icon name={stepConfig.icon as any} size={12} color="#fff" />
          </View>
          {index < total - 1 && <View style={styles.stepLine} />}
        </View>
        <View style={styles.stepContent}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepName}>{item.name}</Text>
            <View style={[styles.stepBadge, { backgroundColor: stepConfig.bgColor }]}>
              <Text style={[styles.stepBadgeText, { color: stepConfig.color }]}>
                {stepConfig.label}
              </Text>
            </View>
          </View>
          <Text style={styles.stepPosition}>{item.position}</Text>
          {item.comment && (
            <Text style={styles.stepComment}>{item.comment}</Text>
          )}
          {item.time && (
            <Text style={styles.stepTime}>{item.time}</Text>
          )}
        </View>
      </View>
    );
  };

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
          
          <Text style={styles.headerTitle}>请假详情</Text>

          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusCard}>
          <View style={[styles.statusIcon, { backgroundColor: statusConfig.bgColor }]}>
            <Icon name={statusConfig.icon as any} size={32} color={statusConfig.color} />
          </View>
          <Text style={styles.statusLabel}>{statusConfig.label}</Text>
          <Text style={styles.statusDesc}>
            {leaveData.status === 'pending' ? '等待审批人处理' : 
             leaveData.status === 'approved' ? '审批已通过' : '审批已拒绝'}
          </Text>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.employeeInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{leaveData.employeeName.charAt(0)}</Text>
                </View>
                <View>
                  <Text style={styles.employeeName}>{leaveData.employeeName}</Text>
                  <Text style={styles.employeeMeta}>
                    {leaveData.department} · {leaveData.position}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>请假信息</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>请假类型</Text>
              <Text style={styles.infoValue}>{leaveData.leaveType}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>开始日期</Text>
              <Text style={styles.infoValue}>{leaveData.startDate}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>结束日期</Text>
              <Text style={styles.infoValue}>{leaveData.endDate}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>请假天数</Text>
              <Text style={[styles.infoValue, { color: '#a78bfa' }]}>{leaveData.days}天</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>申请时间</Text>
              <Text style={styles.infoValue}>{leaveData.createTime}</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>请假原因</Text>
            <Text style={styles.reasonText}>{leaveData.reason}</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>假期余额</Text>
            <View style={styles.balanceRow}>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceValue}>{leaveData.leaveBalance.annual}</Text>
                <Text style={styles.balanceLabel}>年假</Text>
              </View>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceValue}>{leaveData.leaveBalance.sick}</Text>
                <Text style={styles.balanceLabel}>病假</Text>
              </View>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceValue}>{leaveData.leaveBalance.personal}</Text>
                <Text style={styles.balanceLabel}>事假</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>审批流程</Text>
            <View style={styles.approvalFlow}>
              {leaveData.approvalHistory.map((item, index) => 
                renderApprovalStep(item, index, leaveData.approvalHistory.length)
              )}
            </View>
          </View>
        </View>

        {leaveData.status === 'pending' && (
          <View style={styles.actionSection}>
            <TouchableOpacity style={styles.rejectBtn} activeOpacity={0.8}>
              <Icon name="x" size={18} color="#ef4444" />
              <Text style={styles.rejectText}>拒绝</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.approveBtn} activeOpacity={0.8}>
              <Icon name="check" size={18} color="#fff" />
              <Text style={styles.approveText}>通过</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf5ff',
  },
  safeArea: {
    backgroundColor: '#faf5ff',
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
  content: {
    flex: 1,
  },
  statusCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
    marginBottom: 4,
  },
  statusDesc: {
    fontSize: FontSize.sm,
    color: '#64748b',
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
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  employeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#a78bfa',
  },
  employeeName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#1e293b',
  },
  employeeMeta: {
    fontSize: FontSize.sm,
    color: '#64748b',
    marginTop: 2,
  },
  cardTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: FontSize.sm,
    color: '#64748b',
  },
  infoValue: {
    fontSize: FontSize.sm,
    color: '#1e293b',
    fontWeight: FontWeight.medium,
  },
  reasonText: {
    fontSize: FontSize.sm,
    color: '#475569',
    lineHeight: 22,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  balanceItem: {
    alignItems: 'center',
  },
  balanceValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: '#a78bfa',
  },
  balanceLabel: {
    fontSize: FontSize.xs,
    color: '#64748b',
    marginTop: 2,
  },
  approvalFlow: {
    marginTop: 8,
  },
  approvalStep: {
    flexDirection: 'row',
  },
  stepLineContainer: {
    width: 32,
    alignItems: 'center',
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: {
    width: 2,
    height: 40,
    backgroundColor: '#e2e8f0',
    marginTop: 4,
  },
  stepContent: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 16,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#1e293b',
  },
  stepBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  stepBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  stepPosition: {
    fontSize: FontSize.xs,
    color: '#64748b',
    marginTop: 2,
  },
  stepComment: {
    fontSize: FontSize.sm,
    color: '#475569',
    marginTop: 4,
    fontStyle: 'italic',
  },
  stepTime: {
    fontSize: FontSize.xs,
    color: '#94a3b8',
    marginTop: 2,
  },
  actionSection: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  rejectText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#ef4444',
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#a78bfa',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  approveText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#fff',
  },
  bottomSpacer: {
    height: 40,
  },
});

export default HRLeaveDetailScreen;
