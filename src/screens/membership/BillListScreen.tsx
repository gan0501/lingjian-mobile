import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Receipt } from 'lucide-react-native';
import { useAuthStore } from '@/stores';
import { API_CONFIG } from '@/constants/config';
import type { RootStackScreenProps } from '@/navigation/types';

interface BillRecord {
  id: string;
  tool_name: string;
  total_tokens: number;
  total_amount: number;
  created_at: string;
}

const BillListScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RootStackScreenProps<'BillList'>['navigation']>();
  const { token } = useAuthStore();

  const [bills, setBills] = useState<BillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBills = useCallback(async () => {
    if (!token) return;

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/billing/bills`, { headers });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) {
          setBills(json.data);
        }
      }
    } catch (error) {
      console.error('[BillList] fetchBills error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBills();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>消费记录</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#000000']} />
        }
      >
        {bills.length > 0 ? (
          <View style={styles.billsCard}>
            {bills.map((bill, index) => (
              <View
                key={bill.id}
                style={[styles.billItem, index === bills.length - 1 && styles.billItemLast]}
              >
                <View style={styles.billIcon}>
                  <Receipt size={18} color="#666" />
                </View>
                <View style={styles.billInfo}>
                  <Text style={styles.billToolName}>{bill.tool_name}</Text>
                  <Text style={styles.billDate}>{formatDate(bill.created_at)}</Text>
                </View>
                <View style={styles.billAmount}>
                  <Text style={styles.billAmountText}>-¥{bill.total_amount.toFixed(2)}</Text>
                  <Text style={styles.billTokens}>{bill.total_tokens.toLocaleString()} tokens</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无消费记录</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#F5F7FA',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  billsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  billItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  billItemLast: {
    borderBottomWidth: 0,
  },
  billIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  billInfo: {
    flex: 1,
  },
  billToolName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  billDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  billAmount: {
    alignItems: 'flex-end',
  },
  billAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 2,
  },
  billTokens: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});

export default BillListScreen;
