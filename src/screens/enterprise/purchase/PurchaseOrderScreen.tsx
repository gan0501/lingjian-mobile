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

type Props = NativeStackScreenProps<RootStackParamList, 'PurchaseOrder'>;

interface OrderItem {
  id: string;
  orderNo: string;
  supplier: string;
  amount: string;
  status: 'pending' | 'approved' | 'completed';
  date: string;
}

const MOCK_ORDERS: OrderItem[] = [
  { id: '1', orderNo: 'PO-2024-001', supplier: '华东建材供应商', amount: '¥125,000', status: 'pending', date: '2024-04-20' },
  { id: '2', orderNo: 'PO-2024-002', supplier: '深圳电子配件', amount: '¥58,500', status: 'approved', date: '2024-04-18' },
  { id: '3', orderNo: 'PO-2024-003', supplier: '北京钢材市场', amount: '¥320,000', status: 'completed', date: '2024-04-15' },
];

const STATUS_CONFIG = {
  pending: { label: '待审批', color: '#F59E0B', bgColor: '#FFFBEB' },
  approved: { label: '已审批', color: '#3B82F6', bgColor: '#EFF6FF' },
  completed: { label: '已完成', color: '#22C55E', bgColor: '#D1FAE5' },
};

const PurchaseOrderScreen: FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [orders] = useState<OrderItem[]>(MOCK_ORDERS);

  const renderOrder = (item: OrderItem) => {
    const statusConfig = STATUS_CONFIG[item.status];
    return (
      <TouchableOpacity key={item.id} style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderNo}>{item.orderNo}</Text>
          <View style={[styles.statusTag, { backgroundColor: statusConfig.bgColor }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
        </View>
        <View style={styles.orderBody}>
          <View style={styles.orderRow}>
            <Icon name="truck" size={14} color="#6B7280" />
            <Text style={styles.orderText}>{item.supplier}</Text>
          </View>
          <View style={styles.orderRow}>
            <Icon name="calendar" size={14} color="#6B7280" />
            <Text style={styles.orderText}>{item.date}</Text>
          </View>
        </View>
        <View style={styles.orderFooter}>
          <Text style={styles.amountLabel}>采购金额</Text>
          <Text style={styles.amountValue}>{item.amount}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="chevronLeft" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>采购订单</Text>
        <TouchableOpacity style={styles.addButton}>
          <Icon name="plus" size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{orders.length}</Text>
          <Text style={styles.statLabel}>订单总数</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{orders.filter(o => o.status === 'pending').length}</Text>
          <Text style={styles.statLabel}>待审批</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>¥503,500</Text>
          <Text style={styles.statLabel}>本月总额</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {orders.map(renderOrder)}
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
  statNumber: { fontSize: 18, fontWeight: FontWeight.bold, color: '#111827' },
  statLabel: { fontSize: FontSize.xs, color: '#6B7280', marginTop: 4 },
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.screenPadding },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderNo: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: '#111827' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  orderBody: { gap: 8, marginBottom: 12 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderText: { fontSize: FontSize.sm, color: '#6B7280' },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  amountLabel: { fontSize: FontSize.sm, color: '#6B7280' },
  amountValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#EF4444' },
});

export default PurchaseOrderScreen;
