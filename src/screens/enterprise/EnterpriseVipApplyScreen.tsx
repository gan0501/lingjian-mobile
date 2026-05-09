import { Loading } from '@/components/common/Loading';
import React, { FC, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Modal, ActivityIndicator, TouchableOpacity, Image, Animated, Easing, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Crown, Check, Shield, MapPin, Image as ImageIcon, Award, Package, Briefcase, Newspaper, Users, Globe, Sparkles, Zap } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import Alipay from '@0x5e/react-native-alipay';
import { Header } from '@/components/common/Header';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius } from '@/constants/spacing';
import { FontSize } from '@/constants/typography';
import { API_CONFIG } from '@/constants/config';
import { useAuthStore } from '@/stores/useAuthStore';
import type { RootStackScreenProps } from '@/navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const THEME = {
  primary: '#80011A',
  gold: '#FFD700',
  goldDark: '#B8860B',
};

const CERTIFICATION_FEATURES = [
  { icon: MapPin, text: '企业LOGO地图展示', desc: '在地图上突出显示您的企业品牌', color: '#4CAF50' },
  { icon: Globe, text: '企业详情页专属展示', desc: '定制化企业主页，提升品牌形象', color: '#2196F3' },
  { icon: ImageIcon, text: '企业相册展示', desc: '展示厂区环境、生产设备等', color: '#9C27B0' },
  { icon: Award, text: '企业荣誉展示', desc: '展示资质证书、荣誉奖项', color: '#FF9800' },
  { icon: Package, text: '产品服务展示', desc: '展示核心产品与服务能力', color: '#00BCD4' },
  { icon: Briefcase, text: '项目案例展示', desc: '展示标杆项目，增强客户信任', color: '#E91E63' },
  { icon: Newspaper, text: '企业新闻发布', desc: '发布企业动态，提升活跃度', color: '#8BC34A' },
  { icon: Users, text: '销售座席展示', desc: '展示联系人信息，促进商机对接', color: '#FF5722' },
];

type PaymentMethod = 'alipay';
type Props = RootStackScreenProps<'EnterpriseVipApply'>;

