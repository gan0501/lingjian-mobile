import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/common';
import { FontSize, FontWeight } from '@/constants/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SALARY_SLIP_STATUS_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
  Draft: { label: '草稿', color: '#64748b', bgColor: '#f1f5f9' },
  Submitted: { label: '已提交', color: '#3b82f6', bgColor: '#eff6ff' },
  Cancelled: { label: '已取消', color: '#ef4444', bgColor: '#fee2e2' },
  Withheld: { label: '暂缓发放', color: '#d97706', bgColor: '#fef3c7' },
  Paid: { label: '已发放', color: '#22c55e', bgColor: '#dcfce7' },
};

const SALARY_DATA = {
  month: '2024年1月',
  payrollFrequency: 'Monthly',
  totalWorkingDays: 22,
  paymentDays: 21,
  baseSalary: 15000,
  housingAllowance: 6000,
  transportAllowance: 500,
  performance: 2000,
  overtime: 800,
  bonus: 500,
  grossPay: 24800,
  deductions: {
    socialInsurance: 1200,
    housingFund: 1800,
    incomeTax: 1590,
    other: 0,
  },
  totalDeduction: 4590,
  netPay: 20210,
  status: 'Draft',
};

const SALARY_HISTORY = [
  { month: '2023年12月', grossPay: 24300, netPay: 19800, status: 'Paid', date: '2024-01-05' },
  { month: '2023年11月', grossPay: 24000, netPay: 19500, status: 'Paid', date: '2023-12-05' },
  { month: '2023年10月', grossPay: 24500, netPay: 19900, status: 'Paid', date: '2023-11-05' },
  { month: '2023年9月', grossPay: 23800, netPay: 19200, status: 'Paid', date: '2023-10-05' },
];

interface Props {
  navigation: any;
}

const HRSalaryScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedMonth, setSelectedMonth] = useState(SALARY_DATA);

  const renderSalaryItem = (label: string, value: number, isDeduction: boolean = false) => (
    <View style={styles.salaryItem}>
      <Text style={styles.salaryLabel}>{label}</Text>
      <Text style={[
        styles.salaryValue,
        { color: isDeduction ? '#ef4444' : '#16a34a' }
      ]}>
        {isDeduction ? '-' : '+'}¥{value.toLocaleString()}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Icon name="chevronLeft" size={22} color="#64748b" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>薪资结算</Text>

          <TouchableOpacity style={styles.filterBtn} activeOpacity={0.7}>
            <Icon name="calendar" size={20} color="#34d399" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.currentMonth}>
          <View style={styles.monthHeader}>
            <Text style={styles.monthTitle}>{selectedMonth.month}</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: selectedMonth.status === 'paid' ? '#dcfce7' : '#fef3c7' }
            ]}>
              <Text style={[
                styles.statusText,
                { color: selectedMonth.status === 'paid' ? '#16a34a' : '#d97706' }
              ]}>
                {selectedMonth.status === 'paid' ? '已发放' : '待发放'}
              </Text>
            </View>
          </View>

          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>实发工资</Text>
            <Text style={styles.totalAmount}>¥{selectedMonth.total.toLocaleString()}</Text>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>收入明细</Text>
            <View style={styles.detailCard}>
              {renderSalaryItem('基本工资', selectedMonth.baseSalary)}
              {renderSalaryItem('绩效奖金', selectedMonth.performance)}
              {renderSalaryItem('加班补贴', selectedMonth.overtime)}
              {renderSalaryItem('其他奖金', selectedMonth.bonus)}
            </View>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>扣除明细</Text>
            <View style={styles.detailCard}>
              {renderSalaryItem('养老保险', selectedMonth.deductions.socialInsurance, true)}
              {renderSalaryItem('住房公积金', selectedMonth.deductions.housingFund, true)}
              {renderSalaryItem('个人所得税', selectedMonth.deductions.tax, true)}
              {selectedMonth.deductions.other > 0 && 
                renderSalaryItem('其他扣款', selectedMonth.deductions.other, true)
              }
            </View>
          </View>

          <View style={styles.calculateSection}>
            <View style={styles.calculateRow}>
              <Text style={styles.calculateLabel}>应发合计</Text>
              <Text style={styles.calculateValue}>
                ¥{(selectedMonth.baseSalary + selectedMonth.performance + selectedMonth.overtime + selectedMonth.bonus).toLocaleString()}
              </Text>
            </View>
            <View style={styles.calculateRow}>
              <Text style={styles.calculateLabel}>扣款合计</Text>
              <Text style={[styles.calculateValue, { color: '#ef4444' }]}>
                -¥{(selectedMonth.deductions.socialInsurance + selectedMonth.deductions.housingFund + selectedMonth.deductions.tax + selectedMonth.deductions.other).toLocaleString()}
              </Text>
            </View>
            <View style={styles.calculateDivider} />
            <View style={styles.calculateRow}>
              <Text style={styles.calculateLabelFinal}>实发工资</Text>
              <Text style={styles.calculateValueFinal}>¥{selectedMonth.total.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>历史记录</Text>
          {SALARY_HISTORY.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.historyCard}
              activeOpacity={0.7}
            >
              <View style={styles.historyInfo}>
                <Text style={styles.historyMonth}>{item.month}</Text>
                <Text style={styles.historyDate}>发放日期: {item.date}</Text>
              </View>
              <View style={styles.historyRight}>
                <Text style={styles.historyAmount}>¥{item.total.toLocaleString()}</Text>
                <View style={styles.historyStatus}>
                  <Icon name="check-circle" size={14} color="#22c55e" />
                  <Text style={styles.historyStatusText}>已发放</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionSection}>
          <TouchableOpacity style={styles.downloadBtn} activeOpacity={0.8}>
            <Icon name="download" size={18} color="#34d399" />
            <Text style={styles.downloadText}>下载工资条</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.questionBtn} activeOpacity={0.8}>
            <Icon name="help-circle" size={18} color="#64748b" />
            <Text style={styles.questionText}>薪资疑问</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0fdf4',
  },
  safeArea: {
    backgroundColor: '#f0fdf4',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(52,211,153,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  currentMonth: {
    marginTop: 8,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  totalCard: {
    backgroundColor: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
    backgroundColor: '#34d399',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#34d399',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  totalLabel: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },
  detailSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
    marginBottom: 10,
  },
  detailCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  salaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  salaryLabel: {
    fontSize: FontSize.sm,
    color: '#64748b',
  },
  salaryValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  calculateSection: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  calculateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  calculateLabel: {
    fontSize: FontSize.sm,
    color: '#64748b',
  },
  calculateValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#1e293b',
  },
  calculateDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 8,
  },
  calculateLabelFinal: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
  },
  calculateValueFinal: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: '#34d399',
  },
  historySection: {
    marginTop: 24,
  },
  historyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  historyInfo: {
    flex: 1,
  },
  historyMonth: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#1e293b',
  },
  historyDate: {
    fontSize: FontSize.xs,
    color: '#94a3b8',
    marginTop: 2,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyAmount: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
  },
  historyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  historyStatusText: {
    fontSize: FontSize.xs,
    color: '#22c55e',
  },
  actionSection: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  downloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  downloadText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#34d399',
  },
  questionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  questionText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#64748b',
  },
  bottomSpacer: {
    height: 40,
  },
});

export default HRSalaryScreen;
