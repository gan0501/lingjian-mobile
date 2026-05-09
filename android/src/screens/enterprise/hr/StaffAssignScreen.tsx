import React, { FC, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/common';
import { Spacing } from '@/constants/spacing';
import { FontSize, FontWeight } from '@/constants/typography';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'StaffAssign'>;

interface Staff {
  id: string;
  name: string;
  avatar?: string;
  department: string;
  role: 'boss' | 'director' | 'manager' | 'staff';
  roleText: string;
  roleColor: string;
}

interface Department {
  id: string;
  name: string;
  staffCount: number;
}

const DEPARTMENTS: Department[] = [
  { id: 'hr', name: '行政大厅', staffCount: 12 },
  { id: 'sales', name: '销售据点', staffCount: 18 },
  { id: 'production', name: '生产车间', staffCount: 45 },
  { id: 'purchase', name: '采购中心', staffCount: 8 },
  { id: 'rd', name: '研发中心', staffCount: 25 },
  { id: 'finance', name: '财务部', staffCount: 8 },
];

const MOCK_STAFF: Staff[] = [
  { id: '1', name: '张三', department: 'hr', role: 'boss', roleText: '老板级', roleColor: '#EF4444' },
  { id: '2', name: '李四', department: 'hr', role: 'director', roleText: '总监级', roleColor: '#F59E0B' },
  { id: '3', name: '王五', department: 'sales', role: 'manager', roleText: '主管级', roleColor: '#3B82F6' },
  { id: '4', name: '赵六', department: 'production', role: 'staff', roleText: '员工级', roleColor: '#9CA3AF' },
  { id: '5', name: '钱七', department: 'rd', role: 'staff', roleText: '员工级', roleColor: '#9CA3AF' },
  { id: '6', name: '孙八', department: 'finance', role: 'manager', roleText: '主管级', roleColor: '#3B82F6' },
  { id: '7', name: '周九', department: 'sales', role: 'staff', roleText: '员工级', roleColor: '#9CA3AF' },
  { id: '8', name: '吴十', department: 'purchase', role: 'staff', roleText: '员工级', roleColor: '#9CA3AF' },
];

const StaffAssignScreen: FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [staffList, setStaffList] = useState<Staff[]>(MOCK_STAFF);
  const [searchText, setSearchText] = useState('');
  const [filterDept, setFilterDept] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string | null>(null);

  const filteredStaff = staffList.filter(s => {
    const matchSearch = s.name.includes(searchText);
    const matchDept = !filterDept || s.department === filterDept;
    const matchRole = !filterRole || s.role === filterRole;
    return matchSearch && matchDept && matchRole;
  });

  const handleStaffPress = (staff: Staff) => {
    Alert.alert(
      '人员操作',
      `姓名: ${staff.name}\n部门: ${DEPARTMENTS.find(d => d.id === staff.department)?.name}\n角色: ${staff.roleText}`,
      [
        { text: '取消', style: 'cancel' },
        { text: '调整部门', onPress: () => Alert.alert('提示', '功能开发中...') },
        { text: '调整角色', onPress: () => Alert.alert('提示', '功能开发中...') },
      ]
    );
  };

  const renderFilterBar = () => (
    <View style={styles.filterBar}>
      <View style={styles.searchBox}>
        <Icon name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="搜索人员"
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Icon name="x" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
      >
        <TouchableOpacity
          style={[styles.filterChip, filterDept === null && styles.filterChipActive]}
          onPress={() => setFilterDept(null)}
        >
          <Text style={[styles.filterChipText, filterDept === null && styles.filterChipTextActive]}>
            全部部门
          </Text>
        </TouchableOpacity>
        {DEPARTMENTS.map(dept => (
          <TouchableOpacity
            key={dept.id}
            style={[styles.filterChip, filterDept === dept.id && styles.filterChipActive]}
            onPress={() => setFilterDept(dept.id)}
          >
            <Text style={[styles.filterChipText, filterDept === dept.id && styles.filterChipTextActive]}>
              {dept.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderRoleFilter = () => (
    <View style={styles.roleFilterRow}>
      {[
        { id: null, label: '全部角色' },
        { id: 'boss', label: '老板级', color: '#EF4444' },
        { id: 'director', label: '总监级', color: '#F59E0B' },
        { id: 'manager', label: '主管级', color: '#3B82F6' },
        { id: 'staff', label: '员工级', color: '#9CA3AF' },
      ].map(item => (
        <TouchableOpacity
          key={item.label}
          style={[
            styles.roleFilterBtn,
            filterRole === item.id && styles.roleFilterBtnActive,
            item.id && { borderColor: item.color },
            filterRole === item.id && item.id && { backgroundColor: item.color + '20' },
          ]}
          onPress={() => setFilterRole(item.id)}
        >
          {item.color && <View style={[styles.roleDot, { backgroundColor: item.color }]} />}
          <Text style={[styles.roleFilterText, filterRole === item.id && styles.roleFilterTextActive]}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStaffItem = (staff: Staff) => {
    const dept = DEPARTMENTS.find(d => d.id === staff.department);
    return (
      <TouchableOpacity
        key={staff.id}
        style={styles.staffCard}
        activeOpacity={0.7}
        onPress={() => handleStaffPress(staff)}
      >
        <View style={styles.staffAvatar}>
          <Text style={styles.staffAvatarText}>{staff.name[0]}</Text>
        </View>
        <View style={styles.staffInfo}>
          <View style={styles.staffNameRow}>
            <Text style={styles.staffName}>{staff.name}</Text>
            <View style={[styles.roleTag, { backgroundColor: staff.roleColor + '20' }]}>
              <Text style={[styles.roleTagText, { color: staff.roleColor }]}>{staff.roleText}</Text>
            </View>
          </View>
          <Text style={styles.staffDept}>{dept?.name || '未分配'}</Text>
        </View>
        <Icon name="chevronRight" size={20} color="#D1D5DB" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevronLeft" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>人员分配</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => Alert.alert('添加人员', '功能开发中...')}
        >
          <Icon name="user-plus" size={22} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      {renderFilterBar()}
      {renderRoleFilter()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.resultInfo}>
          <Text style={styles.resultText}>共 {filteredStaff.length} 人</Text>
        </View>

        <View style={styles.staffList}>
          {filteredStaff.map(renderStaffItem)}
        </View>

        {filteredStaff.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="users" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>暂无匹配人员</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenPadding,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: '#111827',
  },
  addButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.screenPadding,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: FontSize.base,
    color: '#111827',
  },
  filterScroll: {
    marginHorizontal: -Spacing.screenPadding,
    paddingHorizontal: Spacing.screenPadding,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#3B82F6',
  },
  filterChipText: {
    fontSize: FontSize.sm,
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  roleFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.screenPadding,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  roleFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  roleFilterBtnActive: {
    borderColor: '#3B82F6',
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  roleFilterText: {
    fontSize: FontSize.sm,
    color: '#6B7280',
  },
  roleFilterTextActive: {
    color: '#111827',
    fontWeight: FontWeight.medium,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.screenPadding,
  },
  resultInfo: {
    marginBottom: 12,
  },
  resultText: {
    fontSize: FontSize.sm,
    color: '#6B7280',
  },
  staffList: {
    gap: 8,
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
  },
  staffAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  staffAvatarText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
  },
  staffInfo: {
    flex: 1,
  },
  staffNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  staffName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: '#111827',
    marginRight: 8,
  },
  roleTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleTagText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  staffDept: {
    fontSize: FontSize.sm,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: FontSize.base,
    color: '#9CA3AF',
    marginTop: 12,
  },
});

export default StaffAssignScreen;
