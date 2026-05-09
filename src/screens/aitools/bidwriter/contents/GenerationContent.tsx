import { BID_WRITER_REVIEW_CHECKLIST } from '@/constants/bidWriterReviewChecklist';
import { Loading } from '@/components/common/Loading';
/**
 * Step 3: 生成内容区
 * 负责生成进度展示、目录/正文模式切换、审稿结果
 */
import React, { FC, useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Image,
  Platform,
} from 'react-native';
import SimpleMarkdown from '@/components/common/SimpleMarkdown';
import { Buffer } from 'buffer';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react-native';
import RNFS from 'react-native-fs';
import { bidWriterApi } from '@/services/bidWriter';
import { ImagePlaceholderRow, ImageSelectorSidebar } from '../components';
import type { ImageMarker } from '../components';
import type { Chapter } from '@/services/bidWriter';
import { useBidWriterContext } from '../BidWriterContext';
import { useBidWriterWebSocket } from '../useBidWriterWebSocket';
import { useBidWriterStore } from '@/stores/useBidWriterStore';
import { foregroundService } from '@/services/foregroundService';
import { useAgentTaskStore } from '@/stores/useAgentTaskStore';
import type { RootStackScreenProps } from '@/navigation/types';
import { ReviewResultCard, ExportModal } from '@/components/bidwriter';

type Props = {
  navigation: RootStackScreenProps<'BidWriter'>['navigation'];
  viewMode: 'directory' | 'content';
  onToggleViewMode?: () => void;
  onOpenKnowledgeModal?: () => void;
};

interface GenerationProgress {
  phase: 'content' | 'image' | 'review' | 'completed';
  currentChapter: number;
  totalChapters: number;
  currentSection: number;
  totalSections: number;
  message: string;
  percentage: number;
}

// 正文模式的section数据结构
interface ContentSectionData {
  sectionId: string;
  chapterIndex: number;
  subIndex: number;
  sectionIndex: number;
  chapterTitle: string;
  subChapterTitle: string;
  sectionTitle: string;
  isFirstInChapter: boolean;
  isFirstInSubChapter: boolean;
}



const normalizeCircledNumberLines = (content: string): string => {
  if (!content) return '';
  const circled = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
  const re = new RegExp(`([^\n>])\\s*([${circled}])`, 'g');
  return content.replace(re, '$1<br/>$2');
};

// LaTeX 符号到 Unicode 的映射表
const LATEX_SYMBOLS: Record<string, string> = {
  // 希腊字母（小写）
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
  '\\epsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ',
  '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\mu': 'μ',
  '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\rho': 'ρ',
  '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ',
  '\\phi': 'φ', '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
  // 希腊字母（大写）
  '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
  '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Upsilon': 'Υ',
  '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',
  // 运算符
  '\\times': '×', '\\div': '÷', '\\cdot': '·', '\\pm': '±',
  '\\leq': '≤', '\\geq': '≥', '\\neq': '≠', '\\approx': '≈',
  '\\equiv': '≡', '\\sim': '∼', '\\propto': '∝',
  '\\subset': '⊂', '\\supset': '⊃', '\\subseteq': '⊆', '\\supseteq': '⊇',
  '\\in': '∈', '\\notin': '∉', '\\forall': '∀', '\\exists': '∃',
  '\\cup': '∪', '\\cap': '∩', '\\emptyset': '∅',
  // 箭头
  '\\rightarrow': '→', '\\leftarrow': '←', '\\Rightarrow': '⇒',
  '\\Leftarrow': '⇐', '\\leftrightarrow': '↔', '\\Leftrightarrow': '⇔',
  // 其他符号
  '\\infty': '∞', '\\partial': '∂', '\\nabla': '∇',
  '\\sum': '∑', '\\prod': '∏', '\\int': '∫', '\\oint': '∮',
  '\\sqrt': '√', '\\prime': '′', '\\degree': '°',
  '\\angle': '∠', '\\perp': '⊥', '\\parallel': '∥',
  '\\triangle': '△', '\\square': '□', '\\circ': '∘',
  '\\bullet': '•', '\\star': '★',
  '\\langle': '⟨', '\\rangle': '⟩',
};

const convertLatexToUnicode = (text: string): string => {
  let result = text;
  
  result = result.replace(/\$([^$]+)\$/g, (_, formula) => {
    return convertSingleLatex(formula);
  });
  
  result = result.replace(/\$\$([^$]+)\$\$/g, (_, formula) => {
    return convertSingleLatex(formula);
  });

  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, formula) => {
    return convertSingleLatex(formula.trim());
  });

  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, formula) => {
    return convertSingleLatex(formula.trim());
  });

  return result;
};