const EnterpriseVipApplyScreen: FC<Props> = ({ navigation, route }) => {
  const { enterpriseId, enterpriseName } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [selectedMethod] = useState<PaymentMethod>('alipay');

  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handlePayment = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    try {
      const token = useAuthStore.getState().token;
      if (!token) {
        Alert.alert('提示', '请先登录');
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/membership/create-order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            planType: 'enterprise_cert',
            planName: 'enterprise_cert',
            amount: 999 * 100,
            payMethod: selectedMethod,
            enterpriseId: enterpriseId,
          }),
        }
      );

      const result = await response.json();

      if (result.success && result.data?.orderInfo) {
        const payResult = await Alipay.pay(result.data.orderInfo);
        const { resultStatus, memo } = payResult;

        switch (resultStatus) {
          case '9000':
            Alert.alert('支付成功', '企业认证已开通，审核将在12小时内完成！', [
              { text: '确定', onPress: () => navigation.goBack() },
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
      } else {
        Alert.alert('提示', result.message || '创建订单失败，请稍后重试');
      }
    } catch (error: any) {
      Alert.alert('提示', error?.message || '支付过程中发生错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [enterpriseId, selectedMethod, loading, navigation]);

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0a0a0a', '#111111', '#0a0a0a']} style={StyleSheet.absoluteFill} />
      <Header
        title="认证企业"
        showBack
        onBack={() => navigation.goBack()}
        transparent
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 130 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.infoCard}>
          <View style={styles.infoIconWrap}>
            <Shield color={THEME.gold} size={18} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>申请认证企业</Text>
            <Text style={styles.infoValue}>{enterpriseName}</Text>
          </View>
        </View>

        <View style={styles.priceCard}>
          <LinearGradient
            colors={['rgba(128,1,26,0.3)', 'rgba(255,215,0,0.08)', 'rgba(128,1,26,0.15)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            style={[styles.shimmerOverlay, { transform: [{ translateX: shimmerTranslate }] }]}
          >
            <LinearGradient
              colors={['transparent', 'rgba(255,215,0,0.08)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shimmerGradient}
            />
          </Animated.View>
          
          <View style={styles.priceHeader}>
            <View style={styles.priceTitleRow}>
              <Crown color={THEME.gold} size={24} />
              <Text style={styles.priceName}>认证企业</Text>
            </View>
            <View style={styles.officialBadge}>
              <Sparkles color={THEME.gold} size={12} />
              <Text style={styles.officialText}>官方认证</Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.currencySign}>¥</Text>
            <Text style={styles.priceAmount}>999</Text>
            <Text style={styles.pricePeriod}>/年</Text>
          </View>
          <Text style={styles.priceSubtext}>开通即享全部权益 · 12小时审核</Text>
        </View>

        <View style={styles.featuresSection}>
          <View style={styles.featuresSectionHeader}>
            <Zap color={THEME.gold} size={18} />
            <Text style={styles.featuresSectionTitle}>认证权益</Text>
            <View style={styles.featureCountBadge}>
              <Text style={styles.featureCountText}>{CERTIFICATION_FEATURES.length}项</Text>
            </View>
          </View>
          {CERTIFICATION_FEATURES.map((feature, idx) => {
            const IconComp = feature.icon;
            return (
              <View key={idx} style={styles.featureRow}>
                <View style={[styles.featureIconWrap, { backgroundColor: feature.color + '18' }]}>
                  <IconComp color={feature.color} size={18} />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureText}>{feature.text}</Text>
                  <Text style={styles.featureDesc}>{feature.desc}</Text>
                </View>
                <View style={styles.featureCheck}>
                  <Check color={THEME.gold} size={14} />
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.paySection}>
          <Text style={styles.paySectionTitle}>支付方式</Text>
          <View style={styles.payOption}>
            <Image
              source={require('@/assets/images/alipay.png')}
              style={styles.alipayLogo}
            />
            <Text style={styles.payName}>支付宝</Text>
            <View style={styles.radioActive}>
              <View style={styles.radioInner} />
            </View>
          </View>
        </View>

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>温馨提示</Text>
          <Text style={styles.tipsText}>1. 企业认证仅限已认领的企业申请</Text>
          <Text style={styles.tipsText}>2. 付款后即时生效，有效期1年</Text>
          <Text style={styles.tipsText}>3. 认证审核将在12小时内完成</Text>
          <Text style={styles.tipsText}>4. 如有疑问请联系客服 0571-85850875</Text>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.priceSummary}>
          <Text style={styles.priceSummaryLabel}>应付金额</Text>
          <View style={styles.priceSummaryRow}>
            <Text style={styles.priceSummarySign}>¥</Text>
            <Text style={styles.priceSummaryValue}>999</Text>
          </View>
        </View>
        <Animated.View style={[styles.payButtonWrap, { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity
            style={[styles.payButton, loading && styles.payButtonDisabled]}
            onPress={handlePayment}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[THEME.primary, '#600012', '#400010']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.payButtonGradient}
            >
              <Crown color={THEME.gold} size={18} />
              <Text style={styles.payButtonText}>
                {loading ? '支付中...' : '立即支付 ¥999'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <Loading size="large" color={THEME.gold} />
            <Text style={styles.loadingText}>正在处理...</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scrollView: { flex: 1 },
  content: { padding: Spacing.screenPadding, paddingTop: Spacing.base },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  infoIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,215,0,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 },
  infoValue: { fontSize: 16, color: '#fff', fontWeight: '600' },
  priceCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    overflow: 'hidden',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: 80,
  },
  shimmerGradient: { flex: 1 },
  priceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  priceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceName: { fontSize: 22, fontWeight: '800', color: THEME.gold },
  officialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,215,0,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  officialText: { fontSize: 11, color: THEME.gold, fontWeight: '600' },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  currencySign: { fontSize: 22, color: THEME.gold, fontWeight: '700' },
  priceAmount: { fontSize: 56, fontWeight: '900', color: THEME.gold, letterSpacing: -2 },
  pricePeriod: { fontSize: 14, color: 'rgba(255,215,0,0.6)', marginLeft: 4 },
  priceSubtext: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  featuresSection: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  featuresSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  featuresSectionTitle: {
    fontSize: 16, color: '#fff', fontWeight: '700', flex: 1,
  },
  featureCountBadge: {
    backgroundColor: 'rgba(255,215,0,0.12)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  featureCountText: { fontSize: 11, color: THEME.gold, fontWeight: '600' },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  featureIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  featureContent: { flex: 1, marginRight: 8 },
  featureText: { fontSize: 14, color: '#fff', fontWeight: '500' },
  featureDesc: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 },
  featureCheck: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,215,0,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  paySection: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  paySectionTitle: {
    fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginBottom: 12,
  },
  payOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(128,1,26,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(128,1,26,0.3)',
  },
  alipayLogo: { width: 32, height: 32, borderRadius: 6, resizeMode: 'contain' },
  payName: { flex: 1, color: '#fff', fontSize: 15, marginLeft: 10, fontWeight: '500' },
  radioActive: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: THEME.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: THEME.primary },
  tipsCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    padding: 16,
  },
  tipsTitle: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginBottom: 8 },
  tipsText: { fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 20, marginBottom: 2 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 14,
    backgroundColor: 'rgba(0,0,0,0.92)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 16,
  },
  priceSummary: {},
  priceSummaryLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  priceSummaryRow: { flexDirection: 'row', alignItems: 'baseline' },
  priceSummarySign: { fontSize: 14, color: THEME.gold, fontWeight: '700' },
  priceSummaryValue: { fontSize: 28, fontWeight: '800', color: THEME.gold },
  payButtonWrap: { flex: 1 },
  payButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  payButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  payButtonDisabled: { opacity: 0.6 },
  payButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  loadingBox: {
    backgroundColor: 'rgba(20,20,20,0.95)',
    borderRadius: 16,
    paddingHorizontal: 40, paddingVertical: 30,
    alignItems: 'center', gap: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  loadingText: { color: '#fff', fontSize: 15, fontWeight: '500' },
});

export default EnterpriseVipApplyScreen;
