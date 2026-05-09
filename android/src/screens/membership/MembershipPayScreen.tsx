import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Check, Crown, Zap, Users, Brain, ChevronLeft, Search, BookOpen } from 'lucide-react-native';
import Alipay from '@0x5e/react-native-alipay';
import { API_CONFIG } from '@/constants/config';
import { useMembershipStore } from '@/stores/useMembershipStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMessageStore } from '@/stores/useMessageStore';
import type { RootStackScreenProps } from '@/navigation/types';

type PaymentMethod = 'alipay' | 'wechat';
type MembershipPlan = 'trial' | 'monthly' | 'quarterly' | 'yearly';

const MEMBERSHIP_PLANS: Record<MembershipPlan, { name: string; price: number; duration: number; durationUnit: 'day' | 'month'; popular?: boolean; trial?: boolean }> = {
  trial: { name: '首次体验', price: 1.00, duration: 7, durationUnit: 'day', trial: true },
  monthly: { name: '月度会员', price: 18.80, duration: 1, durationUnit: 'month' },
  quarterly: { name: '季度会员', price: 48.80, duration: 3, durationUnit: 'month', popular: true },
  yearly: { name: '年度会员', price: 168.80, duration: 12, durationUnit: 'month' },
};

const C = {
  bg: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceSub: '#F0F2F5',
  text: '#1A1A2E',
  textSub: '#6B7280',
  textMuted: '#9CA3AF',
  accent: '#B20000',
  accentLight: 'rgba(178,0,0,0.08)',
  border: '#E5E7EB',
  borderActive: '#B20000',
  checkColor: '#B20000',
  iconBg: 'rgba(178,0,0,0.08)',
  iconBorder: 'rgba(178,0,0,0.2)',
  iconColor: '#B20000',
  badgeBg: '#B20000',
  btnGrad1: '#C02020',
  btnGrad2: '#8B0000',
  radioActive: '#B20000',
  radioBorder: 'rgba(0,0,0,0.2)',
};