const convertSingleLatex = (latex: string): string => {
  let result = latex;

  result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');
  result = result.replace(/\^\\?\{([^}]+)\\?\}/g, '^($1)');
  result = result.replace(/\^(\d+)/g, '^$1');
  result = result.replace(/_\\?\{([^}]+)\\?\}/g, '_($1)');
  result = result.replace(/_(\d+)/g, '_$1');
  result = result.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
  result = result.replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, '√[$1]($2)');
  result = result.replace(/\\sum\s*_\{([^}]+)\}\s*\^\{([^}]+)\}/g, '∑_($1)^($2)');
  result = result.replace(/\\sum\s*_\{([^}]+)\}/g, '∑_($1)');
  result = result.replace(/\\sum/g, '∑');
  result = result.replace(/\\int\s*_\{([^}]+)\}\s*\^\{([^}]+)\}/g, '∫_($1)^($2)');
  result = result.replace(/\\int/g, '∫');
  result = result.replace(/\\prod\s*_\{([^}]+)\}\s*\^\{([^}]+)\}/g, '∏_($1)^($2)');
  result = result.replace(/\\prod/g, '∏');

  for (const [latexSym, unicodeSym] of Object.entries(LATEX_SYMBOLS)) {
    result = result.replaceAll(latexSym, unicodeSym);
  }

  result = result.replace(/\\text\{([^}]+)\}/g, '$1');
  result = result.replace(/\\mathrm\{([^}]+)\}/g, '$1');
  result = result.replace(/\\mathbf\{([^}]+)\}/g, '$1');
  result = result.replace(/\\[a-zA-Z]+/g, '');
  result = result.replace(/[{}]/g, '');

  return result.trim();
};

// 将 Markdown 内容预处理（LaTeX转Unicode，编号换行）
const preprocessContent = (content: string): string => {
  if (!content) return '';
  const normalized = normalizeCircledNumberLines(content);
  // 转换 LaTeX 公式为 Unicode
  return convertLatexToUnicode(normalized);
};

// 解析内容，将文本和图片标记交错排列
interface ContentSegment {
  type: 'text' | 'images';
  content?: string;       // 文本内容
  markers?: ImageMarker[]; // 同一行的图片标记（最多3个）
}

const parseContentWithImages = (content: string, imageMarkers: ImageMarker[]): ContentSegment[] => {
  if (!content) return [];
  
  const segments: ContentSegment[] = [];
  const lines = content.split('\n');
  const markersByLine: Map<number, ImageMarker[]> = new Map();
  
  // 按行分组图片标记
  imageMarkers.forEach(marker => {
    // 找到标记所在的行
    let charCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineEnd = charCount + lines[i].length;
      if (marker.position >= charCount && marker.position <= lineEnd) {
        const existing = markersByLine.get(i) || [];
        existing.push(marker);
        markersByLine.set(i, existing);
        break;
      }
      charCount = lineEnd + 1; // +1 for newline
    }
  });
  
  // 构建交错的内容段
  let textBuffer: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineMarkers = markersByLine.get(i);
    
    if (lineMarkers && lineMarkers.length > 0) {
      // 这一行有图片标记
      // 先移除标记，保留文本部分
      const cleanLine = line.replace(/\[IMAGE:[^\]]+\]/g, '').trim();
      if (cleanLine) {
        textBuffer.push(cleanLine);
      }
      
      // 如果有累积的文本，先输出
      if (textBuffer.length > 0) {
        segments.push({ type: 'text', content: textBuffer.join('\n') });
        textBuffer = [];
      }
      
      // 输出图片
      segments.push({ type: 'images', markers: lineMarkers.slice(0, 3) });
    } else {
      // 普通文本行
      textBuffer.push(line);
    }
  }
  
  // 输出剩余的文本
  if (textBuffer.length > 0) {
    segments.push({ type: 'text', content: textBuffer.join('\n') });
  }
  
  return segments;
};

// 正文模式的section项 - 使用memo优化
const ContentSectionItem = memo<{ 
  item: ContentSectionData; 
  content?: string; 
  isCompleted?: boolean;
  contentWidth: number;
  imageMarkers?: ImageMarker[];
  onImagePress?: (marker: ImageMarker) => void;
}>(
  ({ item, content, isCompleted, contentWidth, imageMarkers = [], onImagePress }) => {
    // 解析内容为交错的文本和图片段
    const segments = useMemo(() => {
      if (!content || !isCompleted) return [];
      return parseContentWithImages(content, imageMarkers);
    }, [content, isCompleted, imageMarkers]);

    return (
      <View>
        {item.isFirstInChapter && (
          <Text style={styles.contentChapterTitle}>
            第{item.chapterIndex + 1}章 {item.chapterTitle}
          </Text>
        )}
        {item.isFirstInSubChapter && (
          <Text style={styles.contentSubChapterTitle}>
            {item.chapterIndex + 1}.{item.subIndex + 1} {item.subChapterTitle}
          </Text>
        )}
        <View style={styles.contentSection}>
          <Text style={styles.contentSectionTitle}>
            {item.chapterIndex + 1}.{item.subIndex + 1}.{item.sectionIndex + 1} {item.sectionTitle}
          </Text>
          {!content ? (
            <Text style={styles.contentSectionText}>正在生成中...</Text>
          ) : isCompleted && segments.length > 0 ? (
            <>
              {segments.map((segment, idx) => (
                segment.type === 'text' && segment.content ? (
                  <SimpleMarkdown
                    key={`text-${idx}`}
                    content={preprocessContent(segment.content)}
                    textColor="#fff"
                    fontSize={12}
                  />
                ) : segment.type === 'images' && segment.markers && onImagePress ? (
                  <ImagePlaceholderRow
                    key={`img-${idx}`}
                    markers={segment.markers}
                    containerWidth={contentWidth - 32}
                    onImagePress={onImagePress}
                  />
                ) : null
              ))}
            </>
          ) : (
            <Text style={styles.contentSectionText}>{content}</Text>
          )}
        </View>
      </View>
    );
  },
  (prevProps, nextProps) => 
    prevProps.content === nextProps.content && 
    prevProps.isCompleted === nextProps.isCompleted &&
    prevProps.imageMarkers === nextProps.imageMarkers
);

