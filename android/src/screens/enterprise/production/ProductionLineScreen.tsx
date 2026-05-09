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

type Props = NativeStackScreenProps<RootStackParamList, 'ProductionLine'>;

interface ProductionLineItem {
  id: string;
  name: string;
  product: string;
  status: 'running' | 'stopped' | 'maintenance';
  output: number;
  target: number;
  workers: number;
}

const MOCK_LINES: ProductionLineItem[] = [
  { id: '1', name: 'A线-主生产线', product: '混凝土预制件', status: 'running', output: 850, target: 1000, workers: 12 },
  { id: '2', name: 'B线-辅助线', product: '钢筋加工', status: 'running', output: 420, target: 500, workers: 8 },
  { id: '3', name: 'C线-特种线', product: '预制梁', status: 'maintenance', output: 0, target: 300, workers: 0 },
];

const STATUS_CONFIG = {
  running: { label: '运行中', color: '#22C55E', bgColor: '#D1FAE5', icon: 'play-circle' },
  stopped: { label: '已停止', color: '#EF4444', bgColor: '#FEE2E2', icon: 'stop-circle' },
  maintenance: { label: '维护中', color: '#F59E0B', bgColor: '#FFFBEB', icon: 'tool' },
};

const ProductionLineScreen: FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [lines] = useState<ProductionLineItem[]>(MOCK_LINES);

  const renderLine = (item: ProductionLineItem) => {
    const statusConfig = STATUS_CONFIG[item.status];
    const progress = item.target > 0 ? (item.output / item.target) * 100 : 0;
    
    return (
      <TouchableOpacity key={item.id} style={styles.lineCard}>
        <View style={styles.lineHeader}>
          <View style={styles.lineTitleRow}>
            <Icon name={statusConfig.icon as any} size={20} color={statusConfig.color} />
            <Text style={styles.lineName}>{item.name}</Text>
          </View>
          <View style={[styles.statusTag, { backgroundColor: statusConfig.bgColor }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
        </View>
        
        <View style={styles.lineBody}>
          <Text style={styles.productLabel}>生产产品</Text>
          <Text style={styles.productName}>{item.product}</Text>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>今日产量</Text>
            <Text style={styles.progressValue}>{item.output} / {item.target}</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: statusConfig.color }]} />
          </View>
        </View>

        <View style={styles.lineFooter}>
          <View style={styles.workerInfo}>
            <Icon name="users" size={14} color="#6B7280" />
            <Text style={styles.workerText}>{item.workers} 人在岗</Text>
          </View>
          <TouchableOpacity style={styles.detailBtn}>
            <Text style={styles.detailBtnText}>查看详情</Text>
            <Icon name="chevronRight" size={14} color="#3B82F6" />
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>生产线管理</Text>
        <TouchableOpacity style={styles.addButton}>
          <Icon name="plus" size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{lines.length}</Text>
          <Text style={styles.statLabel}>生产线</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{lines.filter(l => l.status === 'running').length}</Text>
          <Text style={styles.statLabel}>运行中</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{lines.reduce((sum, l) => sum + l.output, 0)}</Text>
          <Text style={styles.statLabel}>今日产量</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {lines.map(renderLine)}
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
  lineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  lineTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: '#111827' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  lineBody: { marginBottom: 12 },
  productLabel: { fontSize: FontSize.xs, color: '#9CA3AF', marginBottom: 4 },
  productName: { fontSize: FontSize.sm, color: '#374151' },
  progressSection: { marginBottom: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: FontSize.sm, color: '#6B7280' },
  progressValue: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: '#111827' },
  progressBar: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  lineFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  workerInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  workerText: { fontSize: FontSize.sm, color: '#6B7280' },
  detailBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  detailBtnText: { fontSize: FontSize.sm, color: '#3B82F6' },
});

export default ProductionLineScreen;
