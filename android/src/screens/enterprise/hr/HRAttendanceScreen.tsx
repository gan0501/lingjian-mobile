import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/common';
import { FontSize, FontWeight } from '@/constants/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];
const CURRENT_MONTH = new Date().getMonth();
const CURRENT_YEAR = new Date().getFullYear();

const generateCalendarData = () => {
  const daysInMonth = new Date(CURRENT_YEAR, CURRENT_MONTH + 1, 0).getDate();
  const firstDayOfMonth = new Date(CURRENT_YEAR, CURRENT_MONTH, 1).getDay();
  const days = [];
  
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push({ day: '', status: null, isEmpty: true });
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    const randomStatus = Math.random();
    let status = 'normal';
    if (randomStatus < 0.1) status = 'late';
    else if (randomStatus < 0.15) status = 'absent';
    else if (randomStatus < 0.2) status = 'leave';
    else if (randomStatus < 0.25) status = 'overtime';
    
    days.push({
      day: i,
      status: i <= new Date().getDate() ? status : null,
      isEmpty: false,
    });
  }
  
  return days;
};

const ATTENDANCE_STATS = {
  totalDays: 22,
  presentDays: 20,
  lateTimes: 2,
  earlyLeave: 0,
  absentDays: 0,
  leaveDays: 1,
  overtimeHours: 8,
  attendanceRate: '90.9%',
};

const ATTENDANCE_STATUS_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
  Present: { label: '出勤', color: '#16a34a', bgColor: '#dcfce7' },
  Absent: { label: '缺勤', color: '#dc2626', bgColor: '#fee2e2' },
  'On Leave': { label: '请假', color: '#2563eb', bgColor: '#dbeafe' },
  'Half Day': { label: '半天', color: '#d97706', bgColor: '#fef3c7' },
  'Work From Home': { label: '远程', color: '#9333ea', bgColor: '#f3e8ff' },
};

interface Props {
  navigation: any;
}