const GenerationContent: FC<Props> = ({ navigation, viewMode, onToggleViewMode, onOpenKnowledgeModal }) => {
  const { width: contentWidth } = useWindowDimensions();
  const {
    bidId,
    status,
    setStatus,
    outline,
    setOutline,
    generatedContent,
    setGeneratedContent,
    completedSections,
    setCompletedSections,
    initGeneratedStateFromOutline,
    connectWebSocket,
    setMainButtonAction,
    reviewResult,
    exporting,
    setExporting,
  } = useBidWriterContext();

  const { wordCount, darkBidMode, selectedLayout, selectedCover, selectedColor, hasImages, hasPageBorder, autoWebImage, autoProofread } = useBidWriterStore();

  // 本地状态
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const outlineRef = useRef(outline);

  useEffect(() => {
    outlineRef.current = outline;
  }, [outline]);

  // 图片配置状态 (Step.2)
  const [imageMarkers, setImageMarkers] = useState<Record<string, ImageMarker[]>>({});
  const [selectedMarker, setSelectedMarker] = useState<ImageMarker | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [candidateImages, setCandidateImages] = useState<string[]>([]);
  const [knowledgeImages, setKnowledgeImages] = useState<string[]>([]);
  const [imageLoading, setImageLoading] = useState(false);

  // 章节计时器 - 使用时间戳记录
  const [chapterTimers, setChapterTimers] = useState<Record<string, number>>({});
  const chapterStartTimesRef = useRef<Record<string, number>>({});
  const chapterTimerIntervalsRef = useRef<Record<string, NodeJS.Timeout>>({});
  // 【修复】使用ref保存已完成的计时器值，避免状态依赖问题
  const completedTimersRef = useRef<Record<string, number>>({});

  // 审稿结果卡片显示状态
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  
  // 导出弹窗状态
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportFileName, setExportFileName] = useState('');
  const [exportFilePath, setExportFilePath] = useState('');

  const [progress, setProgress] = useState<GenerationProgress>({
    phase: 'content',
    currentChapter: 0,
    totalChapters: 0,
    currentSection: 0,
    totalSections: 0,
    message: '准备开始生成...',
    percentage: 0,
  });

  // 基于已完成sections计算实际进度
  const calculatedPercentage = useMemo(() => {
    if (status === 'completed') return 100;
    if (progress.totalSections === 0) return 0;
    const completed = completedSections.size;
    // 所有小节完成时显示100%
    if (completed >= progress.totalSections) return 100;
    return Math.round((completed / progress.totalSections) * 100);
  }, [completedSections.size, progress.totalSections, status]);

  // 正文模式：将大纲扁平化为section列表（只在outline变化时重新计算）
  const contentSections = useMemo<ContentSectionData[]>(() => {
    if (!outline?.chapters) return [];
    const result: ContentSectionData[] = [];
    outline.chapters.forEach((chapter, chapterIndex) => {
      chapter.sub_chapters?.forEach((subChapter, subIndex) => {
        subChapter.sections?.forEach((section, sectionIndex) => {
          result.push({
            sectionId: section.id,
            chapterIndex,
            subIndex,
            sectionIndex,
            chapterTitle: chapter.title,
            subChapterTitle: subChapter.title,
            sectionTitle: section.title,
            isFirstInChapter: subIndex === 0 && sectionIndex === 0,
            isFirstInSubChapter: sectionIndex === 0,
          });
        });
      });
    });
    return result;
  }, [outline]);

  // 轮询 ref
  const outlinePollingRef = useRef<NodeJS.Timeout | null>(null);

  const totalSectionsRef = useRef(0);
  const completedCountRef = useRef(0);

  useEffect(() => {
    totalSectionsRef.current = progress.totalSections;
  }, [progress.totalSections]);

  useEffect(() => {
    completedCountRef.current = completedSections.size;
  }, [completedSections.size]);

  useEffect(() => {
    if (status !== 'generating' && status !== 'reviewing') return;
    if (totalSectionsRef.current <= 0) return;
    foregroundService.updateProgress(completedCountRef.current, totalSectionsRef.current);
  }, [status, completedSections.size, progress.totalSections]);

  // 章节计时器管理 - 使用时间戳计算实际耗时
  useEffect(() => {
    if (!outline?.chapters) return;

    outline.chapters.forEach(chapter => {
      if (chapter.status === 'generating') {
        // 记录开始时间
        if (!chapterStartTimesRef.current[chapter.id]) {
          chapterStartTimesRef.current[chapter.id] = Date.now();
        }
        // 每秒更新显示
        if (!chapterTimerIntervalsRef.current[chapter.id]) {
          chapterTimerIntervalsRef.current[chapter.id] = setInterval(() => {
            const startTime = chapterStartTimesRef.current[chapter.id];
            if (startTime) {
              const elapsed = Math.floor((Date.now() - startTime) / 1000);
              setChapterTimers(prev => ({ ...prev, [chapter.id]: elapsed }));
            }
          }, 1000);
        }
      } else if (chapter.status === 'completed' || chapter.status === 'done') {
        // 章节完成：清理 interval
        if (chapterTimerIntervalsRef.current[chapter.id]) {
          clearInterval(chapterTimerIntervalsRef.current[chapter.id]);
          delete chapterTimerIntervalsRef.current[chapter.id];
        }
        
        // 保存最终耗时到 ref（只保存一次）
        const startTime = chapterStartTimesRef.current[chapter.id];
        if (startTime && !completedTimersRef.current[chapter.id]) {
          const elapsed = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
          completedTimersRef.current[chapter.id] = elapsed;
        }
      } else {
        // 其他状态清理定时器
        if (chapterTimerIntervalsRef.current[chapter.id]) {
          clearInterval(chapterTimerIntervalsRef.current[chapter.id]);
          delete chapterTimerIntervalsRef.current[chapter.id];
        }
      }
    });

    // 每次 effect 执行后，从 ref 统一同步所有已完成章节的计时到 state
    // 这避免了 stale closure 问题（不再依赖 chapterTimers state）
    const completedEntries = completedTimersRef.current;
    if (Object.keys(completedEntries).length > 0) {
      setChapterTimers(prev => {
        const next = { ...prev };
        for (const [id, elapsed] of Object.entries(completedEntries)) {
          next[id] = elapsed;
        }
        return next;
      });
    }

    return () => {
      Object.values(chapterTimerIntervalsRef.current).forEach(clearInterval);
      chapterTimerIntervalsRef.current = {};
    };
  }, [outline?.chapters]);

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
  };

  // WebSocket hooks
  const { generatingSectionIdRef, expandedChaptersRef } = useBidWriterWebSocket({
    onGenerationProgress: (data) => {
      const phaseRaw = data.phase || data.status || 'content';
      let phase: GenerationProgress['phase'] = 'content';
      if (phaseRaw === 'images' || phaseRaw === 'image' || phaseRaw === 'searching_images') {
        phase = 'image';
      } else if (phaseRaw === 'review' || phaseRaw === 'reviewing') {
        phase = 'review';
      } else if (phaseRaw === 'completed' || phaseRaw === 'complete') {
        phase = 'completed';
      }

      if (typeof data?.percentage === 'number') {
        foregroundService.updatePercentage(data.percentage, data.message);
      }

      setProgress(prev => ({
        ...prev,
        phase,
        currentChapter: data.chapter_index ?? prev.currentChapter,
        totalChapters: data.total_chapters ?? prev.totalChapters,
        currentSection: data.section_index ?? prev.currentSection,
        totalSections: data.total_sections ?? prev.totalSections,
        message: data.message || prev.message,
        percentage: data.percentage ?? prev.percentage,
      }));
    },
    onImageSearchComplete: (data) => {
      console.log('[GenerationContent] 收到图片搜索结果:', data);
      const sectionId = data.section_id;
      const keywords = data.keywords;
      const images = data.images || [];
      
      if (sectionId && keywords && images.length > 0) {
        setImageMarkers(prev => {
          const sectionMarkers = prev[sectionId] || [];
          return {
            ...prev,
            [sectionId]: sectionMarkers.map(m => 
              m.keywords === keywords 
                ? { ...m, candidateUrls: images, imageUrl: images[0] }
                : m
            ),
          };
        });
      }
    },
    onGenerationComplete: () => {
      setProgress(prev => ({ ...prev, phase: 'completed', percentage: 100 }));
      // 完成前台服务 - 传入实际字数
      const totalChars = Object.values(generatedContent).reduce((sum, content) => 
        sum + (content || '').length, 0);
      foregroundService.completeService(totalChars);
      // [审稿功能暂未开放] setReviewModalVisible(true);
    },
  });

  // 初始化
  useEffect(() => {
    if (!bidId) return;

    foregroundService.setBidContext(bidId);

    const init = async () => {
      setLoading(true);
      try {
        // WebSocket 连接失败不应阻断整个初始化流程
        // WS 有自动重连机制，即使首次失败也会在后台持续重试
        try {
          await connectWebSocket(bidId);
        } catch (wsErr) {
          console.warn('[GenerationContent] WebSocket 连接失败，将自动重连:', wsErr);
        }

        const outlineRes = await bidWriterApi.getOutline(bidId);
        const localOutline = outlineRef.current;
        if (!localOutline?.chapters?.length) {
          setOutline(outlineRes.outline);
        }
        setStatus(outlineRes.status);
        const currentOutline = localOutline?.chapters?.length ? localOutline : outlineRes.outline;
        initGeneratedStateFromOutline(currentOutline);
        let totalSections = 0;
        currentOutline?.chapters?.forEach(ch => {
          ch.sub_chapters?.forEach(sub => {
            totalSections += sub.sections?.length || 0;
          });
        });

        setProgress(prev => ({
          ...prev,
          totalChapters: currentOutline?.chapters?.length || 0,
          totalSections,
        }));

        // 已完成的标书：直接显示结果，无需启动生成
        if (outlineRes.status === 'completed') {
          console.log('[GenerationContent] 标书已完成，直接显示结果');
          setProgress(prev => ({ ...prev, phase: 'completed', percentage: 100 }));
          return;
        }

        if (outlineRes.status === 'outline_confirmed' || outlineRes.status === 'generating' || outlineRes.status === 'reviewing') {
          const projectName = currentOutline?.chapters?.[0]?.title || '标书生成';
          await foregroundService.startService(projectName, totalSections, true);

          if (Platform.OS !== 'web') {
            const g: any = globalThis as any;
            const k = `__bidwriter_bg_tip_shown__${bidId}`;
            if (!g[k]) {
              g[k] = true;
              Alert.alert('温馨提示', '正在自动编写，你可以切回手机主页，编写会在后台自动运行，直到编写完成');
            }
          }

          // 当状态为 outline_confirmed 或 generating 时都尝试启动生成
          // generating 状态下后端会检查是否有活跃任务，避免重复启动
          // 这样可以处理后端重启后任务丢失的情况
          if (outlineRes.status === 'outline_confirmed' || outlineRes.status === 'generating') {
            try {
              const genRes = await bidWriterApi.startGeneration(bidId, {
                target_word_count: wordCount,
                dark_bid_mode: darkBidMode,
                layout_style: selectedLayout,
                has_images: hasImages,
                has_page_border: hasPageBorder,
                cover_style: selectedCover,
                color_scheme: selectedColor,
                auto_web_image: hasImages ? autoWebImage : false,
                auto_proofread: autoProofread,
                review_checklist: autoProofread ? BID_WRITER_REVIEW_CHECKLIST : undefined,
              });
              // 检查后端是否告知已完成
              if ((genRes as any)?.already_completed) {
                console.log('[GenerationContent] 后端告知标书已完成，切换到完成状态');
                setStatus('completed');
                setProgress(prev => ({ ...prev, phase: 'completed', percentage: 100 }));
                return;
              }
              console.log('[GenerationContent] 生成已启动');
              // 通知全局 Store：标书生成开始
              useAgentTaskStore.getState().markWorking('bid_writer', '正在生成标书...', bidId);
            } catch (genErr: any) {
              const errStatus = genErr?.response?.status;
              if (errStatus === 400) {
                // 400 = 已在生成中或状态不允许，属于正常情况
                console.warn('[GenerationContent] startGeneration 400, 可能已在生成中:', genErr?.response?.data);
              } else {
                console.error('[GenerationContent] startGeneration 失败:', genErr);
                const errMsg = genErr?.response?.data?.detail || genErr?.message || '启动生成失败';
                Alert.alert('启动失败', errMsg + '\n\n请返回重试或联系客服');
              }
            }
          } else {
            console.log(`[GenerationContent] 状态为 ${outlineRes.status}，通过WS+轮询观察进度`);
          }
        }
      } catch (err: any) {
        console.error('[GenerationContent] 初始化失败:', err);
        const errMsg = err?.response?.data?.detail || err?.message || '加载失败';
        Alert.alert('初始化失败', errMsg);
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      foregroundService.setBidContext(null);
    };

  }, [bidId, wordCount, darkBidMode, selectedLayout, autoWebImage, autoProofread, connectWebSocket]);

  // 轮询同步大纲内容
  useEffect(() => {
    if (outlinePollingRef.current) {
      clearInterval(outlinePollingRef.current);
      outlinePollingRef.current = null;
    }

    if (status !== 'generating') return;

    outlinePollingRef.current = setInterval(() => {
      bidWriterApi.getOutline(bidId!)
        .then(res => {
          if (res?.outline) {
            initGeneratedStateFromOutline(res.outline);
            setOutline(prev => {
              if (!prev?.chapters?.length) return res.outline;
              const updatedChapters = prev.chapters.map(ch => {
                const serverCh = res.outline?.chapters?.find(c => c.id === ch.id);
                if (!serverCh) return ch;
                return {
                  ...ch,
                  status: serverCh.status,
                  sub_chapters: ch.sub_chapters?.map(sub => {
                    const serverSub = serverCh.sub_chapters?.find(s => s.id === sub.id);
                    if (!serverSub) return sub;
                    return {
                      ...sub,
                      sections: sub.sections?.map(sec => {
                        const serverSec = serverSub.sections?.find(s => s.id === sec.id);
                        if (!serverSec) return sec;
                        return { ...sec, content: serverSec.content, status: serverSec.status };
                      }),
                    };
                  }),
                };
              });
              return { ...prev, chapters: updatedChapters };
            });
          }
        })
        .catch(() => {});
    }, 5000);

    return () => {
      if (outlinePollingRef.current) {
        clearInterval(outlinePollingRef.current);
      }
    };
  }, [bidId, status]);

  // 注册主按钮回调
  useEffect(() => {
    if (status === 'completed') {
      setMainButtonAction(() => handleExport);
    } else {
      // 生成中，不设置回调（按钮禁用）
      setMainButtonAction(null);
    }
    return () => setMainButtonAction(null);
  }, [status, setMainButtonAction]);

  // 解析所有已完成章节的图片标记（避免在 render 中 setState）
  useEffect(() => {
    if (!contentSections.length) return;
    
    const newMarkers: Record<string, ImageMarker[]> = {};
    let hasNew = false;
    
    contentSections.forEach(section => {
      const content = generatedContent[section.sectionId];
      const isCompleted = status === 'completed' || completedSections.has(section.sectionId);
      
      if (isCompleted && content && !imageMarkers[section.sectionId]) {
        const regex = /\[IMAGE:([^\]]+)\]/g;
        const markers: ImageMarker[] = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
          markers.push({
            keywords: match[1].trim(),
            position: match.index,
            imageUrl: undefined,
            candidateUrls: [],
            loading: false,
          });
        }
        if (markers.length > 0) {
          newMarkers[section.sectionId] = markers;
          hasNew = true;
        }
      }
    });
    
    if (hasNew) {
      setImageMarkers(prev => ({ ...prev, ...newMarkers }));

      // 如果启用了自动配图,自动触发图片搜索
      if (autoWebImage) {
        console.log('[GenerationContent] 自动配图已启用,开始自动搜索图片...');
        // 遍历所有新标记,自动搜索图片
        Object.entries(newMarkers).forEach(([sectionId, markers]) => {
          markers.forEach(async (marker) => {
            try {
              console.log(`[GenerationContent] 自动搜索图片: ${marker.keywords}`);
              const result = await bidWriterApi.searchImages(bidId!, marker.keywords, sectionId);
              console.log(`[GenerationContent] 搜索结果: ${result.images?.length} 张图片`);

              if (result.images && result.images.length > 0) {
                // 自动选择第一张图片
                setImageMarkers(prev => {
                  const sectionMarkers = prev[sectionId] || [];
                  return {
                    ...prev,
                    [sectionId]: sectionMarkers.map(m =>
                      m.keywords === marker.keywords
                        ? { ...m, candidateUrls: result.images, imageUrl: result.images[0] }
                        : m
                    ),
                  };
                });
              }
            } catch (error: any) {
              console.error(`[GenerationContent] 自动搜索图片失败: ${marker.keywords}`, error?.message || error);
            }
          });
        });
      }
    }
  }, [contentSections, generatedContent, completedSections, status, autoWebImage, bidId]);

  // 切换章节展开
  const toggleChapter = useCallback((chapterId: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  }, []);

  // 导出
  const handleExport = async () => {
    try {
      setExporting(true);
      
      const response = await bidWriterApi.exportDocument(bidId!, 'docx', {
        cover_style: selectedCover,
        color_scheme: selectedColor,
        layout_style: selectedLayout,
        has_images: hasImages,
        has_page_border: hasPageBorder,
      });
      
      if (!response) {
        throw new Error('服务器返回空响应');
      }
      
      if (Platform.OS === 'web') {
        const blob = new Blob([response], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `标书_${new Date().getTime()}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        setExporting(false);
        Alert.alert('导出成功', '标书已导出为Word文档');
      } else {
        const fileName = `标书_${new Date().getTime()}.docx`;
        
        let base64Data: string;
        
        if (typeof response === 'string') {
          base64Data = response;
        } else if (response instanceof ArrayBuffer || ArrayBuffer.isView(response)) {
          const binary = new Uint8Array(response);
          base64Data = Buffer.from(binary).toString('base64');
        } else if (response && typeof response === 'object' && response.data) {
          const blob = response as any;
          const binary = new Uint8Array(blob.data);
          base64Data = Buffer.from(binary).toString('base64');
        } else {
          base64Data = Buffer.from(response).toString('base64');
        }
        
        if (!base64Data || base64Data.length < 100) {
          throw new Error('导出数据无效，请重试');
        }
        
        const filePath = Platform.OS === 'ios'
          ? `${RNFS.DocumentDirectoryPath}/${fileName}`
          : `${RNFS.CachesDirectoryPath}/${fileName}`;
          
        await RNFS.writeFile(filePath, base64Data, 'base64');
        
        setExportFileName(fileName);
        setExportFilePath(filePath);
        setExporting(false);
        setExportModalVisible(true);
      }
    } catch (error: any) {
      setExporting(false);
      Alert.alert('导出失败', error.message || '无法导出标书');
    }
  };

  // 获取知识库图片
  const fetchKnowledgeImages = useCallback(async () => {
    try {
      const result = await bidWriterApi.getKnowledgeImageUrls();
      if (result.images && result.images.length > 0) {
        setKnowledgeImages(result.images.map(img => img.url));
        console.log('[GenerationContent] 获取知识库图片:', result.images.length, '张');
      }
    } catch (error) {
      console.error('[GenerationContent] 获取知识库图片失败:', error);
    }
  }, []);

  // 处理图片点击 - 打开侧边栏
  const handleImagePress = useCallback(async (marker: ImageMarker, sectionId: string) => {
    console.log('[GenerationContent] 点击图片占位框:', marker.keywords, 'sectionId:', sectionId);
    setSelectedMarker({ ...marker, sectionId } as any);
    setSidebarVisible(true);
    
    // 获取知识库图片（如果还没有获取过）
    if (knowledgeImages.length === 0) {
      fetchKnowledgeImages();
    }
    
    // 如果没有候选图片，先搜索
    if (!marker.candidateUrls || marker.candidateUrls.length === 0) {
      console.log('[GenerationContent] 开始搜索图片...');
      setImageLoading(true);
      setCandidateImages([]);
      try {
        const result = await bidWriterApi.searchImages(bidId!, marker.keywords, sectionId);
        console.log('[GenerationContent] 搜索结果:', result.images?.length, '张图片');
        setCandidateImages(result.images || []);
        // 更新 marker 的候选图片，并自动选择第一张图片
        if (result.images && result.images.length > 0) {
          setImageMarkers(prev => {
            const sectionMarkers = prev[sectionId] || [];
            return {
              ...prev,
              [sectionId]: sectionMarkers.map(m => 
                m.keywords === marker.keywords 
                  ? { ...m, candidateUrls: result.images, imageUrl: result.images[0] }
                  : m
              ),
            };
          });
          // 同时更新当前选中的 marker
          setSelectedMarker(prev => prev ? { ...prev, candidateUrls: result.images, imageUrl: result.images[0] } : null);
        }
      } catch (error: any) {
        console.error('[GenerationContent] 搜索图片失败:', error?.message || error);
      } finally {
        setImageLoading(false);
      }
    } else {
      console.log('[GenerationContent] 使用缓存的候选图片:', marker.candidateUrls.length);
      setCandidateImages(marker.candidateUrls);
      // 如果有候选图片但没有选中图片，自动选择第一张
      if (!marker.imageUrl && marker.candidateUrls.length > 0) {
        const firstImageUrl = marker.candidateUrls[0];
        if (firstImageUrl) {
          setImageMarkers(prev => {
            const sectionMarkers = prev[sectionId] || [];
            return {
              ...prev,
              [sectionId]: sectionMarkers.map(m => 
                m.keywords === marker.keywords 
                  ? { ...m, imageUrl: firstImageUrl }
                  : m
              ),
            };
          });
          setSelectedMarker(prev => prev ? { ...prev, imageUrl: firstImageUrl } : null);
        }
      }
    }
  }, [bidId]);

  // 选择图片
  const handleSelectImage = useCallback((imageUrl: string) => {
    if (!selectedMarker) return;
    const sectionId = (selectedMarker as any).sectionId;
    
    setImageMarkers(prev => {
      const sectionMarkers = prev[sectionId] || [];
      return {
        ...prev,
        [sectionId]: sectionMarkers.map(m => 
          m.keywords === selectedMarker.keywords 
            ? { ...m, imageUrl }
            : m
        ),
      };
    });
    
    setSelectedMarker(prev => prev ? { ...prev, imageUrl } : null);

    // 持久化到后端
    if (bidId && sectionId) {
      bidWriterApi.selectImage(bidId, sectionId, selectedMarker.keywords, imageUrl)
        .catch((err: any) => console.warn('[GenerationContent] selectImage persist failed:', err));
    }
  }, [selectedMarker, bidId]);

  // 关闭侧边栏
  const handleCloseSidebar = useCallback(() => {
    setSidebarVisible(false);
    setSelectedMarker(null);
  }, []);

  // 阶段图标
  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'content': return <FileText size={20} color="#fff" />;
      case 'image': return <ImageIcon size={20} color="#fff" />;
      case 'review': return <AlertCircle size={20} color="#fff" />;
      case 'completed': return <CheckCircle size={20} color="#4CAF50" />;
      default: return <Clock size={20} color="#fff" />;
    }
  };

  const getPhaseName = (phase: string) => {
    switch (phase) {
      case 'content': return 'Step.1 内容生成';
      case 'image': return 'Step.2 配置图片';
      case 'review': return 'Step.3 审稿检阅';
      case 'completed': return '已完成';
      default: return '准备中';
    }
  };

  // 渲染章节（目录模式）
  const renderChapter = (chapter: Chapter, index: number) => {
    const isExpanded = expandedChapters.has(chapter.id);

    return (
      <View key={chapter.id} style={styles.chapterItem}>
        <TouchableOpacity style={styles.chapterHeader} onPress={() => toggleChapter(chapter.id)}>
          {isExpanded ? <ChevronDown size={18} color="#fff" /> : <ChevronRight size={18} color="#fff" />}
          <Text style={styles.chapterTitle}>第{index + 1}章 {chapter.title}</Text>
          <View style={styles.chapterStatus}>
            {chapter.status === 'completed' || chapter.status === 'done' ? (
              chapterTimers[chapter.id] ? (
                <View style={styles.chapterTimerCompleted}>
                  <CheckCircle size={13} color="#4CAF50" />
                  <Text style={styles.chapterTimerCompletedText}> {formatTime(chapterTimers[chapter.id])}</Text>
                </View>
              ) : (
                <View style={styles.chapterTimerCompleted}>
                  <CheckCircle size={14} color="#4CAF50" />
                </View>
              )
            ) : chapter.status === 'generating' ? (
              <View style={styles.chapterTimerContainer}>
                <Clock size={14} color="#4CAF50" />
                <Text style={styles.chapterTimerText}>{formatTime(chapterTimers[chapter.id] || 0)}</Text>
              </View>
            ) : (
              <Clock size={16} color="rgba(255,255,255,0.5)" />
            )}
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.sectionsContainer}>
            {chapter.sub_chapters?.map((sub, subIndex) => (
              <View key={sub.id}>
                <Text style={styles.subChapterTitle}>{index + 1}.{subIndex + 1} {sub.title}</Text>
                {sub.sections?.map((section, sectionIndex) => {
                  const isCompleted = completedSections.has(section.id);
                  const isCurrent = generatingSectionIdRef.current === section.id;

                  return (
                    <View key={section.id} style={styles.sectionItem}>
                      <View style={[styles.sectionDot, isCompleted && styles.sectionDotCompleted]} />
                      <Text style={[styles.sectionTitle, isCompleted && styles.sectionTitleCompleted]} numberOfLines={1}>
                        {index + 1}.{subIndex + 1}.{sectionIndex + 1} {section.title}
                      </Text>
                      {isCompleted && <View style={styles.iconContainer}><CheckCircle size={14} color="#4CAF50" /></View>}
                      {isCurrent && !isCompleted && <View style={styles.iconContainer}><Loading size="small" color="#B20000" /></View>}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Loading size="large" color="#fff" />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 导出加载动画 */}
      {exporting && (
        <View style={styles.exportLoadingOverlay}>
          <Loading size="large" color="#fff" />
          <Text style={styles.exportLoadingText}>样式处理中...</Text>
        </View>
      )}
      
      {/* 进度卡片 */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          {getPhaseIcon(progress.phase)}
          <Text style={styles.progressPhase}>{getPhaseName(progress.phase)}</Text>
          {status === 'completed' ? (
            <TouchableOpacity
              style={styles.viewModeToggle}
              onPress={() => { if (bidId) navigation.navigate('BidHtmlPreview' as any, { bidId }); }}
              activeOpacity={0.8}
            >
              <Text style={styles.viewModeToggleText}>预览标书</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.progressPercent}>{calculatedPercentage}%</Text>
          )}
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${calculatedPercentage}%` }]} />
        </View>
        <View style={styles.progressMessageRow}>
          <Text style={styles.progressMessage}>
            {(() => {
              const totalChars = Object.values(generatedContent).reduce((sum, content) => 
                sum + (content || '').length, 0);
              const wordStr = totalChars >= 10000 
                ? `${(totalChars / 10000).toFixed(1)}万字` 
                : `${totalChars}字`;
              if (progress.totalSections > 0) {
                return `已完成 ${completedSections.size}/${progress.totalSections} 个小节（${wordStr}）`;
              }
              return progress.message;
            })()}
          </Text>
          {onToggleViewMode && (
            <TouchableOpacity onPress={onToggleViewMode} style={styles.viewModeToggle}>
              <Text style={styles.viewModeToggleText}>
                {viewMode === 'directory' ? '正文模式' : '目录模式'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 目录模式 - 使用FlatList实现虚拟化 */}
      {viewMode === 'directory' && (
        <FlatList
          data={outline?.chapters || []}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => renderChapter(item, index)}
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          removeClippedSubviews={true}
          maxToRenderPerBatch={3}
          windowSize={5}
          initialNumToRender={5}
        />
      )}

      {/* 正文模式 - 使用FlatList实现虚拟化 */}
      {viewMode === 'content' && (
        <FlatList
          data={contentSections}
          keyExtractor={(item) => item.sectionId}
          renderItem={({ item }) => (
            <ContentSectionItem
              item={item}
              content={generatedContent[item.sectionId]}
              isCompleted={status === 'completed' || completedSections.has(item.sectionId)}
              contentWidth={contentWidth}
              imageMarkers={imageMarkers[item.sectionId]}
              onImagePress={(marker) => handleImagePress(marker, item.sectionId)}
            />
          )}
          style={styles.scrollView}
          contentContainerStyle={[styles.content, { paddingBottom: 80 }]}
          removeClippedSubviews={true}
          maxToRenderPerBatch={3}
          windowSize={5}
          initialNumToRender={3}
          updateCellsBatchingPeriod={100}
        />
      )}

      {/* 图片选择侧边栏 */}
      <ImageSelectorSidebar
        visible={sidebarVisible}
        marker={selectedMarker}
        candidateImages={candidateImages}
        knowledgeImages={knowledgeImages}
        loading={imageLoading}
        onSelectImage={handleSelectImage}
        onClose={handleCloseSidebar}
        onOpenKnowledgeBase={() => {
          handleCloseSidebar();
          onOpenKnowledgeModal?.();
        }}
      />

      {/* 审稿结果卡片 */}
      <ReviewResultCard
        visible={reviewModalVisible}
        reviewResult={reviewResult}
        onClose={() => setReviewModalVisible(false)}
      />

      {/* 导出选项弹窗 */}
      <ExportModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        fileName={exportFileName}
        filePath={exportFilePath}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', fontSize: 16, marginTop: 16 },
  exportLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  exportLoadingText: { color: '#fff', fontSize: 16, marginTop: 16 },
  progressCard: { marginHorizontal: 16, marginTop: 12, marginBottom: 8, padding: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  progressPhase: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8, flex: 1 },
  progressPercent: { color: '#fff', fontSize: 18, fontWeight: '700' },

  progressBarContainer: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 3 },
  progressMessageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  progressMessage: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  viewModeToggle: { paddingHorizontal: 10, paddingVertical: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10 },
  viewModeToggleText: { color: '#FFFFFF', fontSize: 12, fontWeight: '500' },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  chapterItem: { marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden' },
  chapterHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  chapterTitle: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '500', marginLeft: 8 },
  chapterStatus: { marginLeft: 8 },
  chapterTimerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(76,175,80,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  chapterTimerText: { color: '#4CAF50', fontSize: 12, fontWeight: '600', marginLeft: 4 },
  chapterTimerCompleted: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(76,175,80,0.3)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  chapterTimerCompletedText: { color: '#4CAF50', fontSize: 12, fontWeight: '600' },
  sectionsContainer: { paddingHorizontal: 16, paddingBottom: 12 },
  subChapterTitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500', marginTop: 8, marginBottom: 4 },
  sectionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 4, marginLeft: 12 },
  sectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginRight: 8 },
  sectionDotCompleted: { backgroundColor: '#4CAF50' },
  sectionTitle: { flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  sectionTitleCompleted: { color: 'rgba(255,255,255,0.9)' },
  iconContainer: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  contentChapterTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12 },
  contentSubChapterTitle: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginBottom: 8 },
  contentSection: { marginBottom: 8 },
  contentSectionTitle: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.8)', marginBottom: 6 },
  contentSectionText: { fontSize: 12, lineHeight: 22, color: 'rgba(255,255,255,0.7)' },
  contentMarkdownBase: { fontSize: 12, lineHeight: 22, color: 'rgba(255,255,255,0.9)' },
});

export default GenerationContent;
