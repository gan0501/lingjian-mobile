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

type Props = NativeStackScreenProps<RootStackParamList, 'SalesOrder'>;

interface OrderItem {
  id: string;
  orderNo: string;
  customer: string;
  product: string;
  amount: string;
  status: 'pending' | 'confirmed' | 'shipping' | 'completed';
  date: string;
}

const MOCK_ORDERS: OrderItem[] = [
  { id: '1', orderNo: 'SO-2024-001', customer: '中建三局', product: '混凝土预制件', amount: '¥850,000', status: 'shipping', date: '2024-04-20' },
  { id: '2', orderNo: 'SO-2024-002', customer: '中铁四局', product: '钢筋网片', amount: '¥320,000', status: 'confirmed', date: '2024-04-18' },
  { id: '3', orderNo: 'SO-2024-003', customer: '江苏建工', product: '预制梁', amount: '¥560,000', status: 'pending', date: '2024-04-16' },
  { id: '4', orderNo: 'SO-2024-004', customer: '浙江建设', product: '混凝土构件', amount: '¥120,000', status: 'completed', date: '2024-04-10' },
];

const STATUS_CONFIG = {
  pending: { label: '待确认', color: '#6B7280', bgColor: '#F3F4F6' },
  confirmed: { label: '已确认', color: '#3B82F6', bgColor: '#EFF6FF' },
  shipping: { label: '发货中', color: '#F59E0B', bgColor: '#FFFBEB' },
  completed: { label: '已完成', color: '#22C55E', bgColor: '#D1FAE5' },
};

const SalesOrderScreen: FC<Props> = ({ navigation }) => {
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
            <Icon name="building" size={14} color="#6B7280" />
            <Text style={styles.orderText}>{item.customer}</Text>
          </View>
          <View style={styles.orderRow}>
            <Icon name="box" size={14} color="#6B7280" />
            <Text style={styles.orderText}>{item.product}</Text>
          </View>
          <View style={styles.orderRow}>
            <Icon name="calendar" size={14} color="#6B7280" />
            <Text style={styles.orderText}>{item.date}</Text>
          </View>
        </View>

        <View style={styles.orderFooter}>
          <Text style={styles.amountLabel}>订单金额</Text>
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
        <Text style={styles.headerTitle}>销售订单</Text>
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
          <Text style={styles.statLabel}>待确认</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>¥1.85M</Text>
          <Text style={styles.statLabel}>本月销售</Text>
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
  amountValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#22C55E' },
});

export default SalesOrderScreen;
