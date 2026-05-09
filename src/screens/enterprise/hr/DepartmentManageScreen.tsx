import React, { FC, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/common';
import { Spacing } from '@/constants/spacing';
import { FontSize, FontWeight } from '@/constants/typography';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DepartmentManage'>;

interface Department {
  id: string;
  name: string;
  type: 'builtin' | 'custom';
  icon: string;
  color: string;
  manager?: string;
  staffCount: number;
  description?: string;
}

const BUILTIN_DEPARTMENTS: Department[] = [
  { id: 'hr', name: '行政大厅', type: 'builtin', icon: 'users', color: '#3B82F6', staffCount: 12, description: '人事行政管理部门' },
  { id: 'sales', name: '销售据点', type: 'builtin', icon: 'trending-up', color: '#10B981', staffCount: 18, description: '销售业务部门' },
  { id: 'production', name: '生产车间', type: 'builtin', icon: 'tool', color: '#F59E0B', staffCount: 45, description: '生产制造部门' },
  { id: 'purchase', name: '采购中心', type: 'builtin', icon: 'shopping-cart', color: '#8B5CF6', staffCount: 8, description: '采购供应部门' },
  { id: 'rd', name: '研发中心', type: 'builtin', icon: 'cpu', color: '#EC4899', staffCount: 25, description: '技术研发部门' },
  { id: 'finance', name: '财务部', type: 'builtin', icon: 'dollar-sign', color: '#06B6D4', staffCount: 8, description: '财务管理部门' },
];

const DepartmentManageScreen: FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [departments, setDepartments] = useState<Department[]>(BUILTIN_DEPARTMENTS);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');

  const handleAddDepartment = () => {
    setEditingDept(null);
    setDeptName('');
    setDeptDesc('');
    setModalVisible(true);
  };

  const handleEditDepartment = (dept: Department) => {
    if (dept.type === 'builtin') {
      Alert.alert('提示', '内置部门不可编辑，但可设置部门负责人');
      return;
    }
    setEditingDept(dept);
    setDeptName(dept.name);
    setDeptDesc(dept.description || '');
    setModalVisible(true);
  };

  const handleDeleteDepartment = (dept: Department) => {
    if (dept.type === 'builtin') {
      Alert.alert('提示', '内置部门不可删除');
      return;
    }
    Alert.alert(
      '确认删除',
      `确定要删除部门"${dept.name}"吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            setDepartments(prev => prev.filter(d => d.id !== dept.id));
          },
        },
      ]
    );
  };

  const handleSaveDepartment = () => {
    if (!deptName.trim()) {
      Alert.alert('提示', '请输入部门名称');
      return;
    }

    if (editingDept) {
      setDepartments(prev =>
        prev.map(d =>
          d.id === editingDept.id
            ? { ...d, name: deptName, description: deptDesc }
            : d
        )
      );
    } else {
      const newDept: Department = {
        id: `custom_${Date.now()}`,
        name: deptName,
        type: 'custom',
        icon: 'folder',
        color: '#6B7280',
        description: deptDesc,
        staffCount: 0,
      };
      setDepartments(prev => [...prev, newDept]);
    }

    setModalVisible(false);
  };

  const renderDepartment = (dept: Department) => (
    <View key={dept.id} style={styles.deptCard}>
      <View style={styles.deptHeader}>
        <View style={[styles.deptIcon, { backgroundColor: dept.color + '20' }]}>
          <Icon name={dept.icon as any} size={24} color={dept.color} />
        </View>
        <View style={styles.deptInfo}>
          <View style={styles.deptTitleRow}>
            <Text style={styles.deptName}>{dept.name}</Text>
            {dept.type === 'builtin' && (
              <View style={styles.builtinTag}>
                <Text style={styles.builtinTagText}>内置</Text>
              </View>
            )}
          </View>
          <Text style={styles.deptDesc}>{dept.description || '暂无描述'}</Text>
        </View>
      </View>
      <View style={styles.deptStats}>
        <View style={styles.statItem}>
          <Icon name="users" size={14} color="#6B7280" />
          <Text style={styles.statText}>{dept.staffCount} 人</Text>
        </View>
        {dept.manager && (
          <View style={styles.statItem}>
            <Icon name="user" size={14} color="#6B7280" />
            <Text style={styles.statText}>负责人: {dept.manager}</Text>
          </View>
        )}
      </View>
      <View style={styles.deptActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => handleEditDepartment(dept)}
        >
          <Icon name="edit-2" size={16} color="#3B82F6" />
          <Text style={[styles.actionText, { color: '#3B82F6' }]}>编辑</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => Alert.alert('设置负责人', '功能开发中...')}
        >
          <Icon name="user-check" size={16} color="#22C55E" />
          <Text style={[styles.actionText, { color: '#22C55E' }]}>设负责人</Text>
        </TouchableOpacity>
        {dept.type === 'custom' && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleDeleteDepartment(dept)}
          >
            <Icon name="trash-2" size={16} color="#EF4444" />
            <Text style={[styles.actionText, { color: '#EF4444' }]}>删除</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevronLeft" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>部门管理</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddDepartment}>
          <Icon name="plus" size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsCard}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{departments.length}</Text>
            <Text style={styles.statLabel}>部门总数</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {departments.filter(d => d.type === 'builtin').length}
            </Text>
            <Text style={styles.statLabel}>内置部门</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {departments.filter(d => d.type === 'custom').length}
            </Text>
            <Text style={styles.statLabel}>自定义部门</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>部门列表</Text>
          <Text style={styles.sectionDesc}>
            内置部门有专属界面，自定义部门仅用于组织架构展示
          </Text>
        </View>

        <View style={styles.deptList}>
          {departments.map(renderDepartment)}
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingDept ? '编辑部门' : '新建部门'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="部门名称"
              value={deptName}
              onChangeText={setDeptName}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="部门描述（选填）"
              value={deptDesc}
              onChangeText={setDeptDesc}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveDepartment}
              >
                <Text style={styles.saveBtnText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.screenPadding,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: FontWeight.bold,
    color: '#111827',
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: '#6B7280',
    marginTop: 4,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: '#111827',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: FontSize.sm,
    color: '#6B7280',
  },
  deptList: {
    gap: 12,
  },
  deptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  deptHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  deptIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deptInfo: {
    flex: 1,
  },
  deptTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  deptName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#111827',
    marginRight: 8,
  },
  builtinTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  builtinTagText: {
    fontSize: FontSize.xs,
    color: '#3B82F6',
  },
  deptDesc: {
    fontSize: FontSize.sm,
    color: '#6B7280',
  },
  deptStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: FontSize.sm,
    color: '#6B7280',
  },
  deptActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
  },
  actionText: {
    fontSize: FontSize.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '85%',
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: FontSize.base,
    marginBottom: 12,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: FontSize.base,
    color: '#6B7280',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: FontSize.base,
    color: '#FFFFFF',
    fontWeight: FontWeight.semibold,
  },
});

export default DepartmentManageScreen;