const MembershipPayScreen: React.FC<RootStackScreenProps<'MembershipPay'>> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan>('quarterly');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('alipay');
  const [loading, setLoading] = useState(false);
  const { setMembership, membership } = useMembershipStore();
  const trialUsed = membership.trialUsed;

  const benefits = [
    { icon: Zap, title: '无限项目跟进', desc: '不限制跟进项目数量' },
    { icon: Search, title: 'AI自动找项目', desc: '智能匹配，自动推送合适项目' },
    { icon: Users, title: '团队协作', desc: '邀请队友一起跟进项目' },
    { icon: Brain, title: 'AI智能助手', desc: '智能辅助、决策分析、跟进总结' },
    { icon: BookOpen, title: '找资源无限制', desc: '规范/图集/信息价板块无限查看' },
    { icon: Crown, title: 'AI牛马体', desc: '写标书、桩基比选...等功能只需支付token费用' },
  ];

  const currentPlan = MEMBERSHIP_PLANS[selectedPlan];

  // 创建订单
  const createOrder = async (): Promise<string | null> => {
    try {
      const token = useAuthStore.getState().token;
      if (!token) {
        Alert.alert('错误', '请先登录');
        return null;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/membership/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          planType: selectedPlan,
          planName: 'plus',
          amount: Math.round(currentPlan.price * 100),
          payMethod: selectedMethod,
        }),
      });

      const result = await response.json();

      if (result.success && result.data?.orderInfo) {
        return result.data.orderInfo;
      } else {
        Alert.alert('创建订单失败', result.message || '请稍后重试');
        return null;
      }
    } catch (error) {
      console.error('创建订单失败:', error);
      Alert.alert('创建订单失败', '网络请求失败，请检查网络连接');
      return null;
    }
  };

  // 处理支付结果
  const handlePayResult = (result: any) => {
    const { resultStatus, memo } = result;

    switch (resultStatus) {
      case '9000': {
        const expiredAt = new Date();
        if (currentPlan.durationUnit === 'day') {
          expiredAt.setDate(expiredAt.getDate() + currentPlan.duration);
        } else {
          expiredAt.setMonth(expiredAt.getMonth() + currentPlan.duration);
        }

        setMembership({
          level: 2,
          status: 'active',
          expiredAt: expiredAt.toISOString(),
          plan: selectedPlan === 'trial' ? 'trial' : selectedPlan === 'monthly' ? 'month' : selectedPlan === 'quarterly' ? 'quarter' : 'year',
          trialUsed: selectedPlan === 'trial' ? true : undefined,
        });

        const { setMessages } = useMessageStore.getState();
        const msgId = `member-success-${Date.now()}`;
        setMessages([{
          id: msgId,
          title: '会员开通成功',
          content: `恭喜您成功开通${currentPlan.name}，有效期至${expiredAt.toLocaleDateString('zh-CN')}。现在您可以享受无限项目跟进、AI智能助手等全部会员权益！`,
          time: '刚刚',
          unread: true,
          category: 'system',
        }, ...useMessageStore.getState().messages]);

        Alert.alert('支付成功', `您已成功开通${currentPlan.name}，享受全部权益！`, [
          { text: '确定', onPress: () => navigation.goBack() },
        ]);
        break;
      }
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

  const handlePayment = async () => {
    if (loading) return;

    if (selectedMethod !== 'alipay') {
      Alert.alert('提示', '请选择支付宝支付');
      return;
    }

    setLoading(true);

    try {
      const orderInfo = await createOrder();
      if (!orderInfo) {
        setLoading(false);
        return;
      }

      const payResult = await Alipay.pay(orderInfo);
      handlePayResult(payResult);
    } catch (error) {
      console.error('支付失败:', error);
      Alert.alert('支付失败', '支付过程中发生错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const renderPlanCard = (planKey: MembershipPlan, trialUsed?: boolean) => {
    const plan = MEMBERSHIP_PLANS[planKey];
    const isSelected = selectedPlan === planKey;
    const isTrialDisabled = plan.trial && trialUsed;

    const getDurationText = () => {
      if (plan.durationUnit === 'day') {
        return `${plan.duration}天`;
      }
      return plan.duration === 1 ? '1个月' : plan.duration === 3 ? '3个月' : '12个月';
    };

    return (
      <TouchableOpacity
        key={planKey}
        style={[
          styles.planCard,
          { backgroundColor: C.surfaceSub, borderColor: C.border },
          isSelected && !isTrialDisabled && { borderColor: C.borderActive, backgroundColor: C.accentLight },
          plan.popular && { borderColor: 'rgba(178,0,0,0.3)' },
          isTrialDisabled && { opacity: 0.5 },
        ]}
        onPress={() => !isTrialDisabled && setSelectedPlan(planKey)}
        activeOpacity={0.8}
        disabled={isTrialDisabled}
      >
        {plan.popular && (
          <View style={[styles.popularBadge, { backgroundColor: C.badgeBg }]}>
            <Text style={styles.popularBadgeText}>推荐</Text>
          </View>
        )}
        {plan.trial && !trialUsed && (
          <View style={[styles.popularBadge, { backgroundColor: '#FF6B00' }]}>
            <Text style={styles.popularBadgeText}>限购1次</Text>
          </View>
        )}
        {isTrialDisabled && (
          <View style={[styles.popularBadge, { backgroundColor: '#9CA3AF' }]}>
            <Text style={styles.popularBadgeText}>已购</Text>
          </View>
        )}

        <Text style={[styles.planName, { color: C.textMuted }, isSelected && !isTrialDisabled && { color: C.text, fontWeight: '600' }]}>
          {plan.name}
        </Text>

        <View style={styles.planPriceRow}>
          <Text style={[styles.planCurrency, { color: C.text }, isSelected && !isTrialDisabled && { fontWeight: '700' }]}>¥</Text>
          <Text style={[styles.planPrice, { color: C.text }, isSelected && !isTrialDisabled && { fontWeight: '700' }]}>
            {plan.price}
          </Text>
        </View>

        <Text style={[styles.planDuration, { color: C.textMuted }]}>
          {getDurationText()}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={C.text} size={24} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.text }]}>开通会员</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 套餐选择 */}
        <View style={styles.plansSection}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.plansScrollContent}
          >
            {renderPlanCard('trial', trialUsed)}
            {renderPlanCard('monthly', trialUsed)}
            {renderPlanCard('quarterly', trialUsed)}
            {renderPlanCard('yearly', trialUsed)}
          </ScrollView>
        </View>

        {/* 权益列表 */}
        <View style={[styles.benefitsCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>会员权益</Text>
          {benefits.map((benefit, index) => (
            <View key={index} style={[styles.benefitItem, index === benefits.length - 1 && styles.benefitItemLast, { borderBottomColor: C.border }]}>
              <View style={[styles.benefitIcon, { backgroundColor: C.iconBg, borderColor: C.iconBorder }]}>
                <benefit.icon size={20} color={C.iconColor} />
              </View>
              <View style={styles.benefitText}>
                <Text style={[styles.benefitTitle, { color: C.text }]}>{benefit.title}</Text>
                <Text style={[styles.benefitDesc, { color: C.textSub }]}>{benefit.desc}</Text>
              </View>
              <Check size={18} color={C.checkColor} />
            </View>
          ))}
        </View>

        {/* 支付方式 */}
        <View style={[styles.paymentSection, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>支付方式</Text>

          <TouchableOpacity
            style={[
              styles.paymentOption,
              { backgroundColor: C.surfaceSub, borderColor: C.border },
              selectedMethod === 'alipay' && { borderColor: C.borderActive, backgroundColor: C.accentLight },
            ]}
            onPress={() => setSelectedMethod('alipay')}
            activeOpacity={0.8}
          >
            <Image
              source={require('@/assets/images/alipay.png')}
              style={styles.alipayLogo}
            />
            <Text style={[styles.paymentName, { color: C.text }]}>支付宝</Text>
            <View style={[
              styles.radioOuter,
              { borderColor: C.radioBorder },
              selectedMethod === 'alipay' && { borderColor: C.radioActive },
            ]}>
              {selectedMethod === 'alipay' && <View style={[styles.radioInner, { backgroundColor: C.radioActive }]} />}
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 底部支付按钮 */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={[styles.payButton, loading && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={loading}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[C.btnGrad1, C.btnGrad2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.payButtonGradient}
          >
            <Text style={styles.payButtonText}>
              {loading ? '支付中...' : `立即支付 ¥${currentPlan.price}`}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        <View style={styles.agreementContainer}>
          <Text style={[styles.agreementText, { color: C.textMuted }]}>点击支付即表示同意</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Agreement', { type: 'membership' })}
          >
            <Text style={[styles.agreementLink, { color: C.accent }]}>《会员服务协议》</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  plansSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  plansScrollContent: {
    paddingRight: 16,
    gap: 10,
    paddingTop: 10,
  },
  planCard: {
    width: 115,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    position: 'relative',
    overflow: 'visible',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  planName: {
    fontSize: 13,
    marginTop: 8,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 6,
  },
  planCurrency: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 2,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '400',
  },
  planDuration: {
    fontSize: 11,
    marginTop: 4,
  },
  benefitsCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  benefitItemLast: {
    borderBottomWidth: 0,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    marginLeft: 12,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  benefitDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  paymentSection: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  alipayLogo: {
    width: 36,
    height: 36,
    borderRadius: 6,
    resizeMode: 'contain',
  },
  paymentName: {
    flex: 1,
    fontSize: 15,
    marginLeft: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bottomBar: {
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  agreementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginHorizontal: 16,
  },
  agreementText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  agreementLink: {
    fontSize: 11,
    color: '#B20000',
    textDecorationLine: 'underline',
  },
  payButton: {
    borderRadius: 25,
    height: 50,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  payButtonGradient: {
    flex: 1,
    width: '100%',
    borderRadius: 25,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MembershipPayScreen;
