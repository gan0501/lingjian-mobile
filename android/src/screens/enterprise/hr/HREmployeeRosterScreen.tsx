import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/common';
import { FontSize, FontWeight } from '@/constants/typography';
import { Colors } from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DEPARTMENTS = [
  { id: 'all', name: '全部', count: 0 },
  { id: 'hr', name: '行政大厅', count: 0 },
  { id: 'sales', name: '销售据点', count: 0 },
  { id: 'production', name: '生产车间', count: 0 },
  { id: 'purchase', name: '采购中心', count: 0 },
  { id: 'rd', name: '研发中心', count: 0 },
  { id: 'finance', name: '财务部', count: 0 },
];

const EMPLOYEE_STATUS_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
  Active: { label: '在职', color: '#16a34a', bgColor: '#dcfce7' },
  Inactive: { label: '停职', color: '#64748b', bgColor: '#f1f5f9' },
  Suspended: { label: '暂停', color: '#d97706', bgColor: '#fef3c7' },
  Left: { label: '离职', color: '#dc2626', bgColor: '#fee2e2' },
};

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  FullTime: '全职',
  PartTime: '兼职',
  Contract: '合同工',
  Intern: '实习生',
};

const MOCK_EMPLOYEES = [
  { id: 'EMP-001', name: '张三', gender: 'Male', department: '行政大厅', designation: 'HR总监', employmentType: 'FullTime', status: 'Active', avatar: null, phone: '138****1234', email: 'zhangsan@company.com', joinDate: '2020-01-10', dateOfBirth: '1985-06-15', reportsTo: null, company: '领建科技' },
  { id: 'EMP-002', name: '李四', gender: 'Male', department: '销售据点', designation: '销售经理', employmentType: 'FullTime', status: 'Active', avatar: null, phone: '139****5678', email: 'lisi@company.com', joinDate: '2021-06-20', dateOfBirth: '1990-03-22', reportsTo: 'EMP-001', company: '领建科技' },
  { id: 'EMP-003', name: '王五', gender: 'Male', department: '生产车间', designation: '生产主管', employmentType: 'FullTime', status: 'Active', avatar: null, phone: '137****9012', email: 'wangwu@company.com', joinDate: '2020-01-10', dateOfBirth: '1988-11-08', reportsTo: 'EMP-001', company: '领建科技' },
  { id: 'EMP-004', name: '赵六', gender: 'Female', department: '行政大厅', designation: 'HR专员', employmentType: 'FullTime', status: 'Active', avatar: null, phone: '136****3456', email: 'zhaoliu@company.com', joinDate: '2023-02-28', dateOfBirth: '1995-07-19', reportsTo: 'EMP-001', company: '领建科技' },
  { id: 'EMP-005', name: '钱七', gender: 'Male', department: '研发中心', designation: '高级工程师', employmentType: 'FullTime', status: 'Active', avatar: null, phone: '135****7890', email: 'qianqi@company.com', joinDate: '2023-08-15', dateOfBirth: '1992-04-30', reportsTo: 'EMP-001', company: '领建科技' },
  { id: 'EMP-006', name: '孙八', gender: 'Female', department: '采购中心', designation: '采购专员', employmentType: 'Contract', status: 'Active', avatar: null, phone: '134****2345', email: 'sunba@company.com', joinDate: '2022-11-05', dateOfBirth: '1993-12-01', reportsTo: 'EMP-003', company: '领建科技' },
  { id: 'EMP-007', name: '周九', gender: 'Male', department: '销售据点', designation: '销售代表', employmentType: 'FullTime', status: 'Suspended', avatar: null, phone: '133****6789', email: 'zhoujiu@company.com', joinDate: '2022-05-18', dateOfBirth: '1991-09-14', reportsTo: 'EMP-002', company: '领建科技' },
  { id: 'EMP-008', name: '吴十', gender: 'Female', department: '财务部', designation: '会计', employmentType: 'FullTime', status: 'Left', avatar: null, phone: '132****0123', email: 'wushi@company.com', joinDate: '2019-03-01', dateOfBirth: '1987-02-25', reportsTo: null, company: '领建科技' },
];

interface Props {
  navigation: any;
}

