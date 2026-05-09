import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { API_CONFIG } from '@/constants';
import { DayColors } from '@/constants';
import { Spacing, BorderRadius } from '@/constants';
import { TextStyles, FontSize } from '@/constants';
import { useAuthStore } from '@/stores';
import { BackButton } from '@/components/common';
import { useOverlay } from '@/components/overlay';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TOOL_ICON_MAP: Record<string, string> = {
  bid_writer: '📝',
  load_calculator: '🏗️',
  building_3d: '🏙️',
  cad_viewer: '📐',
};

interface TokenPriceModel {
  name: string;
  pricePer1M: number;
  logoUrl?: string;
}

interface BillItem {
  id: string;
  toolName: string;
  toolIcon: string;
  totalTokens: number;
  totalAmount: number;
  date: string;
  time: string;
  steps: { name: string; tokens: number; amount: number }[];
  modelName: string;
  balanceAfter: number;
}

type TabId = 'today_price' | 'my_resource' | 'my_bills';

interface TabInfo {
  id: TabId;
  label: string;
  badge?: string;
}

export default function TokenPriceScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const overlay = useOverlay();
  const [activeTab, setActiveTab] = useState<TabId>('today_price');
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [tokenPrices, setTokenPrices] = useState<TokenPriceModel[]>([]);
  const [userBalance, setUserBalance] = useState(0);
  const [bills, setBills] = useState<BillItem[]>([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const { token } = useAuthStore();

  const fetchTokenPrices = useCallback(async () => {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/billing/token-prices`);
    const json = await res.json();
    if (json.success && json.data) {
      const prices: TokenPriceModel[] = json.data.map((item: any) => ({
        name: item.model_name,
        pricePer1M: parseFloat(item.input_price),
      }));
      setTokenPrices(prices);
    }
  }, []);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/api/billing/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setUserBalance(parseFloat(json.data.balance || 0));
        return;
      }
    } catch (e) {
      console.warn('获取余额失败', e);
    }
    setUserBalance(0);
  }, [token]);

  const fetchBills = useCallback(async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/api/billing/bills?days=30`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        const mapped: BillItem[] = json.data.map((b: any) => {
          const createdAt = new Date(b.created_at);
          const steps = (b.steps || []).map((s: any) => ({
            name: s.step_name,
            tokens: s.tokens || (s.input_tokens + s.output_tokens),
            amount: s.amount,
          }));
          return {
            id: b.bill_id,
            toolName: b.tool_name,
            toolIcon: TOOL_ICON_MAP[b.tool_id] || '🤖',
            totalTokens: b.total_tokens,
            totalAmount: b.total_amount,
            date: createdAt.toISOString().split('T')[0],
            time: `${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`,
            steps,
            modelName: b.model_name || '',
            balanceAfter: b.balance_after,
          };
        });
        setBills(mapped);
      }
      const summaryRes = await fetch(`${API_CONFIG.BASE_URL}/api/billing/bills/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const summaryJson = await summaryRes.json();
      if (summaryJson.success && summaryJson.data) {
        setMonthTotal(summaryJson.data.total_amount);
      }
    } catch (e) {
      console.warn('获取账单失败', e);
    }
  }, [token]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchTokenPrices(), fetchBalance(), fetchBills()]);
      setLoading(false);
    };
    load();
  }, []);

  const now = new Date();
  const todayBadge = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const tabs: TabInfo[] = [
    { id: 'today_price', label: '模型价格', badge: todayBadge },
    { id: 'my_resource', label: '我的资源', badge: `¥${userBalance.toFixed(2)}` },
    { id: 'my_bills', label: '我的账单', badge: bills.length > 0 ? `${bills.length}笔` : undefined },
  ];

  const calculateTokens = (pricePer1M: number): string => {
    if (pricePer1M <= 0) return '0';
    const tokens = (userBalance / pricePer1M) * 1000000;
    if (tokens >= 10000) {
      return (tokens / 10000).toFixed(2) + '万';
    }
    return Math.floor(tokens).toString();
  };

  const calculateWords = (pricePer1M: number): string => {
    if (pricePer1M <= 0) return '0';
    const tokens = (userBalance / pricePer1M) * 1000000;
    const words = tokens * 0.6;
    if (words >= 10000) {
      return (words / 10000).toFixed(2) + '万';
    }
    return Math.floor(words).toString();
  };

  const groupedBills: { [date: string]: BillItem[] } = {};
  bills.forEach((bill: BillItem) => {
    if (!groupedBills[bill.date]) groupedBills[bill.date] = [];
    groupedBills[bill.date].push(bill);
  });

  const formatDate = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dateStr === today) return '今天';
    if (dateStr === yesterday) return '昨天';
    return dateStr.slice(5);
  };

  const renderBillItem = (bill: BillItem) => {
    const isExpanded = expandedBillId === bill.id;
    return (
      <View key={bill.id}>
        <TouchableOpacity
          style={styles.billItem}
          activeOpacity={0.7}
          onPress={() => setExpandedBillId(isExpanded ? null : bill.id)}
        >
          <View style={styles.billItemLeft}>
            <Text style={styles.billIcon}>{bill.toolIcon}</Text>
            <View>
              <Text style={styles.billToolName}>{bill.toolName}</Text>
              <Text style={styles.billMeta}>{bill.time} · {bill.modelName}</Text>
            </View>
          </View>
          <View style={styles.billItemRight}>
            <Text style={styles.billAmount}>-¥{bill.totalAmount.toFixed(2)}</Text>
            <Text style={styles.billTokens}>{bill.totalTokens.toLocaleString()} tokens</Text>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <Image
                source={require('@/assets/images/icon-logo.png')}
                style={styles.receiptLogoImage}
              />
              <Text style={styles.receiptLogoText}>领建</Text>
            </View>
            <Text style={styles.receiptOrderId}>{bill.id}</Text>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptRow}>
              <Text style={[styles.receiptColHeader, { flex: 2 }]}>步骤</Text>
              <Text style={[styles.receiptColHeader, { flex: 1, textAlign: 'right' }]}>Tokens</Text>
              <Text style={[styles.receiptColHeader, { flex: 1, textAlign: 'right' }]}>金额</Text>
            </View>

            {bill.steps.map((step, idx) => (
              <View key={idx} style={styles.receiptRow}>
                <Text style={[styles.receiptValue, { flex: 2 }]}>{step.name}</Text>
                <Text style={[styles.receiptValueMono, { flex: 1, textAlign: 'right' }]}>
                  {step.tokens.toLocaleString()}
                </Text>
                <Text style={[styles.receiptValueMono, { flex: 1, textAlign: 'right' }]}>
                  ¥{step.amount.toFixed(2)}
                </Text>
              </View>
            ))}

            <View style={styles.receiptDividerDashed} />

            <View style={styles.receiptRow}>
              <Text style={[styles.receiptTotalLabel, { flex: 2 }]}>合计</Text>
              <Text style={[styles.receiptTotalValue, { flex: 1, textAlign: 'right' }]}>
                {bill.totalTokens.toLocaleString()}
              </Text>
              <Text style={[styles.receiptTotalValue, { flex: 1, textAlign: 'right' }]}>
                ¥{bill.totalAmount.toFixed(2)}
              </Text>
            </View>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptFooter}>
              <Text style={styles.receiptBalanceText}>扣费后余额: ¥{bill.balanceAfter.toFixed(2)}</Text>
              <Text style={styles.receiptTimestamp}>{bill.date} {bill.time}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.rootContainer}>
      <View style={[styles.fixedHeader, { paddingTop: insets.top + 10 }]}>
        <View style={styles.navBar}>
          <BackButton
            onPress={() => navigation.goBack()}
          />
          <Text style={styles.headerTitle}>账单</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {tab.badge && (
                  <Text style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                    {tab.badge}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'today_price' && (
          <View>
            <Text style={styles.dateLabel}>
              {new Date().getFullYear()}.{String(new Date().getMonth() + 1).padStart(2, '0')}.{String(new Date().getDate()).padStart(2, '0')}  {['周日','周一','周二','周三','周四','周五','周六'][new Date().getDay()]}
            </Text>
            <View style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 1.5 }]}>模型</Text>
                <Text style={[styles.th, { flex: 1 }]}>价格</Text>
              </View>
              {tokenPrices.map((item: TokenPriceModel, index: number) => (
                <View key={index} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
                  <View style={[styles.logoNameContainer, { flex: 1.5 }]}>
                    {item.logoUrl ? (
                      <View style={styles.fakeLogo}>
                        <Text style={styles.fakeLogoText}>{item.logoUrl}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.td}>{item.name}</Text>
                  </View>
                  <Text style={[styles.tdHighlight, { flex: 1 }]}>
                    ￥{item.pricePer1M.toFixed(2)}/100万
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'my_resource' && (
          <View style={styles.tableCard}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 1.5 }]}>模型</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>兑换token数</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>相当字数</Text>
            </View>
            {tokenPrices.map((item: TokenPriceModel, index: number) => (
              <View key={index} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
                <View style={[styles.logoNameContainer, { flex: 1.5 }]}>
                  {item.logoUrl ? (
                    <View style={[styles.fakeLogo, { width: 14, height: 14, marginRight: 6 }]}>
                      <Text style={[styles.fakeLogoText, { fontSize: 10 }]}>{item.logoUrl}</Text>
                    </View>
                  ) : null}
                  <Text style={[styles.td, { fontSize: 11 }]}>{item.name}</Text>
                </View>
                <Text style={[styles.tdToken, { flex: 1.2 }]}>{calculateTokens(item.pricePer1M)}</Text>
                <Text style={[styles.tdWord, { flex: 1.2 }]}>{calculateWords(item.pricePer1M)}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'my_bills' && (
          <View>
            <View style={styles.monthSummaryCard}>
              <View style={styles.monthSummaryLeft}>
                <Text style={styles.monthSummaryLabel}>本月消费</Text>
                <Text style={styles.monthSummaryAmount}>¥{monthTotal.toFixed(2)}</Text>
              </View>
              <View style={styles.monthSummaryDivider} />
              <View style={styles.monthSummaryRight}>
                <Text style={styles.monthSummaryLabel}>共计</Text>
                <Text style={styles.monthSummaryCount}>{bills.length} 笔</Text>
              </View>
            </View>

            {Object.keys(groupedBills).map(date => (
              <View key={date} style={styles.billDateGroup}>
                <Text style={styles.billDateLabel}>{formatDate(date)}</Text>
                {groupedBills[date].map(bill => renderBillItem(bill))}
              </View>
            ))}

            <Text style={styles.billFooterNote}>仅显示最近 30 天的账单记录</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: DayColors.background,
  },

  fixedHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: DayColors.text,
  },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: DayColors.surfaceSecondary,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: DayColors.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: DayColors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: DayColors.textSecondary,
  },
  tabLabelActive: {
    color: DayColors.text,
    fontWeight: '700',
  },
  tabBadge: {
    fontSize: 9,
    color: DayColors.textTertiary,
    marginTop: 2,
  },
  tabBadgeActive: {
    color: '#B20000',
    fontWeight: '600',
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  dateLabel: {
    fontSize: 13,
    color: DayColors.textSecondary,
    marginBottom: 10,
    marginLeft: 2,
    fontWeight: '500',
  },

  tableCard: {
    backgroundColor: DayColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DayColors.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: DayColors.border,
    paddingBottom: 12,
    paddingTop: 8,
  },
  th: {
    fontSize: 12,
    fontWeight: 'bold',
    color: DayColors.text,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: DayColors.surfaceSecondary,
  },
  td: {
    fontSize: 12,
    color: DayColors.text,
    textAlign: 'center',
  },
  logoNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fakeLogo: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: DayColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  fakeLogoText: {
    color: DayColors.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  tdHighlight: {
    fontSize: 12,
    color: '#4CAF50',
    textAlign: 'center',
    fontWeight: '500',
  },
  tdToken: {
    fontSize: 12,
    color: '#4CAF50',
    textAlign: 'center',
    fontWeight: '500',
  },
  tdWord: {
    fontSize: 12,
    color: '#2196F3',
    textAlign: 'center',
    fontWeight: '500',
  },

  monthSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DayColors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DayColors.border,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  monthSummaryLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  monthSummaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: DayColors.border,
    marginHorizontal: 16,
  },
  monthSummaryRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  monthSummaryLabel: {
    fontSize: 12,
    color: DayColors.textSecondary,
    marginBottom: 6,
  },
  monthSummaryAmount: {
    fontSize: 26,
    fontWeight: '700',
    color: DayColors.text,
    fontFamily: 'monospace',
  },
  monthSummaryCount: {
    fontSize: 20,
    fontWeight: '600',
    color: DayColors.text,
  },

  billDateGroup: {
    marginBottom: 16,
  },
  billDateLabel: {
    fontSize: 13,
    color: DayColors.textSecondary,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  billItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: DayColors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: DayColors.border,
  },
  billItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  billIcon: {
    fontSize: 24,
  },
  billToolName: {
    fontSize: 14,
    color: DayColors.text,
    fontWeight: '600',
  },
  billMeta: {
    fontSize: 11,
    color: DayColors.textTertiary,
    marginTop: 2,
  },
  billItemRight: {
    alignItems: 'flex-end',
  },
  billAmount: {
    fontSize: 15,
    color: '#FF6B6B',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  billTokens: {
    fontSize: 10,
    color: DayColors.textTertiary,
    marginTop: 2,
  },

  receiptCard: {
    backgroundColor: '#FEFEFE',
    borderRadius: 14,
    marginHorizontal: 2,
    marginBottom: 10,
    marginTop: -4,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 4,
  },
  receiptLogoImage: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  receiptLogoText: {
    fontSize: 15,
    fontWeight: '800',
    color: DayColors.text,
    letterSpacing: 1,
  },
  receiptOrderId: {
    fontSize: 10,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 2,
    fontFamily: 'monospace',
  },
  receiptDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginVertical: 10,
  },
  receiptDividerDashed: {
    height: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D5D5D5',
    marginVertical: 10,
  },
  receiptRow: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  receiptColHeader: {
    fontSize: 10,
    color: '#aaa',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  receiptValue: {
    fontSize: 12,
    color: '#444',
  },
  receiptValueMono: {
    fontSize: 12,
    color: '#444',
    fontFamily: 'monospace',
  },
  receiptTotalLabel: {
    fontSize: 13,
    color: DayColors.text,
    fontWeight: '700',
  },
  receiptTotalValue: {
    fontSize: 13,
    color: '#B20000',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  receiptFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptBalanceText: {
    fontSize: 11,
    color: '#888',
  },
  receiptTimestamp: {
    fontSize: 10,
    color: '#aaa',
    fontFamily: 'monospace',
  },

  billFooterNote: {
    textAlign: 'center',
    fontSize: 11,
    color: DayColors.textTertiary,
    marginTop: 16,
    marginBottom: 10,
  },
});