const HRAttendanceScreen: React.FC<Props> = ({ navigation }) => {
  const [calendarData] = useState(generateCalendarData);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);

  const renderStatCard = useCallback((
    title: string,
    value: string | number,
    icon: string,
    color: string,
    bgColor: string
  ) => (
    <View style={[styles.statCard, { backgroundColor: bgColor }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Icon name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  ), []);

  const renderCalendarDay = useCallback((item: typeof calendarData[0], index: number) => {
    if (item.isEmpty) {
      return <View key={index} style={styles.calendarDay} />;
    }

    let bgColor = 'transparent';
    let textColor = '#1e293b';
    let borderColor = 'transparent';

    switch (item.status) {
      case 'normal':
        bgColor = '#dcfce7';
        textColor = '#16a34a';
        break;
      case 'late':
        bgColor = '#fef3c7';
        textColor = '#d97706';
        borderColor = '#f59e0b';
        break;
      case 'absent':
        bgColor = '#fee2e2';
        textColor = '#dc2626';
        break;
      case 'leave':
        bgColor = '#dbeafe';
        textColor = '#2563eb';
        break;
      case 'overtime':
        bgColor = '#f3e8ff';
        textColor = '#9333ea';
        break;
    }

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.calendarDay,
          { backgroundColor: bgColor, borderWidth: borderColor !== 'transparent' ? 1 : 0, borderColor },
        ]}
        activeOpacity={0.7}
        onPress={() => setSelectedDate(item.day)}
      >
        <Text style={[styles.calendarDayText, { color: textColor }]}>
          {item.day}
        </Text>
      </TouchableOpacity>
    );
  }, [setSelectedDate]);

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
          
          <Text style={styles.headerTitle}>考勤时钟</Text>

          <TouchableOpacity style={styles.filterBtn} activeOpacity={0.7}>
            <Icon name="calendar" size={20} color="#22d3ee" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsGrid}>
          {renderStatCard('出勤率', ATTENDANCE_STATS.attendanceRate, 'trending-up', '#22c55e', '#f0fdf4')}
          {renderStatCard('出勤天数', ATTENDANCE_STATS.presentDays, 'check-circle', '#3b82f6', '#eff6ff')}
          {renderStatCard('迟到次数', ATTENDANCE_STATS.lateTimes, 'clock', '#f59e0b', '#fffbeb')}
          {renderStatCard('加班时长', `${ATTENDANCE_STATS.overtimeHours}h`, 'zap', '#9333ea', '#faf5ff')}
        </View>

        <View style={styles.calendarSection}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity activeOpacity={0.7}>
              <Icon name="chevronLeft" size={20} color="#64748b" />
            </TouchableOpacity>
            <Text style={styles.calendarTitle}>
              {CURRENT_YEAR}年{CURRENT_MONTH + 1}月
            </Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Icon name="chevronRight" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.weekHeader}>
            {WEEK_DAYS.map((day, index) => (
              <Text 
                key={index} 
                style={[
                  styles.weekDayText,
                  index === 0 || index === 6 ? styles.weekendText : null
                ]}
              >
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {calendarData.map(renderCalendarDay)}
          </View>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#dcfce7' }]} />
              <Text style={styles.legendText}>正常</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#fef3c7' }]} />
              <Text style={styles.legendText}>迟到</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#fee2e2' }]} />
              <Text style={styles.legendText}>缺勤</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#dbeafe' }]} />
              <Text style={styles.legendText}>请假</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f3e8ff' }]} />
              <Text style={styles.legendText}>加班</Text>
            </View>
          </View>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>今日打卡记录</Text>
          <View style={styles.checkRecord}>
            <View style={styles.checkItem}>
              <View style={[styles.checkIcon, { backgroundColor: '#dcfce7' }]}>
                <Icon name="log-in" size={16} color="#16a34a" />
              </View>
              <View style={styles.checkInfo}>
                <Text style={styles.checkLabel}>上班打卡</Text>
                <Text style={styles.checkTime}>08:52</Text>
              </View>
              <Text style={[styles.checkStatus, { color: '#16a34a' }]}>正常</Text>
            </View>
            <View style={styles.checkItem}>
              <View style={[styles.checkIcon, { backgroundColor: '#fef3c7' }]}>
                <Icon name="log-out" size={16} color="#d97706" />
              </View>
              <View style={styles.checkInfo}>
                <Text style={styles.checkLabel}>下班打卡</Text>
                <Text style={styles.checkTime}>--:--</Text>
              </View>
              <Text style={[styles.checkStatus, { color: '#94a3b8' }]}>待打卡</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionSection}>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8}>
            <Icon name="camera" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>打卡</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8}>
            <Icon name="file-text" size={18} color="#22d3ee" />
            <Text style={styles.secondaryBtnText}>补卡申请</Text>
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
    backgroundColor: '#f0fdfa',
  },
  safeArea: {
    backgroundColor: '#f0fdfa',
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
    backgroundColor: 'rgba(34,211,238,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  statCard: {
    width: (SCREEN_WIDTH - 32 - 30) / 4,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
  },
  statTitle: {
    fontSize: FontSize.xs,
    color: '#64748b',
    marginTop: 2,
  },
  calendarSection: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
    shadowColor: '#22d3ee',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#1e293b',
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.sm,
    color: '#64748b',
    fontWeight: FontWeight.medium,
  },
  weekendText: {
    color: '#f87171',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: (SCREEN_WIDTH - 64) / 7,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 4,
  },
  calendarDayText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendText: {
    fontSize: FontSize.xs,
    color: '#64748b',
  },
  detailSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
    marginBottom: 12,
  },
  checkRecord: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInfo: {
    flex: 1,
    marginLeft: 12,
  },
  checkLabel: {
    fontSize: FontSize.sm,
    color: '#64748b',
  },
  checkTime: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
    marginTop: 2,
  },
  checkStatus: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  actionSection: {
    marginTop: 20,
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22d3ee',
    borderRadius: 28,
    paddingHorizontal: 32,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#22d3ee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 6,
  },
  secondaryBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: '#22d3ee',
  },
  bottomSpacer: {
    height: 40,
  },
});

export default HRAttendanceScreen;
