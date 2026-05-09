import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { Crown, Zap, Users, Brain, ChevronRight, Check, ChevronLeft, Search, BookOpen } from 'lucide-react-native';
import { useMembershipStore, MEMBER_NAMES } from '@/stores/useMembershipStore';
import type { RootStackScreenProps } from '@/navigation/types';

const benefits = [
  { icon: Zap, title: '无限项目跟进', desc: '不限制跟进项目数量' },
  { icon: Search, title: 'AI自动找项目', desc: '智能匹配，自动推送合适项目' },
  { icon: Users, title: '团队协作', desc: '邀请队友一起跟进项目' },
  { icon: Brain, title: 'AI智能助手', desc: '智能辅助、决策分析、跟进总结' },
  { icon: BookOpen, title: '找资源无限制', desc: '规范/图集/信息价板块无限查看' },
  { icon: Crown, title: 'AI牛马体', desc: '写标书、桩基比选...等功能只需支付token费用' },
];

const MembershipScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RootStackScreenProps<'Membership'>['navigation']>();
  const { membership, isMember, isExpired, getMemberName } = useMembershipStore();

  const isActive = isMember();
  const isExpiredStatus = isExpired();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />
      
      {/* Header */}
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
      >
        {/* 当前会员状态卡片 */}
        <LinearGradient
          colors={isActive ? ['#B20000', '#8B0000'] : ['#E5E7EB', '#D1D5DB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statusCard}
        >
          <View style={styles.statusHeader}>
            <View style={[styles.statusIcon, { backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]}>
              <Crown size={24} color={isActive ? '#FFD700' : '#9CA3AF'} />
            </View>
            <View style={styles.statusText}>
              <Text style={[styles.statusLabel, { color: isActive ? 'rgba(255,255,255,0.8)' : '#6B7280' }]}>
                当前等级
              </Text>
              <Text style={[styles.statusName, { color: isActive ? '#FFFFFF' : '#374151' }]}>
                {getMemberName()}
              </Text>
            </View>
          </View>
          
          {isActive && membership.expiredAt && (
            <View style={styles.expiryBadge}>
              <Text style={styles.expiryText}>
                有效期至 {new Date(membership.expiredAt).toLocaleDateString('zh-CN')}
              </Text>
            </View>
          )}
          
          {isExpiredStatus && (
            <View style={[styles.expiryBadge, { backgroundColor: 'rgba(0,0,0,0.1)' }]}>
              <Text style={[styles.expiryText, { color: '#6B7280' }]}>
                会员已过期
              </Text>
            </View>
          )}
          
          {!isActive && !isExpiredStatus && (
            <View style={[styles.expiryBadge, { backgroundColor: 'rgba(0,0,0,0.1)' }]}>
              <Text style={[styles.expiryText, { color: '#6B7280' }]}>
                开通会员享受全部权益
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* 权益列表 */}
        <View style={styles.benefitsSection}>
          <Text style={styles.sectionTitle}>会员权益</Text>
          <View style={styles.benefitsCard}>
            {benefits.map((benefit, index) => (
              <View 
                key={index} 
                style={[
                  styles.benefitItem, 
                  index === benefits.length - 1 && styles.benefitItemLast
                ]}
              >
                <View style={styles.benefitIcon}>
                  <benefit.icon size={20} color="#B20000" />
                </View>
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>{benefit.title}</Text>
                  <Text style={styles.benefitDesc}>{benefit.desc}</Text>
                </View>
                <Check size={18} color="#B20000" />
              </View>
            ))}
          </View>
        </View>

        {/* 套餐预览 */}
        <View style={styles.plansSection}>
          <Text style={styles.sectionTitle}>选择套餐</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.plansScrollContent}
          >
            <View style={[styles.planPreview, membership.trialUsed && { opacity: 0.5 }]}>
              {membership.trialUsed && (
                <View style={[styles.statusBadge, { backgroundColor: '#9CA3AF' }]}>
                  <Text style={styles.statusBadgeText}>已购</Text>
                </View>
              )}
              {!membership.trialUsed && (
                <View style={[styles.statusBadge, { backgroundColor: '#FF6B00' }]}>
                  <Text style={styles.statusBadgeText}>限购1次</Text>
                </View>
              )}
              <Text style={styles.planPreviewName}>首次体验</Text>
              <Text style={styles.planPreviewPrice}>¥1</Text>
              <Text style={styles.planPreviewPeriod}>7天</Text>
            </View>
            <View style={styles.planPreview}>
              <Text style={styles.planPreviewName}>月度会员</Text>
              <Text style={styles.planPreviewPrice}>¥18.8</Text>
              <Text style={styles.planPreviewPeriod}>/月</Text>
            </View>
            <View style={[styles.planPreview, styles.planPreviewPopular]}>
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>推荐</Text>
              </View>
              <Text style={[styles.planPreviewName, { color: '#B20000' }]}>季度会员</Text>
              <Text style={[styles.planPreviewPrice, { color: '#B20000' }]}>¥48.8</Text>
              <Text style={styles.planPreviewPeriod}>/季</Text>
            </View>
            <View style={styles.planPreview}>
              <Text style={styles.planPreviewName}>年度会员</Text>
              <Text style={styles.planPreviewPrice}>¥168.8</Text>
              <Text style={styles.planPreviewPeriod}>/年</Text>
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      {/* 底部按钮 */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={styles.payButton}
          onPress={() => navigation.navigate('MembershipPay')}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#C02020', '#8B0000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.payButtonGradient}
          >
            <Text style={styles.payButtonText}>
              {isActive ? '续费会员' : '立即开通'}
            </Text>
            <ChevronRight size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  statusCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
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
    fontSize: 13,
    marginBottom: 4,
  },
  statusName: {
    fontSize: 22,
    fontWeight: '700',
  },
  expiryBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginTop: 16,
  },
  expiryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  benefitsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 12,
  },
  benefitsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  benefitItemLast: {
    borderBottomWidth: 0,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(178,0,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(178,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    marginLeft: 12,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  benefitDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  plansSection: {
    marginBottom: 24,
  },
  plansScrollContent: {
    paddingRight: 20,
    gap: 12,
    paddingTop: 10,
  },
  planPreview: {
    width: 115,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
    overflow: 'visible',
  },
  planPreviewPopular: {
    borderColor: '#B20000',
    borderWidth: 2,
  },
  statusBadge: {
    position: 'absolute',
    top: -10,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#B20000',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  planPreviewName: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  planPreviewPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  planPreviewPeriod: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  bottomBar: {
    paddingTop: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  payButton: {
    borderRadius: 25,
    height: 50,
    overflow: 'hidden',
  },
  payButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 4,
  },
});

export default MembershipScreen;
