import { Loading, UploadTypeSheet } from '@/components/common';
import React, { FC, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronRight, BookOpen, FileText, DollarSign, Upload, ChevronLeft } from 'lucide-react-native';
import { DayColors, Spacing, API_CONFIG } from '@/constants';
import { getCityName } from '@/constants/cityMapping';
import { MapSearchBar } from '@/components/map';
import { useMapStore } from '@/stores/useMapStore';
import { useOverlay } from '@/components/overlay/OverlayProvider';

interface ResourceSearchResultScreenProps {
  query: string;
  category?: string;
}

interface SearchDocument {
  id: number;
  type: 'norm' | 'atlas' | 'material';
  title?: string;
  code?: string;
  path?: string;
  match_score?: number;
  publish_date?: string;
  area?: string;
  price?: string;
  city_code?: string;
  year?: string;
  month?: string;
  tax_included_price?: string;
  tax_excluded_price?: string;
  specification?: string;
  province?: string;
  city?: string;
}

interface SearchResult {
  query: string;
  total: number;
  max_score: number;
  need_ai_assist: boolean;
  has_results: boolean;
  list: SearchDocument[];
}

interface AIResult {
  success: boolean;
  answer: string;
  keywords: string[];
  recommended_documents: SearchDocument[];
}

interface InfoPriceSlots {
  material: string | null;
  city: string | null;
  city_code: string | null;
  period: string | null;
}

interface InfoPriceOption {
  label: string;
  value: string;
  count?: number;
}

interface InfoPriceCity {
  label: string;
  value: string;
}

interface InfoPriceProvinceGroup {
  province: string;
  cities: InfoPriceCity[];
}

interface InfoPricePriceItem {
  id: number;
  material_name?: string;
  spec_model: string;
  unit: string;
  tax_included_price: number;
  tax_excluded_price: number;
  year: number;
  month: number;
}

interface InfoPriceAIResult {
  type: 'material_disambiguation' | 'city_required' | 'price_result' | 'price_result_fallback' | 'text_reply';
  message: string;
  options?: InfoPriceOption[];
  material?: string;
  province_groups?: InfoPriceProvinceGroup[];
  total_cities?: number;
  city?: string;
  province?: string;
  city_code?: string;
  requested_period?: string;
  actual_period?: string;
  is_fallback?: boolean;
  total_count?: number;
  show_count?: number;
  data?: InfoPricePriceItem[];
  slots?: InfoPriceSlots;
}

interface InfoPriceChatMessage {
  role: 'user' | 'ai';
  text?: string;
  result?: InfoPriceAIResult;
}

