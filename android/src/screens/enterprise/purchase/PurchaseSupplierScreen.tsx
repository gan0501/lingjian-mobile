import React, { FC, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/common';
import { Spacing } from '@/constants/spacing';
import { FontSize, FontWeight } from '@/constants/typography';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PurchaseSupplier'>;

interface SupplierItem {
  id: string;
  name: string;
  category: string;
  contact: string;
  phone: string;
  status: 'active' | 'inactive';
}

const MOCK_SUPPLIERS: SupplierItem[] = [
  { id: '1', name: '华东建材供应商', category: '建材', contact: '张经理', phone: '138****1234', status: 'active' },
  { id: '2', name: '深圳电子配件', category: '电子', contact: '李总', phone: '139****5678', status: 'active' },
  { id: '3', name: '北京钢材市场', category: '钢材', contact: '王经理', phone: '137****9012', status: 'active' },
];

const PurchaseSupplierScreen: FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [suppliers] = useState<SupplierItem[]>(MOCK_SUPPLIERS);

  const renderSupplier = (item: SupplierItem) => (
    <TouchableOpacity key={item.id} style={styles.supplierCard}>
      <View style={styles.supplierHeader}>
        <View style={styles.supplierIcon}>
          <Icon name="truck" size={20} color="#3B82F6" />
        </View>
        <View style={styles.supplierInfo}>
          <Text style={styles.supplierName}>{item.name}</Text>
          <Text style={styles.supplierCategory}>{item.category}</Text>
        </View>
        <View style={[styles.statusTag, item.status === 'active' ? styles.statusActive : styles.statusInactive]}>
          <Text style={styles.statusText}>{item.status === 'active' ? '合作中' : '已停用'}</Text>
        </View>
      </View>
      <View style={styles.supplierFooter}>
        <View style={styles.contactInfo}>
          <Icon name="user" size={14} color="#6B7280" />
          <Text style={styles.contactText}>{item.contact}</Text>
        </View>
        <View style={styles.contactInfo}>
          <Icon name="phone" size={14} color="#6B7280" />
          <Text style={styles.contactText}>{item.phone}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="chevronLeft" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>供应商管理</Text>
        <TouchableOpacity style={styles.addButton}>
          <Icon name="plus" size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{suppliers.length}</Text>
          <Text style={styles.statLabel}>供应商总数</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{suppliers.filter(s => s.status === 'active').length}</Text>
          <Text style={styles.statLabel}>合作中</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>5</Text>
          <Text style={styles.statLabel}>采购订单</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {suppliers.map(renderSupplier)}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
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
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 8 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: '#111827' },
  addButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: Spacing.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: FontWeight.bold, color: '#111827' },
  statLabel: { fontSize: FontSize.xs, color: '#6B7280', marginTop: 4 },
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.screenPadding },
  supplierCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  supplierHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  supplierIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  supplierInfo: { flex: 1 },
  supplierName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: '#111827' },
  supplierCategory: { fontSize: FontSize.sm, color: '#6B7280', marginTop: 2 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusActive: { backgroundColor: '#D1FAE5' },
  statusInactive: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  supplierFooter: { flexDirection: 'row', gap: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  contactInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  contactText: { fontSize: FontSize.sm, color: '#6B7280' },
});

export default PurchaseSupplierScreen;
