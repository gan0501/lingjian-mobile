import React, { FC, useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking, Image, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Calendar, Phone, Factory, Navigation, User, CreditCard, Building2, ShoppingBag, Shield, Star, Crown, Edit3, FileText, Users } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import { WebView } from 'react-native-webview';
import { useAuthStore } from '@/stores/useAuthStore';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/common/Card';
import { Loading } from '@/components/common/Loading';
import { Colors, getManufacturerColor } from '@/constants/colors';
import { Spacing, BorderRadius } from '@/constants/spacing';
import { TextStyles, FontSize, FontWeight } from '@/constants/typography';
import type { RootStackScreenProps } from '@/navigation/types';
import { useManufacturerDetail, useManufacturerVipDetail } from '@/hooks/useEnterprises';
import { MANUFACTURER_TYPES } from '@/constants/config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TIANDITU_KEY = '5f0faa0b93213cc747eebab0891c2cfc';

const THEME = {
  primary: '#80011A',
  secondary: '#000000',
};

type Props = RootStackScreenProps<'ManufacturerDetail'>;

const ManufacturerDetailScreen: FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { manufacturerId, manufacturerType } = route.params;
  const { user, userInfo, isLoggedIn } = useAuthStore();
  const currentUserId = user?.id || (user as any)?.user_id || userInfo?.id || (userInfo as any)?.user_id;

  const { data: manufacturer, isLoading } = useManufacturerDetail(manufacturerId, manufacturerType);

  const [logoError, setLogoError] = useState(false);
  const [mapTouched, setMapTouched] = useState(false);
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
    const verified = manufacturer?.is_verified;
    if (typeof verified === 'string') {
      return verified === '3' || verified === '4';
    }
    if (typeof verified === 'number') {
      return verified >= 3;
    }
    return manufacturer?.is_vip || false;
  }, [manufacturer?.is_verified, manufacturer?.is_vip]);

  const { data: vipDetail, isLoading: vipLoading } = useManufacturerVipDetail(manufacturerId, isVip);

  const typeColor = useMemo(() => {
    return getManufacturerColor(manufacturer?.enterprise_type || 0);
  }, [manufacturer?.enterprise_type]);

  const typeName = useMemo(() => {
    const t = MANUFACTURER_TYPES.find((x) => x.id === manufacturer?.enterprise_type);
    return t?.name || '厂家';
  }, [manufacturer?.enterprise_type]);

  const cityLabel = useMemo(() => {
    const raw = String(manufacturer?.city || '').trim();
    if (raw) return raw;
    const addr = String(manufacturer?.register_address || '').trim();
    if (!addr) return '';
    const m = addr.match(/([\u4e00-\u9fa5]{2,8}市)/);
    return m?.[1] || '';
  }, [manufacturer?.city, manufacturer?.register_address]);

  const isValidUrl = (url: string | undefined | null): boolean => {
    if (!url || typeof url !== 'string') return false;
    return /^https?:\/\//.test(url.trim());
  };

  const logoUri = useMemo(() => {
    if (isValidUrl(manufacturer?.logo_url)) return manufacturer!.logo_url;
    return null;
  }, [manufacturer?.logo_url]);

  const phoneNumber = (manufacturer?.contact_phone || manufacturer?.contactPhone || '').trim();
  const address = (manufacturer?.register_address || manufacturer?.registerAddress || '').trim();

  const allQualificationItems = useMemo(() => {
    const raw1 = String(manufacturer?.qualification || '').trim();
    const raw2 = String(manufacturer?.qualification2 || '').trim();
    const items1 = (raw1 && raw1 !== '无') ? raw1.split(/[\n;；、，,]+/).map(s => s.trim()).filter(Boolean) : [];
    const items2 = raw2 ? raw2.split(/[\n;；、，,]+/).map(s => s.trim()).filter(Boolean) : [];
    const set = new Set(items1.map(s => s.toLowerCase()));
    const merged = [...items1];
    items2.forEach(item => {
      if (!set.has(item.toLowerCase())) { merged.push(item); set.add(item.toLowerCase()); }
    });
    return merged;
  }, [manufacturer?.qualification, manufacturer?.qualification2]);

  const isClaimed = manufacturer?.claim_status === 1 || manufacturer?.claim_status === 2;

  const isMyManufacturer = useMemo(() => {
    if (!isLoggedIn || !finalUserId || !manufacturer) return false;
    return isClaimed && String(manufacturer.claim_user_id) === String(finalUserId);
  }, [isLoggedIn, finalUserId, manufacturer, isClaimed]);

  const album = vipDetail?.album || [];
  const honors = vipDetail?.honors || [];
  const news = vipDetail?.news || [];
  const products = vipDetail?.products || [];
  const projects = vipDetail?.projects || [];
  const contacts = vipDetail?.contacts || [];

  return (
    <View style={styles.container}>
      <Header
        title="厂家详情"
        showBack
        onBack={() => navigation.goBack()}
        backgroundColor="#FFFFFF"
        titleColor="#333"
        iconColor="#333"
        rightIcon={isMyManufacturer ? <Edit3 color={Colors.primary[600]} size={20} /> : undefined}
        onRightPress={isMyManufacturer ? () => navigation.navigate('ManufacturerEdit', { manufacturerId }) : undefined}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
        scrollEnabled={!mapTouched}
      >
        {manufacturer && (
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
                  <Factory color="rgba(128,1,26,0.5)" size={32} />
                </View>
              )}
              <View style={styles.headerInfo}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>{manufacturer?.enterprise_name || '—'}</Text>
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

            {isVip && manufacturer?.description && (
              <View style={styles.descriptionSection}>
                <Text style={styles.descriptionText}>{manufacturer.description}</Text>
              </View>
            )}

            <View style={styles.infoGrid}>
              <View style={styles.infoItemHalf}>
                <User color="#999" size={14} />
                <Text style={styles.infoLabel}>法定代表人</Text>
                <Text style={styles.infoValue}>{manufacturer?.legal_person || manufacturer?.legalPerson || '—'}</Text>
              </View>
              <View style={styles.infoItemHalf}>
                <CreditCard color={Colors.text.tertiary} size={14} />
                <Text style={styles.infoLabel}>注册资本</Text>
                <Text style={styles.infoValue}>{manufacturer?.register_capital || manufacturer?.registerCapital || '—'}</Text>
              </View>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoItemHalf}>
                <Building2 color={Colors.text.tertiary} size={14} />
                <Text style={styles.infoLabel}>企业状态</Text>
                <Text style={styles.infoValue}>{manufacturer?.enterprise_status || manufacturer?.enterpriseStatus || '—'}</Text>
              </View>
              <View style={styles.infoItemHalf}>
                <Calendar color={Colors.text.tertiary} size={14} />
                <Text style={styles.infoLabel}>成立日期</Text>
                <Text style={styles.infoValue}>{manufacturer?.establish_date || manufacturer?.establishDate || '—'}</Text>
              </View>
            </View>

            <View style={styles.infoRowSingle}>
              <FileText color={Colors.text.tertiary} size={14} />
              <Text style={styles.infoLabel}>信用代码</Text>
              <Text style={[styles.infoValue, { flex: 1 }]} numberOfLines={1}>{manufacturer?.credit_code || manufacturer?.creditCode || '—'}</Text>
            </View>

            {!!(manufacturer?.contributors_in || manufacturer?.contributorsIn || '').trim() && (
              <View style={styles.infoRowSingle}>
                <Users color={Colors.text.tertiary} size={14} />
                <Text style={styles.infoLabel}>社保人员</Text>
                <Text style={styles.infoValue}>{manufacturer?.contributors_in || manufacturer?.contributorsIn}</Text>
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
          <Card style={[styles.sectionCard, styles.darkCard]}>
            <View style={styles.sectionHeader}>
              <ShoppingBag color={Colors.text.tertiary} size={18} />
              <Text style={styles.sectionTitle}>厂家相册</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {album.map((item, idx) => (
                <Image key={`album-${idx}`} source={{ uri: item.image_url }} style={styles.albumImage} />
              ))}
            </ScrollView>
          </Card>
        )}

        {isVip && honors.length > 0 && (
          <Card style={[styles.sectionCard, styles.darkCard]}>
            <View style={styles.sectionHeader}>
              <Shield color={Colors.text.tertiary} size={18} />
              <Text style={styles.sectionTitle}>厂家荣誉</Text>
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
          <Card style={[styles.sectionCard, styles.darkCard]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionBar} />
              <Text style={styles.sectionTitle}>厂家产品</Text>
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
          <Card style={[styles.sectionCard, styles.darkCard]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionBar} />
              <Text style={styles.sectionTitle}>合作项目</Text>
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
          <Card style={[styles.sectionCard, styles.darkCard]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionBar} />
              <Text style={styles.sectionTitle}>厂家动态</Text>
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
          <Card style={[styles.sectionCard, styles.darkCard]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionBar} />
              <Text style={styles.sectionTitle}>销售座席</Text>
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
            <Text style={[styles.sectionTitle, styles.lightSectionTitle]}>主营产品 / 资质</Text>
          </View>
          {allQualificationItems.length > 0 ? (
            <View style={{ gap: 6 }}>
              {allQualificationItems.map((q, idx) => (
                <Text key={idx} style={styles.qualItem}>• {q}</Text>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyTextLight}>暂无主营产品信息</Text>
          )}
        </Card>

        <Card style={[styles.sectionCard, styles.lightCard]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionBar, styles.sectionBarLight]} />
            <Text style={[styles.sectionTitle, styles.lightSectionTitle]}>最新动态</Text>
          </View>
          <Text style={styles.emptyTextLight}>该厂家近期暂无相关动态</Text>
        </Card>

        <Card style={[styles.sectionCard, styles.lightCard]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionBar, styles.sectionBarLight]} />
            <Text style={[styles.sectionTitle, styles.lightSectionTitle]}>历史业绩</Text>
          </View>
          <Text style={styles.emptyTextLight}>暂无历史业绩信息</Text>
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
            <Text style={[styles.sectionTitle, styles.lightSectionTitle]}>厂家简介</Text>
          </View>
          {!!(manufacturer?.description || '').trim() ? (
            <Text style={styles.descriptionText}>{manufacturer?.description}</Text>
          ) : (
            <Text style={styles.emptyTextLight}>暂无厂家简介</Text>
          )}
        </Card>

        {!!(manufacturer?.lat && manufacturer?.lon) && (
          <Card style={[styles.sectionCard, styles.lightCard]} noPadding>
            <View style={styles.sectionHeaderWithPadding}>
              <View style={[styles.sectionBar, styles.sectionBarLight]} />
              <Text style={[styles.sectionTitle, styles.lightSectionTitle]}>厂家位置</Text>
            </View>
            <View
              style={styles.mapContainer}
              onTouchStart={() => setMapTouched(true)}
              onTouchEnd={() => setMapTouched(false)}
            >
              <WebView
                source={{
                  html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=18.0, minimum-scale=1.0, user-scalable=yes">
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; }
  </style>
  <script src="https://api.tianditu.gov.cn/api?v=4.0&tk=${TIANDITU_KEY}"></script>
</head>
<body>
  <div id="map"></div>
  <script>
    var vecUrl = 'https://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_KEY}';
    var cvaUrl = 'https://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_KEY}';
    var vecLayer = new T.TileLayer(vecUrl, {minZoom: 1, maxZoom: 18});
    var cvaLayer = new T.TileLayer(cvaUrl, {minZoom: 1, maxZoom: 18});
    var map = new T.Map('map', {
      projection: 'EPSG:900913',
      layers: [vecLayer, cvaLayer]
    });
    map.centerAndZoom(new T.LngLat(${manufacturer.lon}, ${manufacturer.lat}), 13);

    var marker = new T.Marker(new T.LngLat(${manufacturer.lon}, ${manufacturer.lat}));
    map.addOverLay(marker);
  </script>
</body>
</html>
                  `,
                  baseUrl: 'https://api.tianditu.gov.cn'
                }}
                style={styles.mapWebView}
                nestedScrollEnabled={true}
              />
              <TouchableOpacity
                style={styles.mapFullscreenBtn}
                onPress={() => navigation.navigate('ManufacturerMapFullScreen', {
                  lat: manufacturer.lat!,
                  lon: manufacturer.lon!,
                  name: manufacturer.enterprise_name || '厂家位置'
                })}
              >
                <Text style={styles.mapFullscreenBtnText}>全屏</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}
      </ScrollView>

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
          isMyManufacturer ? (
            manufacturer.claim_status === 1 ? (
              <View style={[styles.primaryActionButton, { backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0' }]}>
                <Text style={[styles.primaryActionText, { color: '#666', fontSize: 16 }]}>认领审核中</Text>
              </View>
            ) : !isVip ? (
              <TouchableOpacity
                style={[styles.primaryActionButton, { backgroundColor: '#FFD700' }]}
                onPress={() => navigation.navigate('ManufacturerVipApply', { manufacturerId, manufacturerName: manufacturer?.enterprise_name || '' })}
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
                  '该厂家已被认领',
                  '若被恶意占用或冒领，您可以提交证明材料进行申诉',
                  [
                    { text: '取消', style: 'cancel' },
                    {
                      text: '申诉',
                      style: 'destructive',
                      onPress: () => navigation.navigate('ManufacturerAppeal', { manufacturerId, manufacturerName: manufacturer?.enterprise_name || '' })
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
            onPress={() => navigation.navigate('ManufacturerClaim', { manufacturerId, manufacturerName: manufacturer?.enterprise_name || '' })}
          >
            <User color="#fff" size={18} />
            <Text style={[styles.primaryActionText, { fontSize: 16 }]}>认领厂家</Text>
          </TouchableOpacity>
        )}
      </View>
      )}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <Loading text="加载厂家详情..." />
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
  darkCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 16,
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
  cardContent: {
    padding: 0,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
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
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
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
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagCity: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  tagTextGray: {
    color: 'rgba(255,255,255,0.7)',
  },
  descriptionSection: {
    marginTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  descriptionText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
  },
  infoGrid: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoItemHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoRowSingle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: FontSize.xs,
    color: '#999',
    marginLeft: 6,
    marginRight: 8,
  },
  infoValue: {
    fontSize: FontSize.sm,
    color: '#333',
  },
  sectionCard: {
    marginBottom: 10,
  },
  sectionBar: {
    width: 4,
    height: 14,
    backgroundColor: Colors.text.tertiary,
    marginRight: Spacing.sm,
  },
  sectionBarLight: {
    backgroundColor: THEME.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderWithPadding: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  lightSectionTitle: {
    color: '#333',
  },
  horizontalScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  albumImage: {
    width: 120,
    height: 90,
    borderRadius: 8,
    marginRight: 8,
  },
  listContainer: {
    gap: 10,
  },
  honorItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  honorImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  honorInfo: {
    flex: 1,
  },
  honorTitle: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  honorDate: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  emptyTextLight: {
    ...TextStyles.body,
    color: Colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  qualItem: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  mapContainer: {
    height: 180,
    backgroundColor: '#f5f5f5',
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mapWebView: {
    flex: 1,
  },
  mapFullscreenBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  mapFullscreenBtnText: {
    color: '#fff',
    fontSize: 12,
  },
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
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: (SCREEN_WIDTH - 32 - 32 - 10) / 2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  gridImage: {
    width: '100%',
    height: 100,
    borderRadius: 8,
  },
  gridTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  gridDesc: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  projectInfo: {
    flex: 1,
  },
  projectTitle: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  projectDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  projectDesc: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  newsItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newsImage: {
    width: 80,
    height: 56,
    borderRadius: 6,
    marginRight: 12,
  },
  newsInfo: {
    flex: 1,
  },
  newsTitle: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  newsDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  contactPosition: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  contactPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contactPhoneText: {
    fontSize: 13,
    color: THEME.primary,
    fontWeight: '500',
  },
});

export default ManufacturerDetailScreen;
