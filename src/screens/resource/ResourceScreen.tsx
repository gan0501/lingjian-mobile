import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Alert,
  Animated,
  PanResponder,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Icon, Loading, UploadTypeSheet } from '@/components/common';
import { MapSearchBar } from '@/components/map';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants';
import { useAuthStore } from '@/stores';
import { resourceApi } from '@/services/resourceService';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - Spacing.screenPadding * 2;
const CARD_HEIGHT = CARD_WIDTH * (8 / 16);

const RESOURCE_CATEGORIES = [
  { id: 'norms', title: '规范', description: '海量规范资源', english: 'STANDARDS', color: '#4CAF50', icon: 'book' as const },
  { id: 'atlas', title: '图集', description: '丰富图集查询', english: 'ATLAS', color: '#2196F3', icon: 'fileText' as const },
  { id: 'prices', title: '信息价', description: '建材价格参考', english: 'PRICES', color: '#FF9800', icon: 'dollarSign' as const },
];

interface LatestResource {
  id: number;
  title: string;
  type: 'norm' | 'atlas' | 'material';
  code?: string;
  update_time?: string;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Resource'>;

const ResourceScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { isLoggedIn } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [cardOrder, setCardOrder] = useState([0, 1, 2]);
  const [latestResources, setLatestResources] = useState<LatestResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [hasShownLoginAlert, setHasShownLoginAlert] = useState(false);

  const cardAnims = useRef([
    { translateX: new Animated.Value(0), translateY: new Animated.Value(0), scale: new Animated.Value(1), rotate: new Animated.Value(0) },
    { translateX: new Animated.Value(0), translateY: new Animated.Value(0), scale: new Animated.Value(1), rotate: new Animated.Value(0) },
    { translateX: new Animated.Value(0), translateY: new Animated.Value(0), scale: new Animated.Value(1), rotate: new Animated.Value(0) },
  ]).current;

  const isAnimating = useRef(false);
  const cardOrderRef = useRef(cardOrder);

  useEffect(() => {
    cardOrderRef.current = cardOrder;
  }, [cardOrder]);

  useEffect(() => {
    if (isFocused && !isLoggedIn && !hasShownLoginAlert) {
      setHasShownLoginAlert(true);
      Alert.alert(
        '需要登录',
        '请先登录后再使用找资源功能',
        [
          { text: '取消', style: 'cancel', onPress: () => navigation.goBack() },
          { text: '去登录', onPress: () => navigation.navigate('Login') },
        ]
      );
    } else if (isLoggedIn) {
      loadLatestResources();
    }
  }, [isFocused, isLoggedIn]);

  useEffect(() => {
    // 初始化卡片位置
    cardAnims[0].translateY.setValue(0);
    cardAnims[0].scale.setValue(1);
    cardAnims[1].translateY.setValue(12);
    cardAnims[1].scale.setValue(0.95);
    cardAnims[2].translateY.setValue(24);
    cardAnims[2].scale.setValue(0.90);
  }, []);

  const loadLatestResources = async () => {
    try {
      setLoading(true);
      const data = await resourceApi.getLatest();
      if (data?.result?.list) {
        setLatestResources(data.result.list.slice(0, 5));
      }
    } catch (error) {
      console.log('Load latest resources error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) {
      navigation.navigate('ResourceSearchResult', {
        query: searchQuery.trim(),
        category: RESOURCE_CATEGORIES[cardOrderRef.current[0]].id,
      });
    }
  }, [searchQuery, navigation]);

