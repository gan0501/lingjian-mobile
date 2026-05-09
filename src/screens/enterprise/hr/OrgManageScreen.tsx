import React, { FC, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/common';
import { Spacing } from '@/constants/spacing';
import { FontSize, FontWeight } from '@/constants/typography';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'OrgManage'>;

interface OrgMenuItem {
  id: string;
  title: string;
  desc: string;
  icon: string;
  color: string;
  bgColor: string;
  screen: keyof RootStackParamList;
}

const ORG_MENU_ITEMS: OrgMenuItem[] = [
  {
    id: 'department',
    title: '部门管理',
    desc: '创建、编辑、删除部门',
    icon: 'folder',
    color: '#3B82F6',
    bgColor: '#EFF6FF',
    screen: 'DepartmentManage',
  },
  {
    id: 'role',
    title: '角色权限',
    desc: '设置权限级别与角色',
    icon: 'shield',
    color: '#22C55E',
    bgColor: '#F0FDF4',
    screen: 'RolePermission',
  },
  {
    id: 'staff',
    title: '人员分配',
    desc: '分配人员到部门与角色',
    icon: 'user-plus',
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    screen: 'StaffAssign',
  },
];

const OrgManageScreen: FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const handleMenuPress = (item: OrgMenuItem) => {
    navigation.navigate(item.screen as any);
  };

  const renderMenuItem = (item: OrgMenuItem) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.menuCard, { backgroundColor: item.bgColor }]}
      activeOpacity={0.7}
      onPress={() => handleMenuPress(item)}
    >
      <View style={styles.menuIconContainer}>
        <Icon name={item.icon as any} size={28} color={item.color} />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{item.title}</Text>
        <Text style={styles.menuDesc}>{item.desc}</Text>
      </View>
      <Icon name="chevronRight" size={20} color="#9CA3AF" />
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
        <Text style={styles.headerTitle}>组织管理</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>组织架构</Text>
          <Text style={styles.sectionDesc}>
            管理企业部门结构、角色权限与人员分配
          </Text>
        </View>

        <View style={styles.menuList}>
          {ORG_MENU_ITEMS.map(renderMenuItem)}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Icon name="info" size={20} color="#3B82F6" />
            <Text style={styles.infoTitle}>权限级别说明</Text>
          </View>
          <View style={styles.infoContent}>
            <View style={styles.infoItem}>
              <View style={[styles.levelDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.infoText}>老板级：拥有所有权限，最多5人</Text>
            </View>
            <View style={styles.infoItem}>
              <View style={[styles.levelDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.infoText}>总监级：管理多个部门</Text>
            </View>
            <View style={styles.infoItem}>
              <View style={[styles.levelDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.infoText}>主管级：管理单个部门</Text>
            </View>
            <View style={styles.infoItem}>
              <View style={[styles.levelDot, { backgroundColor: '#9CA3AF' }]} />
              <Text style={styles.infoText}>员工级：仅查看操作自己的数据</Text>
            </View>
          </View>
        </View>
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
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.screenPadding,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: '#111827',
    marginBottom: 8,
  },
  sectionDesc: {
    fontSize: FontSize.sm,
    color: '#6B7280',
    lineHeight: 20,
  },
  menuList: {
    gap: 12,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  menuIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#111827',
    marginBottom: 4,
  },
  menuDesc: {
    fontSize: FontSize.sm,
    color: '#6B7280',
  },
  infoCard: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#111827',
    marginLeft: 8,
  },
  infoContent: {
    gap: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  infoText: {
    fontSize: FontSize.sm,
    color: '#4B5563',
    lineHeight: 20,
  },
});

export default OrgManageScreen;
