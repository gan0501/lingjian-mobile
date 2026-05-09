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

type Props = NativeStackScreenProps<RootStackParamList, 'SalesCustomer'>;

interface CustomerItem {
  id: string;
  name: string;
  contact: string;
  phone: string;
  level: 'A' | 'B' | 'C';
  lastOrder: string;
  totalAmount: string;
}

const MOCK_CUSTOMERS: CustomerItem[] = [
  { id: '1', name: '中建三局', contact: '刘总', phone: '138****1234', level: 'A', lastOrder: '2024-04-15', totalAmount: '¥2,350,000' },
  { id: '2', name: '中铁四局', contact: '陈经理', phone: '139****5678', level: 'A', lastOrder: '2024-04-10', totalAmount: '¥1,890,000' },
  { id: '3', name: '江苏建工', contact: '王总', phone: '137****9012', level: 'B', lastOrder: '2024-03-28', totalAmount: '¥560,000' },
  { id: '4', name: '浙江建设', contact: '张经理', phone: '136****3456', level: 'C', lastOrder: '2024-02-20', totalAmount: '¥120,000' },
];

const LEVEL_CONFIG = {
  A: { label: 'A级', color: '#EF4444', bgColor: '#FEE2E2' },
  B: { label: 'B级', color: '#F59E0B', bgColor: '#FFFBEB' },
  C: { label: 'C级', color: '#6B7280', bgColor: '#F3F4F6' },
};

const SalesCustomerScreen: FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [customers] = useState<CustomerItem[]>(MOCK_CUSTOMERS);

  const renderCustomer = (item: CustomerItem) => {
    const levelConfig = LEVEL_CONFIG[item.level];
    
    return (
      <TouchableOpacity key={item.id} style={styles.customerCard}>
        <View style={styles.cardHeader}>
          <View style={styles.customerInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name[0]}</Text>
            </View>
            <View>
              <Text style={styles.customerName}>{item.name}</Text>
              <Text style={styles.contactName}>{item.contact} | {item.phone}</Text>
            </View>
          </View>
          <View style={[styles.levelTag, { backgroundColor: levelConfig.bgColor }]}>
            <Text style={[styles.levelText, { color: levelConfig.color }]}>{levelConfig.label}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>最近下单</Text>
            <Text style={styles.footerValue}>{item.lastOrder}</Text>
          </View>
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>累计金额</Text>
            <Text style={[styles.footerValue, styles.amountText]}>{item.totalAmount}</Text>
          </View>
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
        <Text style={styles.headerTitle}>客户管理</Text>
        <TouchableOpacity style={styles.addButton}>
          <Icon name="plus" size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{customers.length}</Text>
          <Text style={styles.statLabel}>客户总数</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{customers.filter(c => c.level === 'A').length}</Text>
          <Text style={styles.statLabel}>A级客户</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>¥4.92M</Text>
          <Text style={styles.statLabel}>累计成交</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {customers.map(renderCustomer)}
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
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  customerInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFFFFF' },
  customerName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: '#111827' },
  contactName: { fontSize: FontSize.sm, color: '#6B7280', marginTop: 2 },
  levelTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  levelText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  cardFooter: { flexDirection: 'row', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  footerItem: { flex: 1 },
  footerLabel: { fontSize: FontSize.xs, color: '#9CA3AF', marginBottom: 4 },
  footerValue: { fontSize: FontSize.sm, color: '#374151' },
  amountText: { fontWeight: FontWeight.semibold, color: '#EF4444' },
});

export default SalesCustomerScreen;
