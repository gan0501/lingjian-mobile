import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/common';
import { FontSize, FontWeight } from '@/constants/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const LEAVE_TYPES = [
  { id: 'all', name: '全部', count: 12 },
  { id: 'Open', name: '待审批', count: 3 },
  { id: 'Approved', name: '已通过', count: 8 },
  { id: 'Rejected', name: '已拒绝', count: 1 },
];

const LEAVE_STATUS_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
  Open: { label: '待审批', color: '#f59e0b', bgColor: '#fef3c7' },
  Approved: { label: '已通过', color: '#22c55e', bgColor: '#dcfce7' },
  Rejected: { label: '已拒绝', color: '#ef4444', bgColor: '#fee2e2' },
  Cancelled: { label: '已取消', color: '#64748b', bgColor: '#f1f5f9' },
};

const ERP_LEAVE_TYPES = [
  { id: 'annual', name: '年假', maxDays: 15 },
  { id: 'sick', name: '病假', maxDays: 10 },
  { id: 'personal', name: '事假', maxDays: 5 },
  { id: 'compensatory', name: '调休', maxDays: 0 },
  { id: 'marriage', name: '婚假', maxDays: 10 },
  { id: 'maternity', name: '产假', maxDays: 158 },
  { id: 'bereavement', name: '丧假', maxDays: 3 },
];

const MOCK_LEAVE_RECORDS = [
  { id: 'LA-001', employee: 'EMP-001', employeeName: '张三', department: '行政大厅', leaveType: '年假', fromDate: '2024-01-15', toDate: '2024-01-16', halfDay: false, totalLeaveDays: 2, leaveBalance: 13, description: '家庭事务', status: 'Open', leaveApprover: 'EMP-001', createTime: '2024-01-10 09:30' },
  { id: 'LA-002', employee: 'EMP-002', employeeName: '李四', department: '销售据点', leaveType: '事假', fromDate: '2024-01-18', toDate: '2024-01-18', halfDay: false, totalLeaveDays: 1, leaveBalance: 4, description: '个人原因', status: 'Approved', leaveApprover: 'EMP-001', createTime: '2024-01-12 14:20' },
  { id: 'LA-003', employee: 'EMP-003', employeeName: '王五', department: '生产车间', leaveType: '病假', fromDate: '2024-01-20', toDate: '2024-01-22', halfDay: false, totalLeaveDays: 3, leaveBalance: 7, description: '身体不适', status: 'Approved', leaveApprover: 'EMP-001', createTime: '2024-01-15 08:45' },
  { id: 'LA-004', employee: 'EMP-004', employeeName: '赵六', department: '行政大厅', leaveType: '调休', fromDate: '2024-01-25', toDate: '2024-01-25', halfDay: false, totalLeaveDays: 1, leaveBalance: 2, description: '加班调休', status: 'Open', leaveApprover: 'EMP-001', createTime: '2024-01-18 16:00' },
  { id: 'LA-005', employee: 'EMP-005', employeeName: '钱七', department: '研发中心', leaveType: '婚假', fromDate: '2024-02-01', toDate: '2024-02-10', halfDay: false, totalLeaveDays: 10, leaveBalance: 0, description: '结婚', status: 'Open', leaveApprover: 'EMP-001', createTime: '2024-01-20 10:15' },
];

interface Props {
  navigation: any;
}

const HRLeaveApprovalScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedType, setSelectedType] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [leaveRecords, setLeaveRecords] = useState(MOCK_LEAVE_RECORDS);

  const filteredRecords = useMemo(() => {
    if (selectedType === 'all') return leaveRecords;
    return leaveRecords.filter(record => record.status === selectedType);
  }, [leaveRecords, selectedType]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const getStatusConfig = (status: string) => {
    return LEAVE_STATUS_MAP[status] || { label: '未知', color: '#64748b', bgColor: '#f1f5f9' };
  };

  const renderLeaveItem = useCallback(({ item }: { item: typeof MOCK_LEAVE_RECORDS[0] }) => {
    const statusConfig = getStatusConfig(item.status);
    
    return (
      <TouchableOpacity
        style={styles.leaveCard}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('HRLeaveDetail', { leaveId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.employeeInfo}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{item.employeeName.charAt(0)}</Text>
            </View>
            <View>
              <Text style={styles.employeeName}>{item.employeeName}</Text>
              <Text style={styles.department}>{item.department}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Icon name="calendar" size={14} color="#94a3b8" />
            <Text style={styles.infoText}>
              {item.fromDate} 至 {item.toDate}
            </Text>
            <Text style={styles.daysText}>{item.totalLeaveDays}天</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="tag" size={14} color="#94a3b8" />
            <Text style={styles.infoText}>{item.leaveType}</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="file-text" size={14} color="#94a3b8" />
            <Text style={styles.infoText} numberOfLines={1}>{item.description}</Text>
          </View>
        </View>

        {item.status === 'pending' && (
          <View style={styles.cardActions}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.rejectBtn]}
              activeOpacity={0.7}
            >
              <Icon name="x" size={16} color="#ef4444" />
              <Text style={styles.rejectText}>拒绝</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.approveBtn]}
              activeOpacity={0.7}
            >
              <Icon name="check" size={16} color="#fff" />
              <Text style={styles.approveText}>通过</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [navigation]);

  const renderTypeFilter = useCallback(() => (
    <View style={styles.filterContainer}>
      <FlatList
        horizontal
        data={LEAVE_TYPES}
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedType === item.id && styles.filterChipActive
            ]}
            activeOpacity={0.7}
            onPress={() => setSelectedType(item.id)}
          >
            <Text style={[
              styles.filterText,
              selectedType === item.id && styles.filterTextActive
            ]}>
              {item.name}
            </Text>
            <View style={[
              styles.filterBadge,
              selectedType === item.id && styles.filterBadgeActive
            ]}>
              <Text style={[
                styles.filterBadgeText,
                selectedType === item.id && styles.filterBadgeTextActive
              ]}>
                {item.count}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  ), [selectedType]);

  const renderListHeader = useCallback(() => (
    <View style={styles.listHeader}>
      <Text style={styles.resultCount}>
        共 {filteredRecords.length} 条记录
      </Text>
      <TouchableOpacity style={styles.sortBtn} activeOpacity={0.7}>
        <Icon name="arrow-up-down" size={14} color="#64748b" />
        <Text style={styles.sortText}>时间排序</Text>
      </TouchableOpacity>
    </View>
  ), [filteredRecords.length]);

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
          
          <Text style={styles.headerTitle}>请假审批</Text>

          <TouchableOpacity style={styles.addBtn} activeOpacity={0.7}>
            <Icon name="plus" size={20} color="#a78bfa" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {renderTypeFilter()}

      <FlatList
        data={filteredRecords}
        keyExtractor={item => item.id}
        renderItem={renderLeaveItem}
        ListHeaderComponent={renderListHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#a78bfa']}
            tintColor="#a78bfa"
          />
        }
      />

      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
          <Icon name="mic" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
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
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(167,139,250,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    paddingBottom: 12,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  filterChipActive: {
    backgroundColor: '#a78bfa',
  },
  filterText: {
    fontSize: FontSize.sm,
    color: '#64748b',
    fontWeight: FontWeight.medium,
  },
  filterTextActive: {
    color: '#fff',
  },
  filterBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filterBadgeText: {
    fontSize: FontSize.xs,
    color: '#64748b',
    fontWeight: FontWeight.semibold,
  },
  filterBadgeTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultCount: {
    fontSize: FontSize.sm,
    color: '#64748b',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortText: {
    fontSize: FontSize.sm,
    color: '#64748b',
    marginLeft: 4,
  },
  leaveCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#a78bfa',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  employeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#a78bfa',
  },
  employeeName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#1e293b',
  },
  department: {
    fontSize: FontSize.xs,
    color: '#64748b',
    marginTop: 1,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  cardBody: {
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: FontSize.sm,
    color: '#475569',
    flex: 1,
  },
  daysText: {
    fontSize: FontSize.sm,
    color: '#a78bfa',
    fontWeight: FontWeight.semibold,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
  },
  rejectBtn: {
    backgroundColor: '#fee2e2',
  },
  approveBtn: {
    backgroundColor: '#a78bfa',
  },
  rejectText: {
    fontSize: FontSize.sm,
    color: '#ef4444',
    fontWeight: FontWeight.semibold,
  },
  approveText: {
    fontSize: FontSize.sm,
    color: '#fff',
    fontWeight: FontWeight.semibold,
  },
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 30,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#a78bfa',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#a78bfa',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default HRLeaveApprovalScreen;
