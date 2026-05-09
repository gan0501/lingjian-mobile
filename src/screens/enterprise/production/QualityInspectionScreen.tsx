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

type Props = NativeStackScreenProps<RootStackParamList, 'QualityInspection'>;

interface InspectionItem {
  id: string;
  batchNo: string;
  product: string;
  inspector: string;
  result: 'pass' | 'fail' | 'pending';
  date: string;
  items: number;
}

const MOCK_INSPECTIONS: InspectionItem[] = [
  { id: '1', batchNo: 'QC-2024-001', product: '混凝土预制件A型', inspector: '张工', result: 'pass', date: '2024-04-20', items: 50 },
  { id: '2', batchNo: 'QC-2024-002', product: '钢筋网片', inspector: '李工', result: 'fail', date: '2024-04-19', items: 30 },
  { id: '3', batchNo: 'QC-2024-003', product: '预制梁B型', inspector: '王工', result: 'pending', date: '2024-04-18', items: 20 },
];

const RESULT_CONFIG = {
  pass: { label: '合格', color: '#22C55E', bgColor: '#D1FAE5', icon: 'check-circle' },
  fail: { label: '不合格', color: '#EF4444', bgColor: '#FEE2E2', icon: 'x-circle' },
  pending: { label: '待检', color: '#F59E0B', bgColor: '#FFFBEB', icon: 'clock' },
};

const QualityInspectionScreen: FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [inspections] = useState<InspectionItem[]>(MOCK_INSPECTIONS);

  const renderInspection = (item: InspectionItem) => {
    const resultConfig = RESULT_CONFIG[item.result];
    
    return (
      <TouchableOpacity key={item.id} style={styles.inspectionCard}>
        <View style={styles.cardHeader}>
          <View style={styles.batchInfo}>
            <Icon name="file-text" size={16} color="#6B7280" />
            <Text style={styles.batchNo}>{item.batchNo}</Text>
          </View>
          <View style={[styles.resultTag, { backgroundColor: resultConfig.bgColor }]}>
            <Icon name={resultConfig.icon as any} size={12} color={resultConfig.color} />
            <Text style={[styles.resultText, { color: resultConfig.color }]}>{resultConfig.label}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.productName}>{item.product}</Text>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Icon name="user" size={12} color="#9CA3AF" />
              <Text style={styles.infoText}>{item.inspector}</Text>
            </View>
            <View style={styles.infoItem}>
              <Icon name="calendar" size={12} color="#9CA3AF" />
              <Text style={styles.infoText}>{item.date}</Text>
            </View>
            <View style={styles.infoItem}>
              <Icon name="box" size={12} color="#9CA3AF" />
              <Text style={styles.infoText}>{item.items}件</Text>
            </View>
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
        <Text style={styles.headerTitle}>质量检验</Text>
        <TouchableOpacity style={styles.addButton}>
          <Icon name="plus" size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{inspections.length}</Text>
          <Text style={styles.statLabel}>检验批次</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{inspections.filter(i => i.result === 'pass').length}</Text>
          <Text style={styles.statLabel}>合格</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{inspections.filter(i => i.result === 'fail').length}</Text>
          <Text style={styles.statLabel}>不合格</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>96%</Text>
          <Text style={styles.statLabel}>合格率</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {inspections.map(renderInspection)}
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
  inspectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  batchInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  batchNo: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: '#374151' },
  resultTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  resultText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  cardBody: {},
  productName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: '#111827', marginBottom: 8 },
  infoRow: { flexDirection: 'row', gap: 16 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { fontSize: FontSize.sm, color: '#6B7280' },
});

export default QualityInspectionScreen;
