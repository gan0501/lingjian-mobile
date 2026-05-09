import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Alert,
  Modal,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { Wallet, Receipt, ChevronRight, ChevronLeft, Plus, CreditCard, Zap, X, Check } from 'lucide-react-native';
import Alipay from '@0x5e/react-native-alipay';
import { useMembershipStore, MEMBER_NAMES } from '@/stores/useMembershipStore';
import { useAuthStore } from '@/stores';
import { API_CONFIG } from '@/constants/config';
import type { RootStackScreenProps } from '@/navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const RECHARGE_AMOUNTS = [
  { amount: 10, label: '10元' },
  { amount: 20, label: '20元' },
  { amount: 50, label: '50元' },
  { amount: 100, label: '100元' },
  { amount: 200, label: '200元' },
  { amount: 300, label: '300元' },
];

interface TokenPrice {
  id: number;
  provider: string;
  model_name: string;
  model_id: string;
  input_price: number;
  output_price: number;
  model_type: string;
  is_active: boolean;
}

interface BillRecord {
  id: string;
  tool_name: string;
  total_tokens: number;
  total_amount: number;
  created_at: string;
}

interface BalanceInfo {
  balance: number;
  total_recharged: number;
  total_consumed: number;
}

const MemberCenterScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RootStackScreenProps<'MemberCenter'>['navigation']>();
  const { membership, isMember, getMemberName, fetchMembership } = useMembershipStore();
  const { token, user } = useAuthStore();
  
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [recentBills, setRecentBills] = useState<BillRecord[]>([]);
  const [tokenPrices, setTokenPrices] = useState<TokenPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rechargeModalVisible, setRechargeModalVisible] = useState(false);
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number>(100);
  const [selectedPayMethod, setSelectedPayMethod] = useState<'alipay'>('alipay');
  const [slideAnim] = useState(new Animated.Value(0));

  const isActive = isMember();

  const fetchData = useCallback(async () => {
    if (!token) return;
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [balanceRes, billsRes, pricesRes] = await Promise.all([
        fetch(`${API_CONFIG.BASE_URL}/api/billing/balance`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/api/billing/bills?limit=5`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/api/billing/token-prices`),
      ]);

      if (balanceRes.ok) {
        const json = await balanceRes.json();
        if (json.success && json.data) {
          setBalance(json.data);
        }
      }

      if (billsRes.ok) {
        const json = await billsRes.json();
        if (json.success && json.data) {
          setRecentBills(json.data.slice(0, 5));
        }
      }

      if (pricesRes.ok) {
        const json = await pricesRes.json();
        if (json.success && json.data) {
          setTokenPrices(json.data);
        }
      }

      await fetchMembership(token);
    } catch (error) {
      console.error('[MemberCenter] fetchData error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, fetchMembership]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const openRechargeModal = () => {
    setRechargeModalVisible(true);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeRechargeModal = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setRechargeModalVisible(false);
    });
  };

  const handlePayResult = (result: any) => {
    const { resultStatus, memo } = result;

    switch (resultStatus) {
      case '9000':
        Alert.alert('支付成功', `您已成功充值${selectedAmount}元！`, [
          { text: '确定', onPress: () => {
            closeRechargeModal();
            fetchData();
          }},
        ]);
        break;
      case '6001':
        Alert.alert('支付取消', '您已取消支付');
        break;
      case '6002':
        Alert.alert('网络错误', '网络连接失败，请检查网络');
        break;
      case '4000':
        Alert.alert('支付失败', memo || '支付失败，请稍后重试');
        break;
      default:
        Alert.alert('支付结果', memo || '未知状态');
    }
  };

  const handleRecharge = async () => {
    if (!token) {
      Alert.alert('错误', '请先登录');
      return;
    }
    
    setRechargeLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/billing/create_recharge_order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: selectedAmount * 100, pay_method: 'alipay' }),
      });
      
      const json = await response.json();
      if (json.success && json.data?.orderInfo) {
        const payResult = await Alipay.pay(json.data.orderInfo);
        handlePayResult(payResult);
      } else {
        Alert.alert('提示', json.message || '创建订单失败');
      }
    } catch (error) {
      console.error('充值失败:', error);
      Alert.alert('错误', '创建订单失败');
    } finally {
      setRechargeLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('zh-CN');
    } catch {
      return dateStr;
    }
  };

  const formatAmount = (amount: number) => {
    return `¥${(amount || 0).toFixed(2)}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />
      
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color="#1A1A2E" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>会员中心</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#B20000']} />
        }
      >
        <View style={styles.statusCardContainer}>
          <Image
            source={require('@/assets/images/card.jpg')}
            style={styles.cardBackground}
            resizeMode="cover"
          />
          <View style={styles.statusCard}>
            
            <View style={styles.statusHeader}>
              <View style={styles.statusLeft}>
                <View style={styles.logoContainer}>
                  <Image 
                    source={require('@/assets/images/icon-64.png')} 
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.statusText}>
                  <Text style={[styles.statusLabel, { color: isActive ? 'rgba(255,255,255,0.7)' : '#6B7280' }]}>
                    当前等级
                  </Text>
                  <Text style={[styles.statusName, { color: isActive ? '#FFFFFF' : '#374151' }]}>
                    {getMemberName()}
                  </Text>
                </View>
              </View>
            </View>
            
            <View style={styles.cardDivider} />
            
            <View style={styles.cardFooter}>
              {isActive && membership.expiredAt && (
                <Text style={styles.expiryText}>
                  有效期至 {formatDate(membership.expiredAt)}
                </Text>
              )}
              
              {/* 会员卡号装饰 */}
              {isActive && (
                <Text style={styles.cardNumber}>
                  MEMBER · {String((user as any)?.id || '0000').padStart(4, '0')}
                </Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <View style={styles.balanceTitleRow}>
              <Wallet size={20} color="#B20000" />
              <Text style={styles.balanceTitle}>账户余额</Text>
            </View>
          </View>
          <View style={styles.balanceRow}>
            <View style={styles.balanceAmountContainer}>
              <Text style={styles.balanceCurrency}>¥</Text>
              <Text style={styles.balanceAmount}>
                {(balance?.balance || 0).toFixed(2)}
              </Text>
            </View>
            <TouchableOpacity style={styles.rechargeBtn} onPress={openRechargeModal}>
              <Plus size={14} color="#FFF" />
              <Text style={styles.rechargeBtnText}>充值</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.balanceStats}>
            <View style={styles.balanceStatItem}>
              <Text style={styles.balanceStatLabel}>累计充值</Text>
              <Text style={styles.balanceStatValue}>¥{(balance?.total_recharged || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.balanceStatDivider} />
            <View style={styles.balanceStatItem}>
              <Text style={styles.balanceStatLabel}>累计消费</Text>
              <Text style={styles.balanceStatValue}>¥{(balance?.total_consumed || 0).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Receipt size={18} color="#B20000" />
              <Text style={styles.sectionTitle}>最近消费</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('BillList')}>
              <Text style={styles.seeAllText}>查看全部</Text>
            </TouchableOpacity>
          </View>
          
          {recentBills.length > 0 ? (
            <View style={styles.billsCard}>
              {recentBills.map((bill, index) => (
                <View 
                  key={bill.id} 
                  style={[styles.billItem, index === recentBills.length - 1 && styles.billItemLast]}
                >
                  <View style={styles.billInfo}>
                    <Text style={styles.billToolName}>{bill.tool_name}</Text>
                    <Text style={styles.billDate}>{formatDate(bill.created_at)}</Text>
                  </View>
                  <View style={styles.billAmount}>
                    <Text style={styles.billAmountText}>-{formatAmount(bill.total_amount)}</Text>
                    <Text style={styles.billTokens}>{bill.total_tokens} tokens</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyBills}>
              <Text style={styles.emptyBillsText}>暂无消费记录</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Zap size={18} color="#B20000" />
              <Text style={styles.sectionTitle}>Token 价格标准</Text>
            </View>
          </View>
          
          <View style={styles.pricesCard}>
            <View style={styles.priceHeader}>
              <Text style={[styles.priceHeaderCell, { flex: 2 }]}>模型</Text>
              <Text style={[styles.priceHeaderCell, { flex: 1 }]}>输入</Text>
              <Text style={[styles.priceHeaderCell, { flex: 1 }]}>输出</Text>
            </View>
            {tokenPrices.slice(0, 8).map((price, index) => (
              <View 
                key={price.id} 
                style={[styles.priceRow, index === Math.min(tokenPrices.length, 8) - 1 && styles.priceRowLast]}
              >
                <Text style={[styles.priceModelName, { flex: 2 }]} numberOfLines={1}>
                  {price.model_name}
                </Text>
                <Text style={[styles.priceValue, { flex: 1 }]}>
                  ¥{price.input_price}/M
                </Text>
                <Text style={[styles.priceValue, { flex: 1 }]}>
                  ¥{price.output_price}/M
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.priceNote}>价格单位：元/百万Token</Text>
        </View>

        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.renewButton}
            onPress={() => navigation.navigate('MembershipPay')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#C02020', '#8B0000']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.renewButtonGradient}
            >
              <Text style={styles.renewButtonText}>
                {isActive ? '续费会员' : '开通会员'}
              </Text>
              <ChevronRight size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 充值底部弹窗 */}
      <Modal
        visible={rechargeModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeRechargeModal}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={closeRechargeModal}
          />
          <Animated.View 
            style={[
              styles.bottomSheet,
              {
                transform: [{
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [500, 0],
                  })
                }]
              }
            ]}
          >
            <View style={styles.bottomSheetHandle} />
            
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>余额充值</Text>
              <TouchableOpacity onPress={closeRechargeModal} style={styles.closeButton}>
                <X size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.bottomSheetContent}>
              <Text style={styles.sectionLabel}>选择金额</Text>
              <View style={styles.amountGrid}>
                {RECHARGE_AMOUNTS.map((item) => (
                  <TouchableOpacity
                    key={item.amount}
                    style={[
                      styles.amountItem,
                      selectedAmount === item.amount && styles.amountItemSelected,
                    ]}
                    onPress={() => setSelectedAmount(item.amount)}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.amountText,
                      selectedAmount === item.amount && styles.amountTextSelected,
                    ]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>支付方式</Text>
              <TouchableOpacity
                style={[styles.payMethodItem, styles.payMethodSelected]}
                activeOpacity={0.8}
              >
                <Image
                  source={require('@/assets/images/alipay.png')}
                  style={styles.payMethodIcon}
                />
                <Text style={styles.payMethodName}>支付宝</Text>
                <View style={styles.payMethodCheck}>
                  <Check size={14} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>

            <View style={[styles.bottomSheetFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <TouchableOpacity
                style={[styles.payButton, rechargeLoading && styles.payButtonDisabled]}
                onPress={handleRecharge}
                disabled={rechargeLoading}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#C02020', '#8B0000']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.payButtonGradient}
                >
                  <Text style={styles.payButtonText}>
                    {rechargeLoading ? '支付中...' : `立即充值 ¥${selectedAmount}`}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
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
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  statusCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    marginLeft: 16,
  },
  statusLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  statusName: {
    fontSize: 20,
    fontWeight: '700',
  },
  expiryText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rechargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#B20000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  rechargeBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  balanceAmountContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  balanceCurrency: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A2E',
    marginTop: 4,
    marginRight: 2,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  balanceStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
  },
  balanceStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E7EB',
  },
  balanceStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  balanceStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  seeAllText: {
    fontSize: 13,
    color: '#6B7280',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  billItemLast: {
    borderBottomWidth: 0,
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
  emptyBills: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyBillsText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  pricesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  priceHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  priceHeaderCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  priceRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  priceRowLast: {
    borderBottomWidth: 0,
  },
  priceModelName: {
    fontSize: 12,
    color: '#374151',
  },
  priceValue: {
    fontSize: 12,
    color: '#6B7280',
  },
  priceNote: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'right',
  },
  actionSection: {
    marginTop: 8,
  },
  renewButton: {
    borderRadius: 25,
    height: 50,
    overflow: 'hidden',
  },
  renewButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  renewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 4,
  },
  
  // 会员卡新样式
  statusCardContainer: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    position: 'relative',
  },
  cardBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  statusCard: {
    borderRadius: 20,
    padding: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  glowOrb: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  glowOrbTopRight: {
    top: -60,
    right: -40,
  },
  glowOrbBottomLeft: {
    bottom: -60,
    left: -40,
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  goldWave: {
    position: 'absolute',
    top: -50,
    left: -50,
    right: -50,
    height: 180,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderRadius: 100,
    transform: [{ rotate: '-8deg' }, { scaleX: 1.5 }],
  },
  goldWave2: {
    position: 'absolute',
    top: -30,
    left: -30,
    right: -30,
    height: 140,
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderRadius: 80,
    transform: [{ rotate: '-5deg' }, { scaleX: 1.3 }],
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  noiseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.03,
    backgroundColor: '#fff',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardNumber: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
  
  modalContainer: {
    flex: 1,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSheetContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  amountItem: {
    width: (SCREEN_WIDTH - 40 - 20) / 3,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F5F7FA',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountItemSelected: {
    borderColor: '#B20000',
    backgroundColor: 'rgba(178,0,0,0.05)',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  amountTextSelected: {
    color: '#B20000',
  },
  bonusText: {
    fontSize: 11,
    color: '#FF6B00',
    marginTop: 4,
  },
  checkIcon: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#B20000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F5F7FA',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  payMethodSelected: {
    borderColor: '#B20000',
    backgroundColor: 'rgba(178,0,0,0.05)',
  },
  payMethodIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    resizeMode: 'contain',
  },
  payMethodName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A2E',
    marginLeft: 12,
  },
  payMethodCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#B20000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSheetFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
  },
  payButton: {
    borderRadius: 25,
    height: 50,
    overflow: 'hidden',
  },
  payButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MemberCenterScreen;