const HREmployeeRosterScreen: React.FC<Props> = ({ navigation }) => {
  const [searchText, setSearchText] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [employees, setEmployees] = useState(MOCK_EMPLOYEES);

  const filteredEmployees = useMemo(() => {
    let result = employees;
    
    if (searchText) {
      result = result.filter(emp => 
        emp.name.includes(searchText) || 
        emp.department.includes(searchText) ||
        emp.designation.includes(searchText) ||
        emp.id.includes(searchText)
      );
    }
    
    if (selectedDept !== 'all') {
      const deptName = DEPARTMENTS.find(d => d.id === selectedDept)?.name;
      result = result.filter(emp => emp.department === deptName);
    }
    
    return result;
  }, [employees, searchText, selectedDept]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const renderEmployeeItem = useCallback(({ item }: { item: typeof MOCK_EMPLOYEES[0] }) => {
    const statusConfig = EMPLOYEE_STATUS_MAP[item.status] || EMPLOYEE_STATUS_MAP.Active;
    const employTypeLabel = EMPLOYMENT_TYPE_MAP[item.employmentType] || item.employmentType;
    return (
    <TouchableOpacity
      style={styles.employeeCard}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('HREmployeeDetail', { employeeId: item.id })}
    >
      <View style={styles.avatarContainer}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: statusConfig.bgColor }]}>
            <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
          </View>
        )}
        <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
      </View>
      
      <View style={styles.employeeInfo}>
        <View style={styles.employeeHeader}>
          <Text style={styles.employeeName}>{item.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
          {item.employmentType !== 'FullTime' && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{employTypeLabel}</Text>
            </View>
          )}
        </View>
        <Text style={styles.employeeMeta}>
          {item.department} · {item.designation}
        </Text>
        <Text style={styles.employeeExtra}>
          {item.id} | 入职: {item.joinDate}
        </Text>
      </View>
      
      <Icon name="chevronRight" size={18} color="#cbd5e1" />
    </TouchableOpacity>
  );
  }, [navigation]);

  const renderDepartmentFilter = useCallback(() => (
    <View style={styles.filterContainer}>
      <FlatList
        horizontal
        data={DEPARTMENTS}
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedDept === item.id && styles.filterChipActive
            ]}
            activeOpacity={0.7}
            onPress={() => setSelectedDept(item.id)}
          >
            <Text style={[
              styles.filterText,
              selectedDept === item.id && styles.filterTextActive
            ]}>
              {item.name}
            </Text>
            {item.count > 0 && (
              <Text style={[
                styles.filterCount,
                selectedDept === item.id && styles.filterCountActive
              ]}>
                {item.count}
              </Text>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  ), [selectedDept]);

  const renderListHeader = useCallback(() => (
    <View style={styles.listHeader}>
      <Text style={styles.resultCount}>
        共 {filteredEmployees.length} 名员工
      </Text>
      <TouchableOpacity style={styles.sortBtn} activeOpacity={0.7}>
        <Icon name="arrow-up-down" size={14} color="#64748b" />
        <Text style={styles.sortText}>排序</Text>
      </TouchableOpacity>
    </View>
  ), [filteredEmployees.length]);

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
          
          <Text style={styles.headerTitle}>人员花名册</Text>

          <TouchableOpacity style={styles.addBtn} activeOpacity={0.7}>
            <Icon name="plus" size={20} color="#ec4899" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Icon name="search" size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="搜索员工姓名、部门、职位..."
              placeholderTextColor="#94a3b8"
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <Icon name="x" size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

      {renderDepartmentFilter()}

      <FlatList
        data={filteredEmployees}
        keyExtractor={item => item.id}
        renderItem={renderEmployeeItem}
        ListHeaderComponent={renderListHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#ec4899']}
            tintColor="#ec4899"
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
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(236,72,153,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    color: '#1e293b',
    padding: 0,
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
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#ec4899',
  },
  filterText: {
    fontSize: FontSize.sm,
    color: '#64748b',
    fontWeight: FontWeight.medium,
  },
  filterTextActive: {
    color: '#fff',
  },
  filterCount: {
    fontSize: FontSize.xs,
    color: '#94a3b8',
    fontWeight: FontWeight.semibold,
  },
  filterCountActive: {
    color: 'rgba(255,255,255,0.8)',
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
  employeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#64748b',
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  employeeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  employeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  employeeName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#1e293b',
  },
  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#eff6ff',
  },
  typeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: '#3b82f6',
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  employeeMeta: {
    fontSize: FontSize.sm,
    color: '#64748b',
    marginTop: 2,
  },
  employeeExtra: {
    fontSize: FontSize.xs,
    color: '#94a3b8',
    marginTop: 4,
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
    backgroundColor: '#ec4899',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default HREmployeeRosterScreen;