const ResourceSearchResultScreen: FC = () => {
  const route = useRoute<any>();
  const { query: routeQuery, category } = route.params || {};
  const query = routeQuery || '';
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const overlay = useOverlay();
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [infoPriceResult, setInfoPriceResult] = useState<InfoPriceAIResult | null>(null);
  const [infoPriceLoading, setInfoPriceLoading] = useState(false);
  const [infoPriceSlots, setInfoPriceSlots] = useState<InfoPriceSlots>({ material: null, city: null, city_code: null, period: null });
  const [priceExpanded, setPriceExpanded] = useState(false);
  const isInfoPriceMode = category === 'prices';
  const [searchQuery, setSearchQuery] = useState<string>(query || '');
  const [followUpQuery, setFollowUpQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<InfoPriceChatMessage[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const { userCity, userProvince } = useMapStore();

  const selectedDocType = useMemo<SearchDocument['type'] | null>(() => {
    if (!category) return null;
    switch (category) {
      case 'norms':
        return 'norm';
      case 'atlas':
        return 'atlas';
      case 'prices':
        return 'material';
      default:
        return null;
    }
  }, [category]);

  const filteredResultList = useMemo(() => {
    const list = searchResult?.list || [];
    if (!selectedDocType) return list;
    return list.filter((doc) => doc.type === selectedDocType);
  }, [searchResult?.list, selectedDocType]);

  const aiRecommendedDocs = useMemo(() => {
    return aiResult?.recommended_documents || [];
  }, [aiResult?.recommended_documents]);

  const sortedResultList = useMemo(() => {
    const list = filteredResultList;
    const typePriority: Record<SearchDocument['type'], number> = {
      norm: 0,
      atlas: 1,
      material: 2,
    };
    return [...list].sort((a, b) => {
      const pa = typePriority[a.type] ?? 99;
      const pb = typePriority[b.type] ?? 99;
      if (pa !== pb) return pa - pb;
      return (b.match_score || 0) - (a.match_score || 0);
    });
  }, [filteredResultList]);

  const headerHeight = 60 + insets.top;
  const contentHeight = screenHeight - headerHeight;
  const upperHalfHeight = contentHeight * 0.5;

  const performSearch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const resourceType = selectedDocType || '';
      const searchUrl = `${API_CONFIG.BASE_URL}/api/resource/intelligent-search?query=${encodeURIComponent(query)}&page=1&page_size=20${resourceType ? `&resource_type=${resourceType}` : ''}`;

      console.log('[ResourceSearch] API URL:', searchUrl);
      console.log('[ResourceSearch] BASE_URL:', API_CONFIG.BASE_URL);

      const response = await fetch(searchUrl);
      console.log('[ResourceSearch] Response status:', response.status);
      if (!response.ok) throw new Error('搜索请求失败');

      const data = await response.json();
      console.log('[ResourceSearch] Response data:', JSON.stringify(data).substring(0, 500));

      if (data.code === 200 && data.result) {
        const allList = data.result.list || [];
        const filteredList = selectedDocType
          ? allList.filter((item: any) => item.type === selectedDocType)
          : allList;

        const filteredTotal = filteredList.length;
        const filteredMaxScore = filteredList.length > 0
          ? Math.max(...filteredList.map((item: any) => item.match_score || 0))
          : 0;
        const hasResults = filteredTotal > 0;
        const needAiAssist = !hasResults || filteredMaxScore < 60;

        const enrichedResult = {
          ...data.result,
          list: filteredList,
          total: filteredTotal,
          max_score: filteredMaxScore,
          has_results: hasResults,
          need_ai_assist: needAiAssist,
        };

        setSearchResult(enrichedResult);

        if (enrichedResult.need_ai_assist) {
          fetchAIAssist();
        }
      } else {
        setError(data.message || '搜索失败');
      }
    } catch (err) {
      console.error('搜索错误:', err);
      setError('搜索请求失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  }, [query, selectedDocType]);

  const fetchAIAssist = useCallback(async () => {
    try {
      setAiLoading(true);
      setAiError(null);
      const url = `${API_CONFIG.BASE_URL}/api/agentscope/resource-agent/analyze`;
      console.log('[AI Assist] Request URL:', url);
      console.log('[AI Assist] Query:', query);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      console.log('[AI Assist] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI辅助请求失败:', response.status, errorText);
        setAiError('AI服务请求失败');
        return;
      }
      const data = await response.json();
      console.log('[AI Assist] Response:', JSON.stringify(data).substring(0, 200));
      setAiResult(data);
    } catch (err) {
      console.error('AI辅助错误:', err);
      setAiError('AI服务连接异常');
    } finally {
      setAiLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (isInfoPriceMode) {
      performInfoPriceSearch(query);
    } else {
      performSearch();
    }
  }, [performSearch, isInfoPriceMode]);

  const performInfoPriceSearch = useCallback(async (searchQuery: string, ctx?: InfoPriceSlots, isFollowUp: boolean = false) => {
    try {
      if (isFollowUp && infoPriceResult) {
        setChatHistory(prev => [
          ...prev,
          { role: 'ai', result: infoPriceResult },
          { role: 'user', text: searchQuery },
        ]);
      } else if (!isFollowUp) {
        setChatHistory([{ role: 'user', text: searchQuery }]);
      }

      setInfoPriceLoading(true);
      setPriceExpanded(false);
      setInfoPriceResult(null);
      const context = ctx || infoPriceSlots;

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/resource/info-price/ai-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, context, user_city: userCity || '', user_province: userProvince || '' }),
      });

      if (!response.ok) throw new Error('搜索请求失败');
      const data = await response.json();

      if (data.code === 200 && data.result) {
        const result = data.result as InfoPriceAIResult;
        setInfoPriceResult(result);
        if (result.slots) {
          setInfoPriceSlots(result.slots);
        }
      } else {
        setInfoPriceResult({
          type: 'text_reply',
          message: data.message || '搜索失败，请重试',
          slots: infoPriceSlots,
        });
      }
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (err) {
      console.error('[信息价AI] 搜索失败:', err);
      setInfoPriceResult({
        type: 'text_reply',
        message: '网络连接失败，请检查网络后重试。',
        slots: infoPriceSlots,
      });
    } finally {
      setInfoPriceLoading(false);
      setLoading(false);
    }
  }, [infoPriceSlots, infoPriceResult]);

  const handleMaterialChipPress = useCallback((materialName: string) => {
    const newSlots: InfoPriceSlots = { ...infoPriceSlots, material: materialName };
    setInfoPriceSlots(newSlots);
    performInfoPriceSearch(materialName, newSlots, true);
  }, [infoPriceSlots, performInfoPriceSearch]);

  const handleCityChipPress = useCallback((cityCode: string, cityName: string) => {
    const newSlots: InfoPriceSlots = { ...infoPriceSlots, city: cityName, city_code: cityCode };
    setInfoPriceSlots(newSlots);
    performInfoPriceSearch(`${infoPriceSlots.material || ''} ${cityName}`, newSlots, true);
  }, [infoPriceSlots, performInfoPriceSearch]);

  const handleFollowUp = useCallback(() => {
    const text = followUpQuery.trim();
    if (!text) return;
    setFollowUpQuery('');
    performInfoPriceSearch(text, infoPriceSlots, true);
  }, [followUpQuery, infoPriceSlots, performInfoPriceSearch]);

  const renderAIResultCard = (result: InfoPriceAIResult, isLatest: boolean) => (
    <>
      <View style={ipStyles.aiMessageCard}>
        <Image source={require('@/assets/images/icon-64.png')} style={ipStyles.aiIcon} />
        <Text style={ipStyles.aiMessageText}>{result.message}</Text>
      </View>

      {result.type === 'material_disambiguation' && result.options && (
        <View style={ipStyles.chipsContainer}>
          {result.options.map((opt, idx) => (
            <TouchableOpacity
              key={idx}
              style={[ipStyles.chip, !isLatest && { opacity: 0.5 }]}
              onPress={() => isLatest && handleMaterialChipPress(opt.value)}
              activeOpacity={isLatest ? 0.7 : 1}
              disabled={!isLatest}
            >
              <Text style={ipStyles.chipText}>{opt.label}</Text>
              {opt.count !== undefined && (
                <Text style={ipStyles.chipCount}>{opt.count}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {result.type === 'city_required' && result.province_groups && (
        <View style={ipStyles.cityContainer}>
          {result.province_groups.map((group, gIdx) => (
            <View key={gIdx} style={ipStyles.provinceGroup}>
              <Text style={ipStyles.provinceName}>{group.province}</Text>
              <View style={ipStyles.cityChipsRow}>
                {group.cities.map((city, cIdx) => (
                  <TouchableOpacity
                    key={cIdx}
                    style={[ipStyles.cityChip, !isLatest && { opacity: 0.5 }]}
                    onPress={() => isLatest && handleCityChipPress(city.value, city.label)}
                    activeOpacity={isLatest ? 0.7 : 1}
                    disabled={!isLatest}
                  >
                    <Text style={ipStyles.cityChipText}>{city.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {(result.type === 'price_result' || result.type === 'price_result_fallback') && result.data && (
        <View style={ipStyles.priceTableCard}>
          <View style={ipStyles.priceHeader}>
            <Text style={ipStyles.priceHeaderCity}>{result.city}</Text>
            <Text style={ipStyles.priceHeaderDot}>·</Text>
            <Text style={ipStyles.priceHeaderPeriod}>{result.actual_period}</Text>
            <Text style={ipStyles.priceHeaderDot}>·</Text>
            <Text style={ipStyles.priceHeaderMaterial}>{result.material}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginHorizontal: -4 }} contentContainerStyle={{ minWidth: '100%' }}>
            <View style={{ minWidth: '100%' }}>
              <View style={ipStyles.tableHeaderRow}>
                <Text style={[ipStyles.tableHeaderCell, { flex: 2, minWidth: 60 }]}>材料名称</Text>
                <Text style={[ipStyles.tableHeaderCell, { flex: 3, minWidth: 70 }]}>规格型号</Text>
                <Text style={[ipStyles.tableHeaderCell, { width: 36, textAlign: 'center' }]}>单位</Text>
                <Text style={[ipStyles.tableHeaderCell, { flex: 1.2, minWidth: 58, textAlign: 'right' }]}>含税价</Text>
                <Text style={[ipStyles.tableHeaderCell, { flex: 1.2, minWidth: 58, textAlign: 'right' }]}>除税价</Text>
              </View>
              {(isLatest && priceExpanded ? result.data : result.data.slice(0, 5)).map((item, idx) => (
                <View key={item.id || idx} style={[ipStyles.tableRow, idx % 2 === 0 && ipStyles.tableRowEven]}>
                  <Text style={[ipStyles.tableCell, { flex: 2, minWidth: 60 }]} numberOfLines={2}>{item.material_name || '-'}</Text>
                  <Text style={[ipStyles.tableCell, { flex: 3, minWidth: 70 }]} numberOfLines={2}>{item.spec_model}</Text>
                  <Text style={[ipStyles.tableCell, { width: 36, textAlign: 'center' }]}>{item.unit}</Text>
                  <Text style={[ipStyles.tableCellPrice, { flex: 1.2, minWidth: 58, textAlign: 'right' }]}>
                    {item.tax_included_price != null ? Number(item.tax_included_price).toFixed(2) : '-'}
                  </Text>
                  <Text style={[ipStyles.tableCellPrice, { flex: 1.2, minWidth: 58, textAlign: 'right', color: DayColors.textSecondary }]}>
                    {item.tax_excluded_price != null ? Number(item.tax_excluded_price).toFixed(2) : '-'}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
          {isLatest && (result.total_count || 0) > 5 && (
            <TouchableOpacity style={ipStyles.expandButton} onPress={() => setPriceExpanded(!priceExpanded)} activeOpacity={0.7}>
              <Text style={ipStyles.expandButtonText}>
                {priceExpanded ? '收起' : `展开全部 ${result.total_count} 条`}
              </Text>
            </TouchableOpacity>
          )}
          <Text style={ipStyles.priceFooter}>共 {result.total_count} 种规格</Text>
        </View>
      )}
    </>
  );

  const renderInfoPriceView = () => {
    if (infoPriceLoading && chatHistory.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <Loading size="large" color={DayColors.accent} />
          <Text style={styles.loadingText}>AI 正在分析您的需求...</Text>
        </View>
      );
    }

    if (!infoPriceResult && chatHistory.length === 0) return null;

    return (
      <ScrollView ref={scrollViewRef} style={styles.scrollView} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.screenPadding, paddingTop: 12, paddingBottom: 40, justifyContent: 'flex-start' }}>

        {chatHistory.map((msg, idx) => (
          <View key={idx}>
            {msg.role === 'user' && (
              <View style={ipStyles.userMessageRow}>
                <View style={ipStyles.userBubble}>
                  <Text style={ipStyles.userBubbleText}>{msg.text}</Text>
                </View>
              </View>
            )}
            {msg.role === 'ai' && msg.result && renderAIResultCard(msg.result, false)}
          </View>
        ))}

        {infoPriceResult && renderAIResultCard(infoPriceResult, true)}

        {infoPriceLoading && (
          <View style={ipStyles.aiMessageCard}>
            <Image source={require('@/assets/images/icon-64.png')} style={ipStyles.aiIcon} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Loading size="small" color={DayColors.textSecondary} />
              <Text style={[ipStyles.aiMessageText, { marginLeft: 8 }]}>正在思考...</Text>
            </View>
          </View>
        )}

        {infoPriceResult?.type === 'text_reply' && (
          <View style={ipStyles.textReplyHint}>
            <Text style={ipStyles.textReplyHintText}>💡 您可以尝试输入更具体的查询，如"杭州的管桩价格"</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  const handleDocumentPress = (doc: SearchDocument) => {
    console.log('Document pressed:', doc.type, doc.id);
    
    if (doc.type === 'norm') {
      navigation.navigate('NormReader', { normId: doc.id });
    } else if (doc.type === 'atlas') {
      navigation.navigate('AtlasViewer', { atlasId: doc.id });
    } else if (doc.type === 'material') {
      // 信息价暂时不跳转
      console.log('Material price item, no navigation');
    }
  };

  const handleKeywordPress = useCallback((keyword: string) => {
    navigation.replace('ResourceSearchResult', { query: keyword, category });
  }, [navigation, category]);

  const handleUploadPress = (uploadType: 'norm' | 'atlas' | 'material') => {
    setShowUploadModal(false);
    console.log('Upload type:', uploadType);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'norm':
        return <BookOpen color="#4CAF50" size={18} />;
      case 'atlas':
        return <FileText color="#2196F3" size={18} />;
      case 'material':
        return <DollarSign color="#FF9800" size={18} />;
      default:
        return <FileText color="#888" size={18} />;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'norm':
        return '规范';
      case 'atlas':
        return '图集';
      case 'material':
        return '信息价';
      default:
        return '文档';
    }
  };

  const getNormType = (code: string) => {
    if (!code) return '';
    return code.startsWith('GB') ? '国家标准' : '行业标准';
  };

  const renderDocumentItem = ({ item }: { item: SearchDocument }) => (
    <TouchableOpacity
      style={styles.documentItem}
      onPress={() => handleDocumentPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.documentIcon}>
        {getTypeIcon(item.type)}
      </View>
      <View style={styles.documentContent}>
        <Text style={styles.documentTitle} numberOfLines={2}>{item.title || '未命名文档'}</Text>

        {item.type === 'norm' && (
          <View style={styles.documentMeta}>
            <Text style={styles.documentType}>{getTypeName(item.type)}</Text>
            {item.code && (
              <View style={styles.tagContainer}>
                <View style={[styles.tag, styles.greenTag, styles.tagLeft]}>
                  <Text style={styles.tagText}>{getNormType(item.code)}</Text>
                </View>
                <View style={[styles.tag, styles.darkGrayTag, styles.tagRight]}>
                  <Text style={styles.tagText}>{item.code}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {item.type === 'atlas' && (
          <View style={styles.documentMeta}>
            <Text style={styles.documentType}>{getTypeName(item.type)}</Text>
            {(item.area || item.province) && (
              <View style={styles.tagContainer}>
                <View style={[styles.tag, styles.orangeTag, styles.tagLeft]}>
                  <Text style={styles.tagText}>{item.area || item.province || ''}</Text>
                </View>
                {item.code && (
                  <View style={[styles.tag, styles.darkGrayTag, styles.tagRight]}>
                    <Text style={styles.tagText}>{item.code}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {item.type === 'material' && (
          <View style={styles.materialMeta}>
            <View style={styles.materialMetaRow}>
              <View style={styles.typeAndTagsContainer}>
                <Text style={styles.documentType}>{getTypeName(item.type)}</Text>
                {(item.city_code || item.city) && (
                  <View style={styles.tagContainer}>
                    <View style={[styles.tag, styles.redTag, styles.tagLeft]}>
                      <Text style={styles.tagText}>{getCityName(item.city_code || '') || item.city || ''}</Text>
                    </View>
                    {(item.year && item.month) && (
                      <View style={[styles.tag, styles.darkGrayTag, styles.tagRight]}>
                        <Text style={styles.tagText}>{item.year}-{item.month}月</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
              {item.tax_included_price && (
                <View style={styles.inlinePrice}>
                  <Text style={styles.inlinePriceLabel}>含税价</Text>
                  <Text style={styles.inlinePriceValue}>{item.tax_included_price}</Text>
                </View>
              )}
            </View>

            {item.specification && (
              <View style={styles.specificationRow}>
                <Text style={styles.specificationText}>{item.specification}</Text>
                {item.tax_excluded_price && (
                  <View style={styles.inlinePrice}>
                    <Text style={styles.inlinePriceLabel}>除税价</Text>
                    <Text style={styles.inlinePriceValue}>{item.tax_excluded_price}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>
      {item.type !== 'material' && <ChevronRight color={DayColors.textTertiary} size={20} />}
    </TouchableOpacity>
  );

  const renderStandardView = () => (
    <FlatList
      data={sortedResultList}
      renderItem={renderDocumentItem}
      keyExtractor={(item) => `${item.type}_${item.id}`}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>未搜索到结果</Text>
        </View>
      }
    />
  );

  const renderSplitView = () => (
    <ScrollView
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={true}
    >
      <View style={[styles.upperHalf, { height: upperHalfHeight }]}>
        {searchResult?.has_results ? (
          <FlatList
            data={sortedResultList}
            renderItem={renderDocumentItem}
            keyExtractor={(item) => `${item.type}_${item.id}`}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={true}
            scrollEnabled={false}
            nestedScrollEnabled={true}
          />
        ) : (
          <View style={styles.noResultContainer}>
            <Text style={styles.noResultText}>未搜索到结果</Text>
            <Text style={styles.noResultSubtext}>AI正在为您分析相关内容</Text>
          </View>
        )}
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>AI 辅助</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.lowerHalf}>
        {aiLoading ? (
          <View style={styles.aiLoadingContainer}>
            <Loading size="small" color={DayColors.accent} />
            <Text style={styles.aiLoadingText}>AI正在分析中...</Text>
          </View>
        ) : aiResult ? (
          <>
            <View style={styles.aiAnswerSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Image source={require('@/assets/images/icon-64.png')} style={{ width: 20, height: 20, marginRight: 6, borderRadius: 4 }} />
                <Text style={styles.aiAnswerTitle}>AI 回答</Text>
              </View>
              <Text style={styles.aiAnswerText}>{aiResult.answer}</Text>

              {aiResult.keywords.length > 0 && (
                <View style={styles.keywordsContainer}>
                  <Text style={styles.keywordsTitle}>相关关键词：</Text>
                  <View style={styles.keywordsList}>
                    {aiResult.keywords.map((keyword, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.keywordChip}
                        onPress={() => handleKeywordPress(keyword)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.keywordText}>{keyword}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {aiRecommendedDocs.length > 0 && (
              <View style={styles.aiRecommendSection}>
                <Text style={styles.aiRecommendTitle}>📄 推荐文档</Text>
                {aiRecommendedDocs.map((doc, index) => (
                  <TouchableOpacity
                    key={`ai_${doc.type}_${doc.id}_${index}`}
                    style={styles.documentItem}
                    onPress={() => handleDocumentPress(doc)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.documentIcon}>
                      {getTypeIcon(doc.type)}
                    </View>
                    <View style={styles.documentContent}>
                      <Text style={styles.documentTitle} numberOfLines={2}>{doc.title || '未命名文档'}</Text>
                      <View style={styles.documentMeta}>
                        <Text style={styles.documentType}>{getTypeName(doc.type)}</Text>
                        {doc.code && <Text style={styles.documentCode}>{doc.code}</Text>}
                      </View>
                    </View>
                    {doc.type !== 'material' && <ChevronRight color={DayColors.textTertiary} size={20} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        ) : aiError ? (
          <View style={styles.aiErrorContainer}>
            <Text style={styles.aiErrorText}>{aiError}</Text>
            <TouchableOpacity style={styles.aiRetryButton} onPress={fetchAIAssist}>
              <Text style={styles.aiRetryText}>重新尝试</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.aiErrorContainer}>
            <Text style={styles.aiErrorText}>AI正在为您分析相关内容</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12, minHeight: headerHeight }]}>
        {/* 返回按钮 */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={DayColors.text} />
        </TouchableOpacity>

        {/* 标题居中 */}
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>搜索</Text>
        </View>

        {/* 右侧标签 - 绝对定位 */}
        {!isInfoPriceMode && !loading && searchResult && !searchResult.has_results ? (
          <TouchableOpacity
            style={styles.headerRightAction}
            onPress={() => setShowUploadModal(true)}
          >
            <Upload color={DayColors.text} size={20} />
          </TouchableOpacity>
        ) : (
          selectedDocType && (
            <View style={styles.headerRightTag}>
              <View style={styles.headerCategoryTag}>
                <Text style={styles.headerCategoryText}>{getTypeName(selectedDocType)}</Text>
              </View>
            </View>
          )
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Loading size="large" color={DayColors.accent} />
          <Text style={styles.loadingText}>正在搜索...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={performSearch}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: '#FF9800', marginTop: 10 }]}
            onPress={async () => {
              overlay.alert({ title: '提示', message: '请在设置中检查网络连接' });
            }}
          >
            <Text style={styles.retryText}>网络测试</Text>
          </TouchableOpacity>
        </View>
      ) : isInfoPriceMode ? (
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: DayColors.background }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {renderInfoPriceView()}
          {!infoPriceLoading && infoPriceResult && (
            <View style={{ paddingBottom: insets.bottom + 15 }}>
              <MapSearchBar
                value={followUpQuery}
                onChangeText={setFollowUpQuery}
                onSubmit={handleFollowUp}
                placeholder='你可以继续追问...'
                absolute={false}
                enableVoice={true}
                avoidKeyboard={false}
              />
              <Text style={[ipStyles.aiDisclaimer, { position: 'absolute', bottom: insets.bottom, left: 0, right: 0 }]}>内容由AI生成，注意甄别</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      ) : searchResult?.need_ai_assist ? (
        renderSplitView()
      ) : (
        <>
          {searchResult && sortedResultList.length > 0 && (
            <View style={styles.resultSummaryRow}>
              <Text style={styles.resultSummaryKeyword}>{query}</Text>
              <Text style={styles.resultSummaryCount}>{'  共找到 ' + sortedResultList.length + ' 条结果'}</Text>
            </View>
          )}
          {renderStandardView()}
        </>
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
    backgroundColor: DayColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: DayColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: DayColors.border,
  },
  backButton: {
    width: 44,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    position: 'absolute',
    left: 16,
    bottom: 12,
    zIndex: 10,
  },
  headerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    color: DayColors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerQuery: {
    fontSize: 15,
    color: DayColors.text,
    textAlign: 'center',
    fontWeight: '600',
  },
  resultSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  resultSummaryKeyword: {
    fontSize: 13,
    color: DayColors.text,
    fontWeight: '700',
  },
  resultSummaryCount: {
    fontSize: 13,
    color: DayColors.textSecondary,
  },
  headerRightAction: {
    position: 'absolute',
    right: 16,
    bottom: 12,
    width: 44,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: 10,
  },
  headerRightTag: {
    position: 'absolute',
    right: 16,
    bottom: 18,
    zIndex: 10,
  },
  headerCategoryTag: {
    backgroundColor: DayColors.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DayColors.accent,
  },
  headerCategoryText: {
    fontSize: 12,
    color: DayColors.accent,
    fontWeight: '600',
    includeFontPadding: false,
  },
  shareButton: {
    backgroundColor: DayColors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: DayColors.border,
  },
  shareButtonText: {
    fontSize: 14,
    color: DayColors.text,
    fontWeight: '600',
    marginLeft: 6,
  },
  scrollView: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.screenPadding,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: DayColors.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: DayColors.surfaceSecondary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: DayColors.border,
  },
  retryText: {
    color: DayColors.text,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: DayColors.textSecondary,
    fontSize: 16,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: DayColors.surface,
    borderWidth: 1,
    borderColor: DayColors.border,
    shadowColor: DayColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  documentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DayColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  documentContent: {
    flex: 1,
  },
  documentTitle: {
    color: DayColors.text,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  documentType: {
    fontSize: 12,
    color: DayColors.textTertiary,
    marginRight: 8,
  },
  documentCode: {
    fontSize: 12,
    color: DayColors.textSecondary,
  },
  documentPrice: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '600',
  },
  tagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tag: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
  },
  tagLeft: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  tagRight: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  greenTag: {
    backgroundColor: '#E8F5E9',
  },
  orangeTag: {
    backgroundColor: '#FFF3E0',
  },
  redTag: {
    backgroundColor: '#FFEBEE',
  },
  darkGrayTag: {
    backgroundColor: DayColors.surfaceSecondary,
  },
  tagText: {
    fontSize: 8,
    color: DayColors.text,
  },
  materialMeta: {},
  materialMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeAndTagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  specificationText: {
    fontSize: 12,
    color: DayColors.textSecondary,
    marginTop: 2,
  },
  specificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  inlinePrice: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  inlinePriceLabel: {
    fontSize: 10,
    color: DayColors.textTertiary,
    marginRight: 2,
  },
  inlinePriceValue: {
    fontSize: 12,
    color: DayColors.text,
    fontWeight: 'bold',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  priceItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceLabel: {
    fontSize: 12,
    color: DayColors.textTertiary,
    marginRight: 2,
  },
  priceValue: {
    fontSize: 14,
    color: DayColors.text,
    fontWeight: 'bold',
  },
  priceSpacer: {
    width: 20,
  },
  upperHalf: {
    borderBottomWidth: 0,
  },
  noResultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noResultText: {
    color: DayColors.textSecondary,
    fontSize: 16,
  },
  noResultSubtext: {
    color: DayColors.textTertiary,
    fontSize: 12,
    marginTop: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: DayColors.border,
  },
  dividerText: {
    color: DayColors.textSecondary,
    fontSize: 12,
    marginHorizontal: 12,
  },
  lowerHalf: {
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: 20,
  },
  aiLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  aiLoadingText: {
    color: DayColors.textSecondary,
    fontSize: 14,
    marginLeft: 12,
  },
  aiAnswerSection: {
    backgroundColor: DayColors.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: DayColors.border,
  },
  aiAnswerTitle: {
    color: DayColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  aiAnswerText: {
    color: DayColors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  keywordsContainer: {
    marginTop: 16,
  },
  keywordsTitle: {
    color: DayColors.textSecondary,
    fontSize: 12,
    marginBottom: 8,
  },
  keywordsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  keywordChip: {
    backgroundColor: DayColors.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  keywordText: {
    color: DayColors.accent,
    fontSize: 12,
  },
  aiRecommendSection: {
    marginBottom: 16,
  },
  aiRecommendTitle: {
    color: DayColors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  aiErrorContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  aiErrorText: {
    color: DayColors.textTertiary,
    fontSize: 14,
    marginBottom: 16,
  },
  aiRetryButton: {
    backgroundColor: DayColors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  aiRetryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

const ipStyles = StyleSheet.create({
  aiMessageCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: DayColors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: DayColors.border,
    shadowColor: DayColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 1,
  },
  aiIcon: {
    width: 22,
    height: 22,
    borderRadius: 4,
    marginRight: 10,
    marginTop: 1,
  },
  aiMessageText: {
    flex: 1,
    color: DayColors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DayColors.accentLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: DayColors.accent,
  },
  chipText: {
    color: DayColors.accent,
    fontSize: 13,
    fontWeight: '500',
  },
  chipCount: {
    color: DayColors.textTertiary,
    fontSize: 11,
    marginLeft: 6,
  },
  cityContainer: {
    marginBottom: 16,
  },
  provinceGroup: {
    marginBottom: 14,
  },
  provinceName: {
    color: DayColors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 1,
  },
  cityChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cityChip: {
    backgroundColor: DayColors.surfaceSecondary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: DayColors.border,
  },
  cityChipText: {
    color: DayColors.text,
    fontSize: 13,
  },
  priceTableCard: {
    backgroundColor: DayColors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: DayColors.border,
    shadowColor: DayColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 1,
  },
  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceHeaderCity: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: '700',
  },
  priceHeaderDot: {
    color: DayColors.textTertiary,
    fontSize: 14,
    marginHorizontal: 6,
  },
  priceHeaderPeriod: {
    color: DayColors.textSecondary,
    fontSize: 13,
  },
  priceHeaderMaterial: {
    color: DayColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: DayColors.border,
  },
  tableHeaderCell: {
    color: DayColors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: DayColors.borderLight,
  },
  tableRowEven: {
    backgroundColor: DayColors.surfaceSecondary,
  },
  tableCell: {
    color: DayColors.textSecondary,
    fontSize: 12,
  },
  tableCellPrice: {
    color: DayColors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  expandButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  expandButtonText: {
    color: '#FF9800',
    fontSize: 13,
    fontWeight: '500',
  },
  priceFooter: {
    color: DayColors.textTertiary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
  },
  textReplyHint: {
    backgroundColor: DayColors.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  textReplyHintText: {
    color: DayColors.textTertiary,
    fontSize: 12,
    lineHeight: 18,
  },
  aiDisclaimer: {
    color: '#999999',
    fontSize: 8,
    textAlign: 'center',
    paddingVertical: 0,
    paddingBottom: 0,
  },
  userMessageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  userBubble: {
    backgroundColor: DayColors.accentLight,
    borderRadius: 16,
    borderTopRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '75%',
    borderWidth: 1,
    borderColor: DayColors.accent,
  },
  userBubbleText: {
    color: DayColors.accent,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default ResourceSearchResultScreen;