  const swipeCard = useCallback((direction: 'left' | 'right') => {
    if (isAnimating.current) return;
    isAnimating.current = true;

    const currentOrder = cardOrderRef.current;
    const topCardIndex = currentOrder[0];
    const topAnim = cardAnims[topCardIndex];

    const exitX = direction === 'left' ? -SCREEN_WIDTH * 1.2 : SCREEN_WIDTH * 1.2;
    const exitRotate = direction === 'left' ? -0.3 : 0.3;

    Animated.parallel([
      Animated.timing(topAnim.translateX, { toValue: exitX, duration: 280, useNativeDriver: true }),
      Animated.timing(topAnim.rotate, { toValue: exitRotate, duration: 280, useNativeDriver: true }),
    ]).start(() => {
      const newOrder = [...currentOrder.slice(1), currentOrder[0]];
      setCardOrder(newOrder);

      topAnim.translateX.setValue(0);
      topAnim.rotate.setValue(0);
      topAnim.translateY.setValue(24);
      topAnim.scale.setValue(0.90);

      const newTopIndex = newOrder[0];
      const newMidIndex = newOrder[1];

      Animated.parallel([
        Animated.spring(cardAnims[newTopIndex].translateY, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
        Animated.spring(cardAnims[newTopIndex].scale, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
        Animated.spring(cardAnims[newMidIndex].translateY, { toValue: 12, friction: 7, tension: 60, useNativeDriver: true }),
        Animated.spring(cardAnims[newMidIndex].scale, { toValue: 0.95, friction: 7, tension: 60, useNativeDriver: true }),
      ]).start();

      setTimeout(() => { isAnimating.current = false; }, 150);
    });
  }, [cardAnims]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isAnimating.current,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 10 && !isAnimating.current,
      onPanResponderMove: (_, gestureState) => {
        const currentOrder = cardOrderRef.current;
        const topCardIndex = currentOrder[0];
        const topAnim = cardAnims[topCardIndex];
        topAnim.translateX.setValue(gestureState.dx);
        topAnim.rotate.setValue(gestureState.dx / SCREEN_WIDTH * 0.3);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -80) {
          swipeCard('left');
        } else if (gestureState.dx > 80) {
          swipeCard('right');
        } else {
          const currentOrder = cardOrderRef.current;
          const topCardIndex = currentOrder[0];
          const topAnim = cardAnims[topCardIndex];
          Animated.parallel([
            Animated.spring(topAnim.translateX, { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
            Animated.spring(topAnim.rotate, { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  const handleResourcePress = (item: LatestResource) => {
    if (item.type === 'norm') {
      navigation.navigate('NormReader', { normId: item.id });
    } else if (item.type === 'atlas') {
      navigation.navigate('AtlasViewer', { atlasId: item.id });
    }
  };

  const handleUploadPress = (uploadType: 'norm' | 'atlas' | 'material') => {
    setShowUploadModal(false);
    if (!isLoggedIn) {
      Alert.alert('提示', '请先登录', [
        { text: '取消', style: 'cancel' },
        { text: '去登录', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    navigation.navigate('ResourceUpload', { uploadType });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'norm': return 'book';
      case 'atlas': return 'fileText';
      default: return 'dollarSign';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'norm': return '#4CAF50';
      case 'atlas': return '#2196F3';
      default: return '#FF9800';
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'norm': return '规范';
      case 'atlas': return '图集';
      default: return '信息价';
    }
  };

  const getCardGradient = (id: string) => {
    switch (id) {
      case 'norms':
        return {
          colors: ['#E8F5E9', '#C8E6C9', '#A5D6A7'] as const,
          shadowColor: '#4CAF50',
          glowColors: ['rgba(76, 175, 80, 0.3)', 'rgba(76, 175, 80, 0.1)'],
        };
      case 'atlas':
        return {
          colors: ['#E3F2FD', '#BBDEFB', '#90CAF9'] as const,
          shadowColor: '#2196F3',
          glowColors: ['rgba(33, 150, 243, 0.3)', 'rgba(33, 150, 243, 0.1)'],
        };
      case 'prices':
        return {
          colors: ['#FFF3E0', '#FFE0B2', '#FFCC80'] as const,
          shadowColor: '#FF9800',
          glowColors: ['rgba(255, 152, 0, 0.3)', 'rgba(255, 152, 0, 0.1)'],
        };
      default:
        return {
          colors: ['#F5F5F5', '#E0E0E0', '#BDBDBD'] as const,
          shadowColor: '#9E9E9E',
          glowColors: ['rgba(158, 158, 158, 0.3)', 'rgba(158, 158, 158, 0.1)'],
        };
    }
  };

  const renderCard = (dataIndex: number) => {
    const item = RESOURCE_CATEGORIES[dataIndex];
    const stackPosition = cardOrder.indexOf(dataIndex);
    const anim = cardAnims[dataIndex];
    const gradient = getCardGradient(item.id);

    const rotateStr = anim.rotate.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: ['-30deg', '0deg', '30deg'],
    });

    return (
      <Animated.View
        key={item.id}
        style={[
          styles.card,
          {
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            zIndex: RESOURCE_CATEGORIES.length - stackPosition,
            transform: [
              { translateX: anim.translateX },
              { translateY: anim.translateY },
              { scale: anim.scale },
              { rotate: rotateStr },
            ],
            shadowColor: gradient.shadowColor,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 16,
            elevation: 10,
          },
        ]}
        {...(stackPosition === 0 ? panResponder.panHandlers : {})}
      >
        {/* 光晕效果背景 */}
        <View style={[styles.cardGlow, { backgroundColor: gradient.glowColors[0] }]} />
        
        <LinearGradient
          colors={gradient.colors}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          {/* 装饰性光斑 */}
          <View style={[styles.cardHighlight, { backgroundColor: 'rgba(255,255,255,0.4)' }]} />
          
          <View style={styles.cardHeader}>
            <View style={[styles.cardNumberBox, { 
              backgroundColor: 'rgba(255,255,255,0.9)',
              shadowColor: item.color,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4,
            }]}>
              <Text style={[styles.cardNumber, { color: item.color }]}>{dataIndex + 1}</Text>
            </View>
            <Text style={[styles.cardTitle, { color: '#1e293b' }]}>{item.title}</Text>
          </View>
          <Text style={[styles.cardDescription, { color: '#475569' }]}>{item.description}</Text>
          <View style={styles.cardBottomRow}>
            <Text style={[styles.cardEnglish, { color: item.color, opacity: 0.8 }]}>{item.english}</Text>
            <View style={[styles.swipeHintBox, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
              <Icon name="arrow-left" size={10} color="#64748b" />
              <Text style={[styles.swipeHintText, { color: '#64748b' }]}>滑动切换</Text>
              <Icon name="arrow-right" size={10} color="#64748b" />
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  const currentCategory = RESOURCE_CATEGORIES[cardOrder[0]];

  const renderContent = () => (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.whiteBackground} />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Icon name="chevronLeft" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>找资源</Text>
        <TouchableOpacity style={styles.iconButton} onPress={() => setShowUploadModal(true)}>
          <Icon name="upload" size={20} color="#1e293b" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
          <View style={styles.cardStack}>
            {[0, 1, 2].map((dataIndex) => renderCard(dataIndex))}
          </View>

          <View style={styles.indicatorContainer}>
            {[0, 1, 2].map((index) => (
              <View
                key={index}
                style={[styles.indicator, cardOrder[0] === index && styles.indicatorActive]}
              />
            ))}
          </View>

          <Text style={styles.hintText}>
            当前搜索: {currentCategory.title}
          </Text>
          <Text style={styles.swipeHint}>左右滑动切换</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Loading color="#FFF" />
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Icon name="clock" size={18} color="#888" />
                  <Text style={styles.sectionTitle}>最新共享</Text>
              </View>
            </View>

            {latestResources.length > 0 ? (
              latestResources.map((item) => (
                <TouchableOpacity
                  key={`${item.type}_${item.id}`}
                  style={[styles.resourceItem, styles.resourceItemDark]}
                  onPress={() => handleResourcePress(item)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.resourceIconBox, { backgroundColor: `${getTypeColor(item.type)}20` }]}>
                    <Icon name={getTypeIcon(item.type)} size={18} color={getTypeColor(item.type)} />
                  </View>
                  <View style={styles.resourceContent}>
                    <Text style={styles.resourceTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={styles.resourceMeta}>
                      <Text style={styles.resourceType}>{getTypeName(item.type)}</Text>
                      {item.code && <Text style={styles.resourceCode}>{item.code}</Text>}
                    </View>
                  </View>
                  <Icon name="chevronRight" size={20} color="#666" />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>暂无最新共享</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles.searchBarContainer, { paddingBottom: insets.bottom + 15 }]}>
        <MapSearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmit={handleSearch}
          placeholder="搜索规范、图集、信息价..."
          showAddButton={true}
          onAddPress={() => setShowUploadModal(true)}
          enableVoice={true}
          absolute={false}
          avoidKeyboard={Platform.OS === 'android'}
        />
      </View>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: '#F0F4F7' }]}>
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F0F4F7' }} behavior="padding">
          {renderContent()}
        </KeyboardAvoidingView>
      ) : (
        <View style={{ flex: 1, backgroundColor: '#F0F4F7' }}>
          {renderContent()}
        </View>
      )}

      <UploadTypeSheet
        visible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSelect={handleUploadPress}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F7',
  },
  whiteBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F0F4F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.base,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.screenPadding,
  },
  cardStack: {
    height: CARD_HEIGHT + 20,
    marginBottom: 8,
    position: 'relative',
  },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.6,
  },
  cardHighlight: {
    position: 'absolute',
    top: 20,
    right: 30,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.5,
  },
  cardGradient: {
    flex: 1,
    borderRadius: 16,
    padding: Spacing.lg,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardNumberBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardNumber: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  cardTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
  },
  cardDescription: {
    fontSize: FontSize.sm,
    color: '#64748b',
  },
  cardEnglish: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 2,
    opacity: 0.8,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  swipeHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  swipeHintText: {
    fontSize: 9,
    color: '#94a3b8',
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: 12,
    marginTop: 8,
  },
  indicator: {
    width: 6,
    height: 3,
    borderRadius: 0,
    backgroundColor: '#cbd5e1',
  },
  indicatorActive: {
    backgroundColor: '#B20000',
    width: 20,
    height: 3,
    borderRadius: 0,
  },
  hintText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: FontSize.xs,
    marginBottom: 6,
    marginTop: 4,
  },
  swipeHint: {
    display: 'none',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.base,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    borderRadius: 0,
    backgroundColor: '#F0F4F7',
    marginBottom: Spacing.sm,
    // 拟物风阴影 - 左上角亮，右下角暗
    shadowColor: '#ffffff',
    shadowOffset: { width: -3, height: -3 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
  },
  resourceItemDark: {
    shadowColor: '#94a3b8',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  resourceIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.base,
  },
  resourceContent: {
    flex: 1,
  },
  resourceTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: '#1e293b',
    marginBottom: 4,
  },
  resourceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  resourceType: {
    fontSize: FontSize.xs,
    color: '#64748b',
  },
  resourceCode: {
    fontSize: FontSize.xs,
    color: '#94a3b8',
  },
  emptyBox: {
    padding: Spacing.lg,
    borderRadius: 0,
    backgroundColor: '#F0F4F7',
    alignItems: 'center',
    shadowColor: '#ffffff',
    shadowOffset: { width: -3, height: -3 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: '#64748b',
  },
  searchBarContainer: {
    paddingBottom: 0,
  },
  aiDisclaimer: {
    fontSize: FontSize.xs,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 0,
  },
});

export default ResourceScreen;
