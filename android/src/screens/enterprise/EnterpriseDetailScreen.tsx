import React, { FC, useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Alert, Image, Dimensions, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Calendar, Building2, Phone, Navigation, User, CreditCard, Users, FileText, Star, Shield, Edit3, Crown, ShoppingBag, Newspaper, Package } from 'lucide-react-native';
import { useAuthStore } from '@/stores/useAuthStore';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/common/Card';
import { Loading } from '@/components/common/Loading';
import { Colors, getEnterpriseColor } from '@/constants/colors';
import { Spacing, BorderRadius } from '@/constants/spacing';
import { TextStyles, FontSize, FontWeight } from '@/constants/typography';
import type { RootStackScreenProps } from '@/navigation/types';
import { useEnterpriseDetail, useEnterpriseVipDetail } from '@/hooks/useEnterprises';
import { ENTERPRISE_TYPES } from '@/constants/config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const THEME = {
  primary: '#80011A',
  secondary: '#000000',
};

type Props = RootStackScreenProps<'EnterpriseDetail'>;

const EnterpriseDetailScreen: FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { enterpriseId, enterpriseType } = route.params;
  const { user, userInfo, isLoggedIn } = useAuthStore();
  const currentUserId = user?.id || (user as any)?.user_id || userInfo?.id || (userInfo as any)?.user_id;

  const { data: enterprise, isLoading, error, isError } = useEnterpriseDetail(enterpriseId, enterpriseType);

  const [logoError, setLogoError] = useState(false);
  const [fetchedUserId, setFetchedUserId] = useState<string | number | null>(null);

  useEffect(() => {
    if (isLoggedIn && currentUserId == null) {
      import('@/services/authService').then(({ authService }) => {
        authService.getUser().then(info => {
          if (info && info.id) {
            setFetchedUserId(info.id);
            useAuthStore.getState().setUserInfo(info);
          }
        }).catch(() => {});
      });
    }
  }, [isLoggedIn, currentUserId]);

  const finalUserId = currentUserId ?? fetchedUserId;

  const isVip = useMemo(() => {
    const verified = enterprise?.is_verified;
    if (typeof verified === 'string') {
      return verified === '3' || verified === '4';
    }
    if (typeof verified === 'number') {
      return verified >= 3;
    }
    return enterprise?.is_vip || false;
  }, [enterprise?.is_verified, enterprise?.is_vip]);

  const { data: vipDetail, isLoading: vipLoading } = useEnterpriseVipDetail(enterpriseId, isVip, enterpriseType);

  const typeColor = useMemo(() => {
    return getEnterpriseColor(enterprise?.enterprise_type || 0);
  }, [enterprise?.enterprise_type]);

  const typeName = useMemo(() => {
    const t = ENTERPRISE_TYPES.find((x: any) => x.id === enterprise?.enterprise_type);
    return t?.name || '建企';
  }, [enterprise?.enterprise_type]);

  const cityLabel = useMemo(() => {
    const raw = String(enterprise?.city || '').trim();
    if (raw) return raw;
    const addr = String(enterprise?.register_address || '').trim();
    if (!addr) return '';
    const m = addr.match(/([\u4e00-\u9fa5]{2,8}市)/);
    return m?.[1] || '';
  }, [enterprise?.city, enterprise?.register_address]);

  const allQualificationItems = useMemo(() => {
    const raw1 = String(enterprise?.qualification || '').trim();
    const raw2 = String(enterprise?.qualification2 || '').trim();
    const items1 = (raw1 && raw1 !== '无') ? raw1.split(/[\n;；、，,]+/).map(s => s.trim()).filter(Boolean) : [];
    const items2 = raw2 ? raw2.split(/[\n;；、，,]+/).map(s => s.trim()).filter(Boolean) : [];
    const set = new Set(items1.map(s => s.toLowerCase()));
    const merged = [...items1];
    items2.forEach(item => {
      if (!set.has(item.toLowerCase())) { merged.push(item); set.add(item.toLowerCase()); }
    });
    return merged;
  }, [enterprise?.qualification, enterprise?.qualification2]);

  const isValidUrl = (url: string | undefined | null): boolean => {
    if (!url || typeof url !== 'string') return false;
    return /^https?:\/\//.test(url.trim());
  };

  const logoUri = useMemo(() => {
    if (isValidUrl(enterprise?.logo_url)) return enterprise!.logo_url;
    return null;
  }, [enterprise?.logo_url]);

  const phoneNumber = (enterprise?.contact_phone || enterprise?.contactPhone || '').trim();
  const address = (enterprise?.register_address || enterprise?.registerAddress || '').trim();

  const isClaimed = enterprise?.claim_status === 1 || enterprise?.claim_status === 2;

  const isMyEnterprise = useMemo(() => {
    if (!isLoggedIn || !finalUserId || !enterprise) return false;
    return isClaimed && String(enterprise.claim_user_id) === String(finalUserId);
  }, [isLoggedIn, finalUserId, enterprise, isClaimed]);

  const album = vipDetail?.album || [];
  const honors = vipDetail?.honors || [];
  const news = vipDetail?.news || [];
  const products = vipDetail?.products || [];
  const projects = vipDetail?.projects || [];
  const contacts = vipDetail?.contacts || [];

  return (
    <View style={styles.container}>
      <Header
        title="企业详情"
        showBack
        onBack={() => navigation.goBack()}
        backgroundColor="#FFFFFF"
        titleColor="#333"
        iconColor="#333"
        rightIcon={isMyEnterprise ? <Edit3 color={Colors.primary[600]} size={20} /> : undefined}
        onRightPress={isMyEnterprise ? () => navigation.navigate('EnterpriseEdit', { enterpriseId }) : undefined}
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <Loading text="加载企业详情..." />
        </View>
      )}

      {isError && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: '#999', fontSize: 14 }}>
            加载失败: {error?.message || '未知错误'}
          </Text>
        </View>
      )}

      {!isLoading && !isError && (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
      >
        {enterprise && (
        <View style={styles.basicInfoSection}>
          <View style={styles.cardContent}>
            <View style={styles.headerRow}>
              {logoUri && !logoError ? (
                <Image
                  source={{ uri: logoUri }}
                  style={styles.logoImage}
                  onError={() => setLogoError(true)}
                />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Building2 color="rgba(128,1,26,0.5)" size={32} />
                </View>
              )}
              <View style={styles.headerInfo}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>{enterprise?.enterprise_name || '—'}</Text>
                  {isVip && (
                    <View style={styles.vipBadge}>
                      <Star color="#FFD700" size={12} fill="#FFD700" />
                      <Text style={styles.vipBadgeText}>VIP</Text>
                    </View>
                  )}
                </View>
                <View style={styles.tagsRow}>
                  <View style={[styles.tag, { backgroundColor: typeColor }]}>
                    <Text style={styles.tagText}>{typeName}</Text>
                  </View>
                  {!!cityLabel && (
                    <View style={[styles.tag, styles.tagCity]}>
                      <Text style={[styles.tagText, styles.tagTextGray]}>{cityLabel}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {isVip && enterprise?.description && (
              <View style={styles.descriptionSection}>
                <Text style={styles.descriptionText}>{enterprise.description}</Text>
              </View>
            )}

            <View style={styles.infoGrid}>
              <View style={styles.infoItemHalf}>
                <User color="#999" size={14} />
                <Text style={styles.infoLabel}>法定代表人</Text>
                <Text style={styles.infoValue}>{enterprise?.legal_person || enterprise?.legalPerson || '—'}</Text>
              </View>
              <View style={styles.infoItemHalf}>
                <CreditCard color={Colors.text.tertiary} size={14} />
                <Text style={styles.infoLabel}>注册资本</Text>
                <Text style={styles.infoValue}>{enterprise?.register_capital || enterprise?.registerCapital || '—'}</Text>
              </View>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoItemHalf}>
                <Building2 color={Colors.text.tertiary} size={14} />
                <Text style={styles.infoLabel}>企业状态</Text>
                <Text style={styles.infoValue}>{enterprise?.enterprise_status || enterprise?.enterpriseStatus || '—'}</Text>
              </View>
              <View style={styles.infoItemHalf}>
                <Calendar color={Colors.text.tertiary} size={14} />
                <Text style={styles.infoLabel}>成立日期</Text>
                <Text style={styles.infoValue}>{enterprise?.establish_date || enterprise?.establishDate || '—'}</Text>
              </View>
            </View>

            <View style={styles.infoRowSingle}>
              <FileText color={Colors.text.tertiary} size={14} />
              <Text style={styles.infoLabel}>信用代码</Text>
              <Text style={[styles.infoValue, { flex: 1 }]} numberOfLines={1}>{enterprise?.credit_code || enterprise?.creditCode || '—'}</Text>
            </View>

            {!!(enterprise?.contributors_in || enterprise?.contributorsIn || '').trim() && (
              <View style={styles.infoRowSingle}>
                <Users color={Colors.text.tertiary} size={14} />
                <Text style={styles.infoLabel}>社保人员</Text>
                <Text style={styles.infoValue}>{enterprise?.contributors_in || enterprise?.contributorsIn}</Text>
              </View>
            )}

            <View style={styles.infoRowSingle}>
              <MapPin color={Colors.text.tertiary} size={14} />
              <Text style={styles.infoLabel}>注册地址</Text>
              <Text style={[styles.infoValue, { flex: 1 }]} numberOfLines={2}>{address || '—'}</Text>
            </View>
          </View>
        </View>
        )}

        {isVip && vipLoading && (
          <View style={styles.loadingContainer}>
            <Loading text="加载VIP详情..." />
          </View>
        )}

        {isVip && album.length > 0 && (
          <Card style={[styles.sectionCard, styles.lightCard]}>
            <View style={styles.sectionHeader}>
              <ShoppingBag color={Colors.text.tertiary} size={18} />
              <Text style={[styles.sectionTitle, styles.lightSectionTitle]}>企业相册</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {album.map((item, idx) => (
                <Image key={`album-${idx}`} source={{ uri: item.image_url }} style={styles.albumImage} />
              ))}
            </ScrollView>
          </Card>
        )}

        {isVip && honors.length > 0 && (
          <Card style={[styles.sectionCard, styles.lightCard]}>
            <View style={styles.sectionHeader}>
              <Shield color={Colors.text.tertiary} size={18} />
              <Text style={[styles.sectionTitle, styles.lightSectionTitle]}>企业荣誉</Text>
            </View>
            <View style={styles.listContainer}>
              {honors.map((item, idx) => (
                <View key={`honor-${idx}`} style={styles.honorItem}>
                  {item.honor_image && <Image source={{ uri: item.honor_image }} style={styles.honorImage} />}
                  <View style={styles.honorInfo}>
                    <Text style={styles.honorTitle}>{item.honor_title}</Text>
                    {item.honor_date && <Text style={styles.honorDate}>{item.honor_date}</Text>}
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {isVip && products.length > 0 && (
          <Card style={[styles.sectionCard, styles.lightCard]}>
            <View style={styles.sectionHeader}>
              <Package color={Colors.text.tertiary} size={18} />
              <Text style={[styles.sectionTitle, styles.lightSectionTitle]}>企业产品</Text>
            </View>
            <View style={styles.gridContainer}>
              {products.map((item, idx) => (
                <View key={`product-${idx}`} style={styles.gridItem}>
                  {item.product_image && <Image source={{ uri: item.product_image }} style={styles.gridImage} />}
                  <Text style={styles.gridTitle} numberOfLines={2}>{item.product_name}</Text>
                  {item.product_desc && <Text style={styles.gridDesc} numberOfLines={2}>{item.product_desc}</Text>}
                </View>
              ))}
            </View>
          </Card>
        )}

        {isVip && projects.length > 0 && (
          <Card style={[styles.sectionCard, styles.lightCard]}>
            <View style={styles.sectionHeader}>
              <Building2 color={Colors.text.tertiary} size={18} />
              <Text style={[styles.sectionTitle, styles.lightSectionTitle]}>企业项目</Text>
            </View>
            <View style={styles.listContainer}>
              {projects.map((item, idx) => (
                <View key={`project-${idx}`} style={styles.projectItem}>
                  {item.project_image && <Image source={{ uri: item.project_image }} style={styles.projectImage} />}
                  <View style={styles.projectInfo}>
                    <Text style={styles.projectTitle}>{item.project_name}</Text>
                    {item.project_date && <Text style={styles.projectDate}>{item.project_date}</Text>}
                    {item.project_desc && <Text style={styles.projectDesc} numberOfLines={2}>{item.project_desc}</Text>}
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {isVip && news.length > 0 && (
          <Card style={[styles.sectionCard, styles.lightCard]}>
            <View style={styles.sectionHeader}>
              <Newspaper color={Colors.text.tertiary} size={18} />
              <Text style={[styles.sectionTitle, styles.lightSectionTitle]}>企业新闻</Text>
            </View>
            <View style={styles.listContainer}>
              {news.map((item, idx) => (
                <View key={`news-${idx}`} style={styles.newsItem}>
                  {item.news_image && <Image source={{ uri: item.news_image }} style={styles.newsImage} />}
                  <View style={styles.newsInfo}>
                    <Text style={styles.newsTitle} numberOfLines={2}>{item.news_title}</Text>
                    {item.news_date && <Text style={styles.newsDate}>{item.news_date}</Text>}
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {isVip && contacts.length > 0 && (
          <Card style={[styles.sectionCard, styles.lightCard]}>
            <View style={styles.sectionHeader}>
              <Phone color={Colors.text.tertiary} size={18} />
              <Text style={[styles.sectionTitle, styles.lightSectionTitle]}>销售座席</Text>
            </View>
            <View style={styles.listContainer}>
              {contacts.map((item, idx) => (
                <TouchableOpacity
                  key={`contact-${idx}`}
                  style={styles.contactItem}
                  onPress={() => {
                    if (item.contact_phone) {
                      Linking.openURL(`tel:${item.contact_phone}`).catch(() => Alert.alert('提示', '无法拨打电话'));
                    }
                  }}
                >
                  <View style={styles.contactAvatar}>
                    <User color="#fff" size={20} />
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{item.contact_name}</Text>
                    {item.contact_position && <Text style={styles.contactPosition}>{item.contact_position}</Text>}
                  </View>
                  <View style={styles.contactPhone}>
                    <Phone color={THEME.primary} size={18} />
                    <Text style={styles.contactPhoneText}>{item.contact_phone}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        )}

        <Card style={[styles.sectionCard, styles.lightCard]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionBar, styles.sectionBarLight]} />
            <Text style={[styles.sectionTitle, styles.lightSectionTitle]}>最新动态</Text>
          </View>
          <Text style={styles.emptyTextLight}>该企业近期暂无相关动态</Text>
        </Card>

        <Card style={[styles.sectionCard, styles.lightCard]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionBar, styles.sectionBarLight]} />
            <Text style={[styles.sectionTitle, styles.lightSectionTitle]}>股东信息</Text>
          </View>
          <Text style={styles.emptyTextLight}>暂无股东信息</Text>
        </Card>

        <Card style={[styles.sectionCard, styles.lightCard]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionBar, styles.sectionBarLight]} />
            <Text style={[styles.sectionTitle, styles.lightSectionTitle]}>资质信息</Text>
          </View>
          {allQualificationItems.length > 0 ? (
            <View style={{ gap: 6 }}>
              {allQualificationItems.map((q, idx) => (
                <Text key={idx} style={styles.qualItem}>• {q}</Text>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyTextLight}>暂无资质信息</Text>
          )}
        </Card>

        <Card style={[styles.sectionCard, styles.lightCard]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionBar, styles.sectionBarLight]} />
            <Text style={[styles.sectionTitle, styles.lightSectionTitle]}>注册人员</Text>
          </View>
          <Text style={styles.emptyTextLight}>暂无注册人员信息</Text>
        </Card>

        <Card style={[styles.sectionCard, styles.lightCard]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionBar, styles.sectionBarLight]} />
            <Text style={[styles.sectionTitle, styles.lightSectionTitle]}>历史业绩</Text>
          </View>
          <Text style={styles.emptyTextLight}>暂无历史业绩信息</Text>
        </Card>
      </ScrollView>
      )}

      {!isLoading && (
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={styles.smallActions}>
          <TouchableOpacity
            style={[styles.smallActionButton, !phoneNumber && styles.smallActionDisabled]}
            onPress={() => {
              if (!phoneNumber) return;
              Linking.openURL(`tel:${phoneNumber}`).catch(() => Alert.alert('提示', '无法拨打电话'));
            }}
            disabled={!phoneNumber}
          >
            <Phone color={phoneNumber ? "#666" : "#999"} size={18} />
            <Text style={[styles.smallActionText, !phoneNumber && styles.smallActionTextDisabled]}>电话</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.smallActionButton, !address && styles.smallActionDisabled]}
            onPress={() => {
              if (!address) return;
              Linking.openURL(`https://uri.amap.com/search?keyword=${encodeURIComponent(address)}`).catch(() => Alert.alert('提示', '无法打开导航'));
            }}
            disabled={!address}
          >
            <Navigation color={address ? "#666" : "#999"} size={18} />
            <Text style={[styles.smallActionText, !address && styles.smallActionTextDisabled]}>导航</Text>
          </TouchableOpacity>
        </View>

        {isClaimed ? (
          isMyEnterprise ? (
            enterprise.claim_status === 1 ? (
              <View style={[styles.primaryActionButton, { backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0' }]}>
                <Text style={[styles.primaryActionText, { color: '#666', fontSize: 16 }]}>认领审核中</Text>
              </View>
            ) : !isVip ? (
              <TouchableOpacity
                style={[styles.primaryActionButton, { backgroundColor: '#FFD700' }]}
                onPress={() => navigation.navigate('EnterpriseVipApply', { enterpriseId, enterpriseName: enterprise?.enterprise_name || '' })}
              >
                <Crown color="#80011A" size={18} />
                <Text style={[styles.primaryActionText, { color: '#80011A', fontSize: 16, fontWeight: '700' }]}>去认证</Text>
              </TouchableOpacity>
            ) : null
          ) : (
            <TouchableOpacity
              style={[styles.primaryActionButton, { backgroundColor: '#F0F0F0' }]}
              onPress={() => {
                Alert.alert(
                  '该企业已被认领',
                  '若被恶意占用或冒领，您可以提交证明材料进行申诉',
                  [
                    { text: '取消', style: 'cancel' },
                    {
                      text: '申诉',
                      style: 'destructive',
                      onPress: () => navigation.navigate('EnterpriseAppeal', { enterpriseId, enterpriseName: enterprise?.enterprise_name || '' })
                    }
                  ]
                );
              }}
            >
              <Shield color="#999" size={18} />
              <Text style={[styles.primaryActionText, { color: '#999', fontSize: 16 }]}>已被认领</Text>
            </TouchableOpacity>
          )
        ) : (
          <TouchableOpacity
            style={styles.primaryActionButton}
            onPress={() => navigation.navigate('EnterpriseClaim', { enterpriseId, enterpriseName: enterprise?.enterprise_name || '' })}
          >
            <User color="#fff" size={18} />
            <Text style={[styles.primaryActionText, { fontSize: 16 }]}>认领企业</Text>
          </TouchableOpacity>
        )}
      </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scrollView: { flex: 1 },
  content: { padding: Spacing.screenPadding, paddingTop: Spacing.base },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  lightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  basicInfoSection: {
    marginBottom: 10,
  },
  cardContent: { padding: 0 },
  headerRow: { flexDirection: 'row', marginBottom: 16 },
  logoImage: {
    width: 54,
    height: 54,
    borderRadius: BorderRadius.md,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
  },
  logoPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(128,1,26,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerInfo: { flex: 1, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: {
    fontSize: 16,
    fontWeight: FontWeight.semibold,
    lineHeight: 24,
    color: '#333',
    flex: 1,
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  vipBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFD700',
    marginLeft: 3,
  },
  tagsRow: { flexDirection: 'row', gap: 8 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagCity: {
    backgroundColor: 'rgba(128,1,26,0.08)',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  tagTextGray: {
    color: '#80011A',
  },
  descriptionSection: {
    backgroundColor: 'rgba(128,1,26,0.04)',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: 16,
  },
  descriptionText: { fontSize: 13, color: '#666', lineHeight: 20 },
  infoGrid: { flexDirection: 'row', marginBottom: 12 },
  infoItemHalf: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  infoRowSingle: { flexDirection: 'row', marginBottom: 12 },
  infoLabel: { fontSize: FontSize.xs, color: '#999', marginLeft: 6, marginRight: 8 },
  infoValue: { fontSize: FontSize.sm, color: '#333' },
  sectionCard: { marginBottom: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  sectionBar: { width: 4, height: 14, backgroundColor: Colors.text.tertiary, marginRight: Spacing.sm },
  sectionBarLight: { backgroundColor: THEME.primary },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#fff' },
  lightSectionTitle: { color: '#333' },
  listContainer: { gap: Spacing.sm },
  emptyTextLight: { fontSize: 14, color: '#999', textAlign: 'center', paddingVertical: 20 },
  qualItem: { fontSize: 13, color: '#333', lineHeight: 20 },
  horizontalScroll: { marginHorizontal: -Spacing.sm },
  albumImage: { width: 120, height: 90, borderRadius: BorderRadius.sm, marginHorizontal: Spacing.xs },
  honorItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  honorImage: { width: 48, height: 48, borderRadius: BorderRadius.sm, marginRight: Spacing.md },
  honorInfo: { flex: 1 },
  honorTitle: { fontSize: FontSize.sm, color: '#333', fontWeight: '500' },
  honorDate: { fontSize: FontSize.xs, color: '#999', marginTop: 2 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  gridItem: { width: (SCREEN_WIDTH - Spacing.screenPadding * 2 - Spacing.sm) / 2, backgroundColor: '#F8F8F8', borderRadius: BorderRadius.sm, padding: Spacing.sm },
  gridImage: { width: '100%', height: 80, borderRadius: BorderRadius.xs, marginBottom: Spacing.xs },
  gridTitle: { fontSize: FontSize.sm, color: '#333', fontWeight: '500' },
  gridDesc: { fontSize: FontSize.xs, color: '#666', marginTop: 2 },
  projectItem: { flexDirection: 'row', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  projectImage: { width: 80, height: 60, borderRadius: BorderRadius.sm, marginRight: Spacing.md },
  projectInfo: { flex: 1 },
  projectTitle: { fontSize: FontSize.sm, color: '#333', fontWeight: '500' },
  projectDate: { fontSize: FontSize.xs, color: '#999', marginTop: 2 },
  projectDesc: { fontSize: FontSize.xs, color: '#666', marginTop: 4 },
  newsItem: { flexDirection: 'row', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  newsImage: { width: 80, height: 60, borderRadius: BorderRadius.sm, marginRight: Spacing.md },
  newsInfo: { flex: 1, justifyContent: 'center' },
  newsTitle: { fontSize: FontSize.sm, color: '#333', fontWeight: '500' },
  newsDate: { fontSize: FontSize.xs, color: '#999', marginTop: 4 },
  contactItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  contactAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: THEME.primary, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  contactInfo: { flex: 1 },
  contactName: { fontSize: FontSize.sm, color: '#333', fontWeight: '500' },
  contactPosition: { fontSize: FontSize.xs, color: '#999', marginTop: 2 },
  contactPhone: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  contactPhoneText: { fontSize: FontSize.sm, color: THEME.primary },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', padding: Spacing.screenPadding, gap: Spacing.sm,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingBottom: Spacing.sm,
  },
  smallActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  smallActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  smallActionDisabled: { opacity: 0.4 },
  smallActionText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  smallActionTextDisabled: { color: '#999' },
  primaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: THEME.primary,
    borderRadius: 8,
    gap: 6,
  },
  primaryActionText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});

export default EnterpriseDetailScreen;
