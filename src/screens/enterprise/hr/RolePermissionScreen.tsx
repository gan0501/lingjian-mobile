import React, { FC, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/common';
import { Spacing } from '@/constants/spacing';
import { FontSize, FontWeight } from '@/constants/typography';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RolePermission'>;

interface Role {
  id: string;
  name: string;
  level: 'boss' | 'director' | 'manager' | 'staff';
  levelText: string;
  color: string;
  count: number;
  permissions: string[];
}

const ROLES: Role[] = [
  {
    id: 'boss',
    name: '老板级',
    level: 'boss',
    levelText: '总管理员',
    color: '#EF4444',
    count: 2,
    permissions: ['所有部门访问', '所有操作权限', '系统设置', '人员管理', '财务查看'],
  },
  {
    id: 'director',
    name: '总监级',
    level: 'director',
    levelText: '部门总监',
    color: '#F59E0B',
    count: 5,
    permissions: ['多部门访问', '部门管理', '数据查看', '审批权限'],
  },
  {
    id: 'manager',
    name: '主管级',
    level: 'manager',
    levelText: '部门主管',
    color: '#3B82F6',
    count: 12,
    permissions: ['单部门访问', '本部门管理', '考勤审批', '任务分配'],
  },
  {
    id: 'staff',
    name: '员工级',
    level: 'staff',
    levelText: '普通员工',
    color: '#9CA3AF',
    count: 86,
    permissions: ['查看自己的数据', '提交申请', '考勤打卡'],
  },
];

const ROLE_LIMITS = {
  boss: { min: 1, max: 5, text: '1-5人' },
  director: { min: 0, max: -1, text: '不限' },
  manager: { min: 0, max: -1, text: '不限' },
  staff: { min: 0, max: -1, text: '不限' },
};

const RolePermissionScreen: FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleRolePress = (role: Role) => {
    setSelectedRole(role);
    setModalVisible(true);
  };

  const handleAddMember = (role: Role) => {
    Alert.alert('添加成员', `从人员列表中选择成员添加为${role.name}`, [
      { text: '取消', style: 'cancel' },
    ]);
  };

  const renderRoleCard = (role: Role) => (
    <TouchableOpacity
      key={role.id}
      style={styles.roleCard}
      activeOpacity={0.7}
      onPress={() => handleRolePress(role)}
    >
      <View style={styles.roleHeader}>
        <View style={[styles.roleIcon, { backgroundColor: role.color + '20' }]}>
          <Icon name="shield" size={24} color={role.color} />
        </View>
        <View style={styles.roleInfo}>
          <Text style={styles.roleName}>{role.name}</Text>
          <Text style={styles.roleLevelText}>{role.levelText}</Text>
        </View>
        <View style={styles.roleCount}>
          <Text style={styles.countNumber}>{role.count}</Text>
          <Text style={styles.countLabel}>人</Text>
        </View>
      </View>
      <View style={styles.permissionsPreview}>
        {role.permissions.slice(0, 3).map((perm, index) => (
          <View key={index} style={styles.permTag}>
            <Text style={styles.permTagText}>{perm}</Text>
          </View>
        ))}
        {role.permissions.length > 3 && (
          <View style={styles.permTag}>
            <Text style={styles.permTagText}>+{role.permissions.length - 3}</Text>
          </View>
        )}
      </View>
      <View style={styles.roleFooter}>
        <View style={styles.limitInfo}>
          <Icon name="info" size={14} color="#6B7280" />
          <Text style={styles.limitText}>
            人数限制: {ROLE_LIMITS[role.level].text}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addMemberBtn}
          onPress={() => handleAddMember(role)}
        >
          <Icon name="plus" size={14} color="#3B82F6" />
          <Text style={styles.addMemberText}>添加成员</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
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
        <Text style={styles.headerTitle}>角色权限</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statBoxNumber}>105</Text>
            <Text style={styles.statBoxLabel}>总人数</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxNumber}>4</Text>
            <Text style={styles.statBoxLabel}>角色类型</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxNumber}>2/5</Text>
            <Text style={styles.statBoxLabel}>老板级</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>角色列表</Text>

        <View style={styles.roleList}>
          {ROLES.map(renderRoleCard)}
        </View>

        <View style={styles.tipCard}>
          <Icon name="alert-circle" size={20} color="#3B82F6" />
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>权限说明</Text>
            <Text style={styles.tipText}>
              • 老板级拥有最高权限，可管理所有部门{'\n'}
              • 总监级可管理多个部门{'\n'}
              • 主管级仅管理本部门{'\n'}
              • 员工级仅可操作自己的数据
            </Text>
          </View>
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
            {selectedRole && (
              <>
                <View style={styles.modalHeader}>
                  <View style={[styles.modalIcon, { backgroundColor: selectedRole.color + '20' }]}>
                    <Icon name="shield" size={28} color={selectedRole.color} />
                  </View>
                  <Text style={styles.modalTitle}>{selectedRole.name}</Text>
                  <Text style={styles.modalSubtitle}>{selectedRole.levelText}</Text>
                </View>
                <View style={styles.modalStats}>
                  <View style={styles.modalStatItem}>
                    <Text style={styles.modalStatNumber}>{selectedRole.count}</Text>
                    <Text style={styles.modalStatLabel}>当前人数</Text>
                  </View>
                  <View style={styles.modalStatItem}>
                    <Text style={styles.modalStatNumber}>{ROLE_LIMITS[selectedRole.level].text}</Text>
                    <Text style={styles.modalStatLabel}>人数限制</Text>
                  </View>
                </View>
                <Text style={styles.permissionsTitle}>权限列表</Text>
                <ScrollView style={styles.permissionsList}>
                  {selectedRole.permissions.map((perm, index) => (
                    <View key={index} style={styles.permissionItem}>
                      <Icon name="check-circle" size={16} color={selectedRole.color} />
                      <Text style={styles.permissionText}>{perm}</Text>
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.modalCloseBtnText}>关闭</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalManageBtn, { backgroundColor: selectedRole.color }]}
                    onPress={() => {
                      setModalVisible(false);
                      Alert.alert('管理成员', '功能开发中...');
                    }}
                  >
                    <Text style={styles.modalManageBtnText}>管理成员</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.screenPadding,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statBoxNumber: {
    fontSize: 20,
    fontWeight: FontWeight.bold,
    color: '#111827',
  },
  statBoxLabel: {
    fontSize: FontSize.xs,
    color: '#6B7280',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: '#111827',
    marginBottom: 16,
  },
  roleList: {
    gap: 12,
  },
  roleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#111827',
  },
  roleLevelText: {
    fontSize: FontSize.sm,
    color: '#6B7280',
  },
  roleCount: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  countNumber: {
    fontSize: 24,
    fontWeight: FontWeight.bold,
    color: '#111827',
  },
  countLabel: {
    fontSize: FontSize.sm,
    color: '#6B7280',
    marginLeft: 2,
  },
  permissionsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  permTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  permTagText: {
    fontSize: FontSize.xs,
    color: '#6B7280',
  },
  roleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  limitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  limitText: {
    fontSize: FontSize.xs,
    color: '#6B7280',
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addMemberText: {
    fontSize: FontSize.sm,
    color: '#3B82F6',
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  tipContent: {
    flex: 1,
    marginLeft: 12,
  },
  tipTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#1E40AF',
    marginBottom: 8,
  },
  tipText: {
    fontSize: FontSize.sm,
    color: '#1E3A8A',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: FontSize.sm,
    color: '#6B7280',
    marginTop: 4,
  },
  modalStats: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  modalStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  modalStatNumber: {
    fontSize: 20,
    fontWeight: FontWeight.bold,
    color: '#111827',
  },
  modalStatLabel: {
    fontSize: FontSize.xs,
    color: '#6B7280',
    marginTop: 4,
  },
  permissionsTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#111827',
    marginBottom: 12,
  },
  permissionsList: {
    maxHeight: 200,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  permissionText: {
    fontSize: FontSize.sm,
    color: '#4B5563',
    marginLeft: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCloseBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: FontSize.base,
    color: '#6B7280',
  },
  modalManageBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalManageBtnText: {
    fontSize: FontSize.base,
    color: '#FFFFFF',
    fontWeight: FontWeight.semibold,
  },
});

export default RolePermissionScreen;
