import React, { FC, useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  ActivityIndicator,
  StatusBar,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, BookOpen, X } from 'lucide-react-native';
import RenderHTML from 'react-native-render-html';
import { DayColors } from '@/constants';
import api from '@/services/api';
import { addBrowsingHistory } from '@/utils/browsingHistory';
import { getQuotaStatus, consumeQuota } from '@/utils/viewingQuota';
import { useOverlay } from '@/components/overlay';
import { useNavigation, useRoute } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const convertHtmlToText = (html: string) => {
  if (!html) return '';
  let text = html;
  text = text.replace(/<sup>([^<]*)<\/sup>/g, (_match: string, content: string) => {
    const superscriptMap: Record<string, string> = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
      '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
      '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    };
    return content.split('').map((char: string) => superscriptMap[char] || char).join('');
  });
  text = text.replace(/<sub>([^<]*)<\/sub>/g, (_match: string, content: string) => {
    const subscriptMap: Record<string, string> = {
      '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
      '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
      '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    };
    return content.split('').map((char: string) => subscriptMap[char] || char).join('');
  });
  const tagsToRemove = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span', 'br', 'strong', 'b', 'em'];
  tagsToRemove.forEach(tag => {
    const regex = new RegExp(`<${tag}[^>]*>|</${tag}>`, 'gi');
    text = text.replace(regex, '');
  });
  text = text.replace(/<(?!\/?i|img)[^>]+>/gi, '');
  return text;
};

interface ChapterMeta {
  chapter_id: string;
  chapter_name: string;
  sub_chapters?: string[];
}

interface ChapterContent {
  id: string;
  title: string;
  content: string;
}

interface NormData {
  id: number;
  name: string;
  code?: string;
  pid: string;
  chapters?: ChapterMeta[];
}

const NormReaderScreen: FC = () => {
  const route = useRoute<any>();
  const normId = route.params?.normId;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const overlay = useOverlay();
  const statusBarHeight = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 24;

  const [currentChapter, setCurrentChapter] = useState(0);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [chapterMetas, setChapterMetas] = useState<ChapterMeta[]>([]);
  const [currentContent, setCurrentContent] = useState<ChapterContent | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [normData, setNormData] = useState<NormData | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const hasConsumedQuota = useRef(false);
  const historyAdded = useRef(false);
  const contentCache = useRef<Map<number, ChapterContent>>(new Map());

  const formatChapterContent = useCallback((content: any) => {
    if (!content) return '';
    try {
      let data;
      if (typeof content === 'string') {
        try { data = JSON.parse(content); } catch { return content; }
      } else {
        data = content;
      }

      if (data.data_json) {
        if (typeof data.data_json === 'string') {
          const trimmed = data.data_json.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try { data = JSON.parse(trimmed); } catch { 
              // 解析失败，作为 HTML 字符串处理
              data = { content: data.data_json };
            }
          } else {
            // 普通字符串，作为 HTML 内容处理
            data = { content: data.data_json };
          }
        } else if (typeof data.data_json === 'object') {
          data = data.data_json;
        }
      }

      let htmlContent = '';
      if (data.title) htmlContent += data.title;
      if (data.content) htmlContent += data.content;

      if (data.twoChapter && Array.isArray(data.twoChapter)) {
        data.twoChapter.forEach((twoChapter: any) => {
          if (twoChapter.title) htmlContent += twoChapter.title;
          if (twoChapter.content) htmlContent += twoChapter.content;
          if (twoChapter.threeChapter && Array.isArray(twoChapter.threeChapter)) {
            twoChapter.threeChapter.forEach((item: any) => {
              if (item.title) htmlContent += item.title;
              if (item.content) htmlContent += item.content;
            });
          }
        });
      }

      if (!data.twoChapter && data.threeChapter && Array.isArray(data.threeChapter)) {
        data.threeChapter.forEach((item: any) => {
          if (item.title) htmlContent += item.title;
          if (item.content) htmlContent += item.content;
        });
      }

      if (!htmlContent || htmlContent.trim() === '') {
        if (data.chapter_name || data.data_json) {
          return `<p>${typeof data.data_json === 'string' ? data.data_json : ''}</p>`;
        }
        return '暂无内容';
      }

      const hasMeaningfulTags = /<(h[1-6]|p|div|span|strong|b|em|i|img)[^>]*>/i.test(htmlContent);
      if (!hasMeaningfulTags) return convertHtmlToText(htmlContent);

      htmlContent = htmlContent.replace(/\s*xmlns=""\s*/g, ' ');

      return htmlContent || '';
    } catch (error) {
      console.error('格式化章节内容失败:', error);
      if (content?.data_json && typeof content.data_json === 'string') {
        return `<p>${content.data_json}</p>`;
      }
      return '内容解析失败';
    }
  }, []);

  const fetchNormDetails = async () => {
    try {
      const data = await api.get<any, any>(`/api/resource/norms/${normId}`);
      if (data) {
        setNormData(data);
        if (data.pid) await fetchChapterList(data.pid, data);
      }
    } catch (error) {
      console.error('获取规范详情失败:', error);
    }
  };

  const fetchChapterList = async (pid: string, norm: any) => {
    try {
      const data = await api.get<any, any>(`/api/resource/norms/${pid}/chapters`);
      if (data?.list && data.list.length > 0) {
        const metas: ChapterMeta[] = data.list.map((ch: any) => ({
          chapter_id: ch.chapter_id,
          chapter_name: ch.chapter_name || `第${ch.chapter_id}章`,
          sub_chapters: ch.sub_chapters || [ch.chapter_id],
        }));
        setChapterMetas(metas);
        setNormData(prev => prev ? { ...prev, chapters: metas } : null);

        if (!historyAdded.current) {
          historyAdded.current = true;
          addBrowsingHistory({ id: norm.id, type: 'norm', title: norm.name, code: norm.code });
        }
      }
    } catch (error) {
      console.error('获取章节列表失败:', error);
    }
  };

  const loadChapterContent = useCallback(async (chapterIndex: number, metas: ChapterMeta[], pid: string) => {
    const cached = contentCache.current.get(chapterIndex);
    console.log('[loadChapterContent] chapterIndex:', chapterIndex, 'cached:', !!cached);
    if (cached) { 
      console.log('[loadChapterContent] using cached content');
      setCurrentContent(cached); 
      return; 
    }

    const chapter = metas[chapterIndex];
    if (!chapter) return;

    setChapterLoading(true);
    try {
      const subChapterIds = chapter.sub_chapters || [chapter.chapter_id];
      const data = await api.get<any, any>(
        `/api/resource/norms/${pid}/chapters/batch/content?ids=${subChapterIds.join(',')}`
      );

      let combinedContent = '';
      if (data?.list && Array.isArray(data.list)) {
        for (const item of data.list) {
          const formatted = formatChapterContent(item);
          if (formatted && formatted !== '暂无内容' && formatted !== '内容解析失败') {
            combinedContent += formatted;
          }
        }
      }

      let chapterTitle = chapter.chapter_name;
      if (!chapterTitle) {
        if (chapter.chapter_id === 'notice') chapterTitle = '通知';
        else if (chapter.chapter_id === 'preface') chapterTitle = '前言';
        else chapterTitle = `第${chapter.chapter_id}章`;
      }
      chapterTitle = chapterTitle.replace(/<[^>]+>/g, '').trim();

      const result: ChapterContent = {
        id: chapter.chapter_id,
        title: chapterTitle,
        content: combinedContent || '暂无内容',
      };

      contentCache.current.set(chapterIndex, result);
      setCurrentContent(result);
    } catch (error) {
      console.error(`章节 ${chapter.chapter_id} 加载失败:`, error);
      setCurrentContent({ id: chapter.chapter_id, title: chapter.chapter_name || `第${chapter.chapter_id}章`, content: '暂无内容' });
    } finally {
      setChapterLoading(false);
    }
  }, [formatChapterContent]);

  useEffect(() => {
    const init = async () => {
      const quota = getQuotaStatus();
      if (!quota.canView) {
        overlay.alert({
          title: '查看次数已用完',
          message: '今日免费查看次数已用完，上传资源可获得更多查看机会',
          buttons: [{ text: '返回', onPress: () => navigation.goBack() }],
        });
        return;
      }
      if (!hasConsumedQuota.current) {
        hasConsumedQuota.current = true;
        consumeQuota();
      }
      await fetchNormDetails();
      setInitialLoading(false);
    };
    init();
  }, [normId]);

  useEffect(() => {
    if (chapterMetas.length > 0 && normData?.pid) {
      loadChapterContent(0, chapterMetas, normData.pid);
    }
  }, [chapterMetas, normData?.pid]);

  const goToChapter = (chapterIndex: number) => {
    if (chapterIndex >= 0 && chapterIndex < chapterMetas.length) {
      setCurrentChapter(chapterIndex);
      if (normData?.pid) loadChapterContent(chapterIndex, chapterMetas, normData.pid);
      scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: true });
    }
  };



  const tagStyles = {
    h1: { fontSize: 18, fontWeight: 'bold', color: DayColors.text, marginBottom: 10 },
    h2: { fontSize: 16, fontWeight: 'bold', color: DayColors.text, marginBottom: 8 },
    h3: { fontSize: 15, fontWeight: 'bold', color: DayColors.text, marginBottom: 6 },
    h4: { fontSize: 14, fontWeight: 'bold', color: DayColors.text, marginBottom: 4 },
    h5: { fontSize: 13, fontWeight: 'bold', color: DayColors.text, marginBottom: 4 },
    h6: { fontSize: 12, fontWeight: 'bold', color: DayColors.text, marginBottom: 4 },
    p: { fontSize: 14, color: DayColors.text, lineHeight: 24, marginBottom: 8 },
    div: { fontSize: 14, color: DayColors.text, lineHeight: 24, marginBottom: 8 },
    span: { fontSize: 14, color: DayColors.text },
    sup: { fontSize: 10, color: DayColors.text },
    sub: { fontSize: 10, color: DayColors.text },
    i: { fontStyle: 'italic', color: DayColors.text },
    em: { fontStyle: 'italic', color: DayColors.text },
    strong: { fontWeight: 'bold', color: DayColors.text },
    b: { fontWeight: 'bold', color: DayColors.text },
    br: { height: 8 },
    img: { maxWidth: width - 40, height: 'auto', marginVertical: 8, alignSelf: 'center' },
    ul: { marginBottom: 8, paddingLeft: 20 },
    ol: { marginBottom: 8, paddingLeft: 20 },
    li: { fontSize: 14, color: DayColors.text, marginBottom: 4, lineHeight: 20 },
    table: { marginBottom: 8, borderWidth: 1, borderColor: DayColors.border },
    tr: { borderBottomWidth: 1, borderBottomColor: DayColors.border },
    td: { fontSize: 12, color: DayColors.text, padding: 4, borderWidth: 1, borderColor: DayColors.border },
    th: { fontSize: 12, color: DayColors.text, fontWeight: 'bold', padding: 4, borderWidth: 1, borderColor: DayColors.border },
  };

  return (
    <View style={styles.container}>
      <View style={{ height: statusBarHeight }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={DayColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
          {normData?.name || `规范详情 #${normId}`}
        </Text>
        <TouchableOpacity style={styles.menuButton} onPress={() => setSidebarVisible(!sidebarVisible)}>
          <BookOpen size={20} color={DayColors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        {initialLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={DayColors.primary || '#3b82f6'} />
            <Text style={styles.loadingText}>正在加载规范...</Text>
          </View>
        ) : chapterMetas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无章节内容</Text>
          </View>
        ) : chapterLoading || !currentContent ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={DayColors.primary || '#3b82f6'} />
            <Text style={styles.loadingText}>正在加载章节内容...</Text>
          </View>
        ) : (
          <ScrollView ref={scrollViewRef} style={styles.contentScroll}>
            <View style={styles.chapterContentView}>
              {currentContent.content ? (
                <>
                  <RenderHTML
                    contentWidth={width - 40}
                    source={{ html: currentContent.content }}
                    tagsStyles={tagStyles}
                    renderersProps={{
                      img: {
                        enableExperimentalPercentWidth: true,
                        initialDimensions: { width: width - 40, height: 200 },
                      },
                    }}
                    defaultTextProps={{ style: { color: DayColors.text, fontSize: 14, lineHeight: 24 } }}
                    ignoredStyles={['verticalAlign', 'xmlns']}
                  />
                </>
              ) : (
                <Text style={styles.emptyText}>暂无内容</Text>
              )}
            </View>
            <View style={{ height: 80 }} />
          </ScrollView>
        )}
      </View>

      {chapterMetas.length > 0 && (
        <View style={styles.chapterIndicator}>
          <TouchableOpacity
            style={styles.chapterNavButton}
            onPress={() => goToChapter(currentChapter - 1)}
            disabled={currentChapter === 0}
          >
            <Text style={[styles.chapterNavButtonText, currentChapter === 0 && styles.chapterNavButtonDisabled]}>◀</Text>
          </TouchableOpacity>
          <Text style={styles.chapterIndicatorText}>{currentChapter + 1} / {chapterMetas.length}</Text>
          <TouchableOpacity
            style={styles.chapterNavButton}
            onPress={() => goToChapter(currentChapter + 1)}
            disabled={currentChapter === chapterMetas.length - 1}
          >
            <Text style={[styles.chapterNavButtonText, currentChapter === chapterMetas.length - 1 && styles.chapterNavButtonDisabled]}>▶</Text>
          </TouchableOpacity>
        </View>
      )}

      {sidebarVisible && (
        <TouchableOpacity style={styles.sidebarOverlay} onPress={() => setSidebarVisible(false)} />
      )}

      <Animated.View
        style={[
          styles.sidebar,
          { transform: [{ translateX: sidebarVisible ? new Animated.Value(0) : new Animated.Value(width * 0.7) }] },
        ]}
      >
        <View style={[styles.sidebarHeader, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.sidebarTitle}>规范目录</Text>
          <TouchableOpacity onPress={() => setSidebarVisible(false)}>
            <X size={20} color={DayColors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.sidebarContent}>
          {chapterMetas.length === 0 ? (
            <Text style={{ color: DayColors.textTertiary, padding: 20 }}>暂无章节</Text>
          ) : (
            chapterMetas.map((chapter, index) => (
              <TouchableOpacity
                key={chapter.chapter_id}
                style={[styles.chapterItem, index === currentChapter && styles.chapterItemActive]}
                onPress={() => { goToChapter(index); setSidebarVisible(false); }}
              >
                <Text style={[styles.chapterItemText, index === currentChapter && styles.chapterItemTextActive]}>
                  {chapter.chapter_name}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DayColors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DayColors.border,
  },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: DayColors.surfaceSecondary, justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    flex: 1, color: DayColors.text, fontSize: 16, fontWeight: '600', textAlign: 'center', marginHorizontal: 10,
  },
  menuButton: { padding: 8 },
  contentContainer: { flex: 1, backgroundColor: DayColors.background },
  contentScroll: { flex: 1, paddingHorizontal: 20, paddingVertical: 20 },
  chapterContentView: { minHeight: 100 },
  chapterIndicator: {
    position: 'absolute', bottom: 30, right: 20,
    backgroundColor: DayColors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15,
    flexDirection: 'row', alignItems: 'center', gap: 15,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  chapterIndicatorText: { color: DayColors.text, fontSize: 12 },
  chapterNavButton: { padding: 5 },
  chapterNavButtonText: { color: DayColors.text, fontSize: 16 },
  chapterNavButtonDisabled: { opacity: 0.3 },
  sidebarOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sidebar: {
    position: 'absolute', top: 0, right: 0, width: width * 0.7, height: '100%',
    backgroundColor: DayColors.surface, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: DayColors.border,
  },
  sidebarHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DayColors.border,
  },
  sidebarTitle: { color: DayColors.text, fontSize: 16, fontWeight: '600' },
  sidebarContent: { flex: 1 },
  chapterItem: {
    paddingHorizontal: 20, paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DayColors.border,
  },
  chapterItemActive: { backgroundColor: DayColors.surfaceSecondary },
  chapterItemText: { color: DayColors.textSecondary, fontSize: 14 },
  chapterItemTextActive: { color: DayColors.text, fontWeight: '600' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: DayColors.textTertiary, fontSize: 14, marginTop: 10 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: DayColors.textTertiary, fontSize: 16 },
});

export default NormReaderScreen;
