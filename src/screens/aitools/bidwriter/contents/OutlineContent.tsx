import { Loading } from '@/components/common/Loading';
/**
 * Step 2: 大纲编辑内容区
 * 负责大纲展示、编辑、排序
 */
import React, { FC, useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  InteractionManager,
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Edit3,
  X,
  GripVertical,
} from 'lucide-react-native';
import { bidWriterApi } from '@/services/bidWriter';
import { BID_WRITER_REVIEW_CHECKLIST } from '@/constants/bidWriterReviewChecklist';

/** 将大纲流式 JSON 转换为可读的 Markdown 格式 */
function formatOutlineStreamToMarkdown(raw: string): string {
  if (!raw || raw.trim().length === 0) return '';
  const ids: string[] = [];
  const titles: string[] = [];
  const idRe = /"id"\s*:\s*"([^"]*)"/g;
  const titleRe = /"title"\s*:\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = idRe.exec(raw)) !== null) ids.push(m[1]);
  while ((m = titleRe.exec(raw)) !== null) titles.push(m[1]);
  const lines: string[] = [];
  const count = Math.min(ids.length, titles.length);
  for (let i = 0; i < count; i++) {
    const id = ids[i];
    const title = titles[i];
    const dotCount = (id.match(/\./g) || []).length;
    if (dotCount === 0) {
      lines.push('■ 第' + id + '章  ' + title);
    } else if (dotCount === 1) {
      lines.push('  ▸ ' + id + '  ' + title);
    } else {
      lines.push('      •  ' + title);
    }
  }
  for (let i = count; i < titles.length; i++) {
    lines.push('      •  ' + titles[i]);
  }
  return lines.length > 0 ? lines.join('\n') : 'AI正在思考大纲结构...';
}
import type { Chapter, SubChapter, Section } from '@/services/bidWriter';
import { useBidWriterContext } from '../BidWriterContext';
import { useBidWriterWebSocket } from '../useBidWriterWebSocket';
import { useBidWriterStore } from '@/stores/useBidWriterStore';
import type { RootStackScreenProps } from '@/navigation/types';

type Props = {
  navigation: RootStackScreenProps<'BidWriter'>['navigation'];
};

const OutlineContent: FC<Props> = ({ navigation }) => {
  const {
    bidId,
    outline,
    setOutline,
    status,
    setStatus,
    setStep,
    connectWebSocket,
    setMainButtonAction,
  } = useBidWriterContext();

  const { wordCount, darkBidMode, selectedLayout, selectedCover, selectedColor, selectedKnowledgeFilePaths, autoWebImage, autoProofread } = useBidWriterStore();

  // 状态
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [expandedSubChapters, setExpandedSubChapters] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [generatingOutline, setGeneratingOutlineLocal] = useState(false);

  // 活性检测：记录最后一次收到大纲流式内容的时间
  const lastOutlineActivityRef = useRef(Date.now());
  const prevStreamLengthRef = useRef(0);

  const lastLocalEditAtRef = useRef<number>(0);
  const hasLocalEditsRef = useRef(false);
  const markLocalEdit = useCallback(() => {
    lastLocalEditAtRef.current = Date.now();
    hasLocalEditsRef.current = true;
  }, []);
  const shouldIgnoreRemoteOutline = useCallback(() => {
    return hasLocalEditsRef.current || (Date.now() - lastLocalEditAtRef.current < 8000);
  }, []);

  const getSubChapterKey = useCallback((chapterId: string, subChapterId: string) => {
    return `${chapterId}:${subChapterId}`;
  }, []);
  
  // 同步本地状态和全局状态
  const setGeneratingOutline = (value: boolean) => {
    setGeneratingOutlineLocal(value);
    if (value) {
      setStatus('generating_outline');
    } else {
      setStatus('outline_editing');
    }
  };
  const [outlineListReady, setOutlineListReady] = useState(false);
  const [outlineStreamContent, setOutlineStreamContent] = useState('');
  const [fullStreamContent, setFullStreamContent] = useState('');
  const streamScrollViewRef = useRef<ScrollView>(null);
  const outlineLoadedRef = useRef(false);
  const outlineRef = useRef(outline); // 用于避免闭包陷阱，确保始终使用最新的 outline
  const outlineGenerationRequestedRef = useRef(false);
  const loadOutlineRef = useRef<() => Promise<void>>();
  const fetchStreamContentRef = useRef<() => Promise<void>>();

  // 同步 outline 到 ref
  useEffect(() => {
    outlineRef.current = outline;
  }, [outline]);

  // 二次确认弹窗
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmChecks, setConfirmChecks] = useState({
    outlineReviewed: false,
    knowledgeReady: false,
    configConfirmed: false,
  });

  // 大纲生成错误状态
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [outlineTimeout, setOutlineTimeout] = useState(false);

  useEffect(() => {
    outlineGenerationRequestedRef.current = false;
    hasLocalEditsRef.current = false;
  }, [bidId]);

  const requestOutlineGeneration = useCallback(async () => {
    if (!bidId) return;
    if (outlineGenerationRequestedRef.current) return;
    outlineGenerationRequestedRef.current = true;
    try {
      await bidWriterApi.regenerateOutline(bidId);
    } catch (e) {
      outlineGenerationRequestedRef.current = false;
      throw e;
    }
  }, [bidId]);

  // 大纲数据到达时隐藏 loading
  useEffect(() => {
    setOutlineListReady(false);
    if (outline?.chapters && outline.chapters.length > 0) {
      const task = InteractionManager.runAfterInteractions(() => {
        setOutlineListReady(true);
      });
      return () => task.cancel();
    }
  }, [outline]);

  // 大纲已生成时关闭生成中状态
  useEffect(() => {
    if (outline?.chapters?.length && outline.chapters.length > 0 && generatingOutline) {
      setGeneratingOutline(false);
      setOutlineStreamContent('');
    }
  }, [generatingOutline, outline]);

  // 大纲流式内容直接显示（已移除打字机效果）
  const updateStreamContent = useCallback((targetContent: string) => {
    setOutlineStreamContent(targetContent);
  }, []);

  // 加载大纲
  const loadOutline = useCallback(async () => {
    if (!bidId) return;
    try {
      const outlineRes = await bidWriterApi.getOutline(bidId);
      if (outlineRes.outline && outlineRes.outline.chapters?.length > 0) {
        if (shouldIgnoreRemoteOutline() && outlineRef.current?.chapters?.length) {
          return;
        }
        // 如果 API 返回了大纲数据，说明不需要生成，直接显示大纲
        // 不调用 setGeneratingOutline(false)，避免与 onConnected 竞争
        setOutline(outlineRes.outline);
        setExpandedChapters(new Set([outlineRes.outline.chapters[0].id]));
      } else {
        // 如果没有大纲，才开始生成
        setGeneratingOutline(true);
        requestOutlineGeneration().catch((e: any) => {
          setOutlineError(e?.message || '大纲生成失败，请重试');
          setGeneratingOutline(false);
        });
      }
    } catch (error: any) {
      // 无论什么错误，都尝试请求生成大纲
      setGeneratingOutline(true);

      requestOutlineGeneration().catch((e: any) => {
        setOutlineError(e?.message || '大纲生成失败，请重试');
        setGeneratingOutline(false);
      });
    }
  }, [bidId, setOutline, requestOutlineGeneration, shouldIgnoreRemoteOutline]);

  // 保持ref同步
  useEffect(() => {
    loadOutlineRef.current = loadOutline;
  }, [loadOutline]);

  // 获取流式内容
  const fetchStreamContent = useCallback(async () => {
    if (!bidId) return;
    try {
      const res = await bidWriterApi.getOutlineStream(bidId);
      const formatted = formatOutlineStreamToMarkdown(res.content);

      // 检测内容是否有变化，有变化则刷新活性时间
      if (formatted.length !== prevStreamLengthRef.current) {
        prevStreamLengthRef.current = formatted.length;
        lastOutlineActivityRef.current = Date.now();
      }

      setFullStreamContent(formatted);
      updateStreamContent(formatted);

      // 检查错误状态（后端明确报错才终止）
      if (res.error) {
        console.error('大纲生成错误:', res.error);
        setOutlineError(res.error);
        setGeneratingOutline(false);
        return;
      }

      if (res.is_timeout) {
        console.warn('[Outline] 后端报告超时，但继续等待（由前端活性检测决定）');
      }

      if (res.has_outline) {
        setGeneratingOutline(false);
        setOutlineStreamContent('');
        setOutlineError(null);
        if (!outlineLoadedRef.current) {
          outlineLoadedRef.current = true;
          await loadOutline();
        }
      }
    } catch (error) {
      console.error('获取流式内容失败:', error);
      setOutlineError((error as any)?.message || '获取流式内容失败');
      setOutlineTimeout(false);
      setGeneratingOutline(false);
    }
  }, [bidId, updateStreamContent, loadOutline]);

  // 保持ref同步
  useEffect(() => {
    fetchStreamContentRef.current = fetchStreamContent;
  }, [fetchStreamContent]);

  // WebSocket 事件
  useBidWriterWebSocket({
    onStreamChunk: (data) => {
      // 直接处理后端推送的大纲流式内容（无需轮询）
      if (data.stream_type === 'outline' && data.full_content) {
        lastOutlineActivityRef.current = Date.now();
        const formatted = formatOutlineStreamToMarkdown(data.full_content);
        if (formatted.length !== prevStreamLengthRef.current) {
          prevStreamLengthRef.current = formatted.length;
        }
        setFullStreamContent(formatted);
        updateStreamContent(formatted);
      }
    },
    onStreamUpdate: () => {
      // 兜底：如果后端还发了 stream_update（旧逻辑），也拉取一次
      fetchStreamContentRef.current?.();
    },
    onOutlineReady: (data) => {
      setGeneratingOutline(false);
      setOutlineStreamContent('');
      setOutlineError(null);
      outlineLoadedRef.current = true;
      if (data.outline && data.outline.chapters?.length > 0) {
        if (shouldIgnoreRemoteOutline() && outlineRef.current?.chapters?.length) {
          return;
        }
        setOutline(data.outline);
        setExpandedChapters(new Set([data.outline.chapters[0].id]));
      } else {
        loadOutlineRef.current?.();
      }
    },
    onOutlineError: (data: { error: string }) => {
      console.error('收到大纲错误:', data.error);
      setGeneratingOutline(false);
      setOutlineError(data.error);
    },
    onConnected: (data) => {
      if (!data.has_outline) {
        // 后端说没有大纲
        setGeneratingOutline(true);
        setOutlineError(null);
        setOutlineTimeout(false);
        if (data.outline_generating) {
          // 大纲正在后台生成中（解析后自动触发），不要重复请求
          console.log('[Outline] 大纲正在后台生成中，等待完成...');
        } else {
          // 大纲确实不存在且未在生成，需要请求生成
          requestOutlineGeneration().catch((e: any) => {
            setOutlineError(e?.message || '大纲生成失败，请重试');
            setGeneratingOutline(false);
          });
        }
        fetchStreamContentRef.current?.();
      } else {
        loadOutlineRef.current?.();
      }
    },
  });

  // 轮询作为 WebSocket 的兜���备选（降低频率到5秒）
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (generatingOutline && bidId) {
      // 初始化活性计时器
      lastOutlineActivityRef.current = Date.now();
      prevStreamLengthRef.current = 0;

      // 备选轮询（WebSocket 主推送，轮询仅作兜底）
      pollingIntervalRef.current = setInterval(() => {
        fetchStreamContentRef.current?.();
      }, 5000); // 降低到每5秒轮询一次

      // 活性检测：每20秒检查一次，如果2分钟内流式内容没有任何变化则认为超时
      const IDLE_TIMEOUT_MS = 120000;
      const idleCheckInterval = setInterval(() => {
        const idleMs = Date.now() - lastOutlineActivityRef.current;
        if (idleMs > IDLE_TIMEOUT_MS) {
          console.warn(`[大纲活性检测] 已超过${Math.round(idleMs / 1000)}秒无新内容，判定超时`);
          setOutlineTimeout(true);
          setGeneratingOutline(false);
        }
      }, 20000);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        clearInterval(idleCheckInterval);
      };
    } else {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [generatingOutline, bidId]);

  // 初始化
  useEffect(() => {
    if (!bidId) return;

    const init = async () => {
      setLoading(true);
      outlineLoadedRef.current = false;

      try {
        await connectWebSocket(bidId);
        await loadOutline();
      } catch (err) {
        console.error('初始化失败:', err);
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [bidId, connectWebSocket, loadOutline]);

  // 注册主按钮回调
  useEffect(() => {
    if (generatingOutline || status === 'generating_outline') {
      // 生成大纲中，不设置回调（按钮禁用）
      setMainButtonAction(null);
    } else if (outline?.chapters?.length) {
      // 大纲已生成，主按钮触发确认弹窗
      setMainButtonAction(() => () => setConfirmModalVisible(true));
    } else {
      setMainButtonAction(null);
    }
    return () => setMainButtonAction(null);
  }, [generatingOutline, status, outline, setMainButtonAction]);

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

  // 切换小节展开
  const toggleSubChapter = useCallback((chapterId: string, subChapterId: string) => {
    const key = getSubChapterKey(chapterId, subChapterId);
    setExpandedSubChapters(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, [getSubChapterKey]);

  // 开始编辑
  const startEdit = useCallback((id: string, text: string) => {
    setEditingId(id);
    setEditingText(text);
  }, []);

  // 保存编辑
  const saveEdit = useCallback(() => {
    if (!outline || !editingId) return;

    const newOutline = { ...outline };
    for (const chapter of newOutline.chapters) {
      if (chapter.id === editingId) {
        chapter.title = editingText;
        break;
      }
      for (const sub of chapter.sub_chapters) {
        if (sub.id === editingId) {
          sub.title = editingText;
          break;
        }
        for (const section of sub.sections) {
          if (section.id === editingId) {
            section.title = editingText;
            break;
          }
        }
      }
    }

    markLocalEdit();
    setOutline(newOutline);
    if (bidId) {
      bidWriterApi.updateOutline(bidId, newOutline).catch(err => {
        console.warn('自动保存大纲失败:', err);
      });
    }
    setEditingId(null);
    setEditingText('');
  }, [outline, editingId, editingText, setOutline, bidId, markLocalEdit]);

  // 取消编辑
  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingText('');
  }, []);

  // ========== 添加章节功能 ==========
  const generateUID = useCallback(() => {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  }, []);

  const handleAddChapter = useCallback(() => {
    if (!outline) return;
    const newChapter: Chapter = {
      id: generateUID(),
      title: '新章节',
      description: '',
      sub_chapters: [],
    };
    const newOutline = {
      ...outline,
      chapters: [...outline.chapters, newChapter],
    };
    markLocalEdit();
    setOutline(newOutline);
    setExpandedChapters(prev => new Set(prev).add(newChapter.id));
    setEditingId(newChapter.id);
    setEditingText(newChapter.title);
    if (bidId) {
      bidWriterApi.updateOutline(bidId, newOutline).catch(err => {
        console.warn('自动保存大纲失败:', err);
      });
    }
  }, [outline, setOutline, bidId, markLocalEdit, generateUID]);

  const handleAddSubChapter = useCallback((chapterId: string) => {
    if (!outline) return;
    const newSubChapter: SubChapter = {
      id: generateUID(),
      title: '新节',
      description: '',
      sections: [],
    };
    const newOutline = { ...outline };
    for (const chapter of newOutline.chapters) {
      if (chapter.id === chapterId) {
        chapter.sub_chapters = [...chapter.sub_chapters, newSubChapter];
        break;
      }
    }
    markLocalEdit();
    setOutline(newOutline);
    const key = `${chapterId}:${newSubChapter.id}`;
    setExpandedSubChapters(prev => new Set(prev).add(key));
    setEditingId(newSubChapter.id);
    setEditingText(newSubChapter.title);
    if (bidId) {
      bidWriterApi.updateOutline(bidId, newOutline).catch(err => {
        console.warn('自动保存大纲失败:', err);
      });
    }
  }, [outline, setOutline, bidId, markLocalEdit, generateUID]);

  const handleAddSection = useCallback((chapterId: string, subChapterId: string) => {
    if (!outline) return;
    const newSection: Section = {
      id: generateUID(),
      title: '新条目',
      description: '请填写条目描述',
      content: '',
      status: 'pending',
    };
    const newOutline = { ...outline };
    for (const chapter of newOutline.chapters) {
      if (chapter.id === chapterId) {
        for (const sub of chapter.sub_chapters) {
          if (sub.id === subChapterId) {
            sub.sections = [...sub.sections, newSection];
            break;
          }
        }
        break;
      }
    }
    markLocalEdit();
    setOutline(newOutline);
    setEditingId(newSection.id);
    setEditingText(newSection.title);
    if (bidId) {
      bidWriterApi.updateOutline(bidId, newOutline).catch(err => {
        console.warn('自动保存大纲失败:', err);
      });
    }
  }, [outline, setOutline, bidId, markLocalEdit, generateUID]);

  // 删除章/节/条
  const handleDelete = useCallback((id: string, type: 'chapter' | 'subChapter' | 'section') => {
    if (!outline) return;
    
    Alert.alert(
      '确认删除',
      `确定要删除这个${type === 'chapter' ? '章' : type === 'subChapter' ? '节' : '条'}吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            const newOutline = { ...outline };
            if (type === 'chapter') {
              newOutline.chapters = newOutline.chapters.filter(c => c.id !== id);

              setExpandedChapters(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });

              setExpandedSubChapters(prev => {
                const next = new Set(prev);
                for (const key of next) {
                  if (key.startsWith(`${id}:`)) next.delete(key);
                }
                return next;
              });
            } else if (type === 'subChapter') {
              for (const chapter of newOutline.chapters) {
                chapter.sub_chapters = chapter.sub_chapters.filter(s => s.id !== id);
              }

              setExpandedSubChapters(prev => {
                const next = new Set(prev);
                for (const key of next) {
                  if (key.endsWith(`:${id}`)) next.delete(key);
                }
                return next;
              });
            } else {
              for (const chapter of newOutline.chapters) {
                for (const sub of chapter.sub_chapters) {
                  sub.sections = sub.sections.filter(s => s.id !== id);
                }
              }
            }
            markLocalEdit();
            setOutline(newOutline);
            if (bidId) {
              bidWriterApi.updateOutline(bidId, newOutline).catch(err => {
                console.warn('自动保存大纲失败:', err);
              });
            }
          },
        },
      ]
    );
  }, [outline, setOutline, bidId, markLocalEdit]);

  // 保存大纲到后端
  const handleSaveOutline = async () => {
    const currentOutline = outlineRef.current;
    if (!bidId || !currentOutline) return;
    setSaving(true);
    try {
      await bidWriterApi.updateOutline(bidId, currentOutline);
      Alert.alert('保存成功', '大纲已保存');
    } catch (err: any) {
      Alert.alert('保存失败', err.message || '无法保存大纲');
    } finally {
      setSaving(false);
    }
  };

  // 确认并开始生成
  const handleConfirmAndGenerate = async () => {
    const currentOutline = outlineRef.current; // 使用 ref 获取最新的 outline
    if (!bidId || !currentOutline) return;

    // 检查是否所有确认项都已勾选
    const allChecked = confirmChecks.outlineReviewed && confirmChecks.knowledgeReady && confirmChecks.configConfirmed;
    if (!allChecked) {
      return;
    }

    setConfirmModalVisible(false);
    setSaving(true);

    try {
      console.log('保存大纲:', currentOutline.chapters?.map(c => c.title));
      await bidWriterApi.updateOutline(bidId, currentOutline);
      await bidWriterApi.confirmOutline(bidId);
      setStatus('generating');
      setStep(3);
    } catch (err: any) {
      console.error('[OutlineContent] 确认大纲失败:', err);
      Alert.alert('确认失败', err.message || '无法确认大纲，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 渲染章节
  const renderChapter = useCallback(({ item: chapter, drag, isActive, getIndex }: RenderItemParams<Chapter>) => {
    const chapterIndex = (getIndex() ?? 0) + 1;
    const isExpanded = expandedChapters.has(chapter.id);
    const isEditing = editingId === chapter.id;

    return (
      <ScaleDecorator>
        <View style={[styles.chapterItem, isActive && styles.chapterItemActive]}>
          <View style={styles.chapterHeader}>
            <TouchableOpacity style={styles.dragHandle} onLongPress={drag}>
              <GripVertical size={16} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chapterTitleRow}
              onPress={() => toggleChapter(chapter.id)}
            >
              {isExpanded ? (
                <ChevronDown size={16} color="#fff" />
              ) : (
                <ChevronRight size={16} color="#fff" />
              )}

              {isEditing ? (
                <View style={styles.editRow}>
                  <TextInput
                    style={[styles.editInputFlex, styles.editInputChapter]}
                    value={editingText}
                    onChangeText={setEditingText}
                    autoFocus
                  />
                  <TouchableOpacity style={styles.editBtn} onPress={saveEdit}>
                    <Text style={{fontSize: 16, color: '#4CAF50', fontWeight: '700', lineHeight: 18}}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.editBtn} onPress={() => handleDelete(chapter.id, 'chapter')}>
                    <Text style={{fontSize: 14, color: '#f44336', fontWeight: '400', lineHeight: 18}}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.chapterTitle} numberOfLines={1}>
                  第{chapterIndex}章 {chapter.title}
                </Text>
              )}
            </TouchableOpacity>

            {!isEditing && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => startEdit(chapter.id, chapter.title)}
              >
                <Edit3 size={14} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            )}
          </View>

          {isExpanded && (
            <View style={styles.subChaptersContainer}>
              {chapter.sub_chapters?.map((sub, subIndex) => {
                const subKey = getSubChapterKey(chapter.id, sub.id);
                const isSubEditing = editingId === sub.id;
                return (
                  <View key={subKey} style={styles.subChapterItem}>
                    <View style={styles.subChapterHeader}>
                      <TouchableOpacity
                        style={styles.subChapterTitleRow}
                        onPress={() => toggleSubChapter(chapter.id, sub.id)}
                      >
                        {expandedSubChapters.has(subKey) ? (
                          <ChevronDown size={14} color="#666" />
                        ) : (
                          <ChevronRight size={14} color="#666" />
                        )}
                        {isSubEditing ? (
                          <View style={styles.editRow}>
                            <TextInput
                              style={[styles.editInputFlex, styles.editInputSub]}
                              value={editingText}
                              onChangeText={setEditingText}
                              autoFocus
                            />
                            <TouchableOpacity style={styles.editBtn} onPress={saveEdit}>
                              <Text style={{fontSize: 14, color: '#4CAF50', fontWeight: '700', lineHeight: 16}}>✓</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.editBtn} onPress={() => handleDelete(sub.id, 'subChapter')}>
                              <Text style={{fontSize: 12, color: '#f44336', fontWeight: '400', lineHeight: 16}}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <Text style={styles.subChapterTitle} numberOfLines={1}>
                            {chapterIndex}.{subIndex + 1} {sub.title}
                          </Text>
                        )}
                      </TouchableOpacity>
                      {!isSubEditing && (
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => startEdit(sub.id, sub.title)}
                        >
                          <Edit3 size={12} color="rgba(102,102,102,0.8)" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {expandedSubChapters.has(subKey) && (
                      <View style={styles.sectionsContainer}>
                        {sub.sections?.map((section, secIndex) => {
                          const isSectionEditing = editingId === section.id;
                          return (
                            <View key={`${subKey}:${section.id}`} style={styles.sectionItem}>
                              <View style={styles.sectionRow}>
                                {isSectionEditing ? (
                                  <View style={styles.editRow}>
                                    <TextInput
                                      style={[styles.editInputFlex, styles.editInputSection]}
                                      value={editingText}
                                      onChangeText={setEditingText}
                                      autoFocus
                                    />
                                    <TouchableOpacity style={styles.editBtn} onPress={saveEdit}>
                                      <Text style={{fontSize: 12, color: '#4CAF50', fontWeight: '700', lineHeight: 14}}>✓</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.editBtn} onPress={() => handleDelete(section.id, 'section')}>
                                      <Text style={{fontSize: 10, color: '#f44336', fontWeight: '400', lineHeight: 14}}>✕</Text>
                                    </TouchableOpacity>
                                  </View>
                                ) : (
                                  <>
                                    <View style={styles.sectionDot} />
                                    <Text style={styles.sectionTitle} numberOfLines={1}>
                                      {chapterIndex}.{subIndex + 1}.{secIndex + 1} {section.title}
                                    </Text>
                                    <TouchableOpacity
                                      style={styles.actionBtn}
                                      onPress={() => startEdit(section.id, section.title)}
                                    >
                                      <Edit3 size={10} color="rgba(102,102,102,0.6)" />
                                    </TouchableOpacity>
                                  </>
                                )}
                              </View>
                            </View>
                          );
                        })}
                        {/* 添加条目按钮 */}
                        <TouchableOpacity
                          style={styles.addSectionBtn}
                          onPress={() => handleAddSection(chapter.id, sub.id)}
                        >
                          <Plus size={12} color="#B20000" />
                          <Text style={styles.addSectionBtnText}>添加条目</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
              {/* 添加节按钮 */}
              <TouchableOpacity
                style={styles.addSubChapterBtn}
                onPress={() => handleAddSubChapter(chapter.id)}
              >
                <Plus size={14} color="#B20000" />
                <Text style={styles.addSubChapterBtnText}>添加节</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScaleDecorator>
    );
  }, [expandedChapters, expandedSubChapters, editingId, editingText, toggleChapter, toggleSubChapter, startEdit, saveEdit, handleDelete, handleAddSection, handleAddSubChapter]);

  // 重试大纲生成
  const handleRetryOutline = useCallback(async () => {
    if (!bidId) return;
    setOutlineError(null);
    setOutlineTimeout(false);
    setGeneratingOutline(true);
    setOutlineStreamContent('');
    setFullStreamContent('');
    outlineLoadedRef.current = false;
    outlineGenerationRequestedRef.current = false;
    
    try {
      await requestOutlineGeneration();
    } catch (error: any) {
      console.error('重试失败:', error);
      setOutlineError(error?.message || '重试失败，请稍后再试');
      setGeneratingOutline(false);
    }
  }, [bidId, requestOutlineGeneration]);

  const handleDragEnd = useCallback(({ data }: { data: Chapter[] }) => {
    if (outline) {
      const nextOutline = { ...outline, chapters: data };
      markLocalEdit();
      setOutline(nextOutline);
      if (bidId) {
        bidWriterApi.updateOutline(bidId, nextOutline).catch(err => {
          console.warn('自动保存大纲失败:', err);
        });
      }
    }
  }, [outline, setOutline, bidId, markLocalEdit]);

  const handleListLayout = useCallback(() => {
    if (!outlineListReady && outline?.chapters && outline.chapters.length > 0) {
      setOutlineListReady(true);
    }
  }, [outlineListReady, outline?.chapters]);

  // 状态判断优先级：
  // 0. 如果有错误或超时 → 显示错误提示和重试按钮
  // 1. 如果大纲正在生成（未就绪）→ 显示流式弹窗
  // 2. 如果大纲已就绪但列表未渲染完成 → 显示加载动画
  // 3. 否则显示大纲列表
  
  // 错误或超时状态（优先级最高）
  if (outlineError || outlineTimeout) {
    return (
      <View style={styles.generatingContainer}>
        <View style={styles.generatingCard}>
          <View style={styles.errorIconContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
          </View>
          <Text style={styles.generatingTitle}>
            {outlineTimeout ? '大纲生成超时' : '大纲生成失败'}
          </Text>
          <Text style={styles.errorMessage}>
            {outlineError || '生成时间过长，可能是网络问题或服务繁忙'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetryOutline}>
            <Text style={styles.retryButtonText}>重新生成</Text>
          </TouchableOpacity>
          <Text style={styles.errorHint}>
            如果问题持续，请尝试返回重新上传文档
          </Text>
        </View>
      </View>
    );
  }

  // 生成中状态
  if (generatingOutline) {
    return (
      <View style={styles.generatingContainer}>
        <View style={styles.generatingCard}>
          <Loading size="large" color="rgba(255,255,255,0.9)" />
          <Text style={styles.generatingTitle}>正在生成大纲思路...</Text>
          <ScrollView
            ref={streamScrollViewRef}
            style={styles.streamScrollView}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              streamScrollViewRef.current?.scrollToEnd({ animated: false });
            }}
          >
            <Text style={styles.streamText}>
              {outlineStreamContent || 'AI正在思考大纲结构...'}
            </Text>
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={{ flex: 1 }}>
        <DraggableFlatList
          data={outline?.chapters || []}
          keyExtractor={(item) => item.id}
          renderItem={renderChapter}
          onDragEnd={handleDragEnd}
          contentContainerStyle={styles.listContent}
          style={{ height: '100%' }}
          onLayout={handleListLayout}
          ListFooterComponent={
            <TouchableOpacity
              style={styles.addChapterBtn}
              onPress={handleAddChapter}
            >
              <Plus size={16} color="#fff" />
              <Text style={styles.addChapterBtnText}>添加章</Text>
            </TouchableOpacity>
          }
        />

        {/* 加载中覆盖层 */}
        {(loading || (!generatingOutline && (!outline || !outlineListReady))) && (
          <View style={styles.loadingOverlay}>
            <Loading size="large" color="#fff" />
            <Text style={styles.loadingText}>加载大纲中...</Text>
          </View>
        )}
      </View>

      {/* 二次确认弹窗 */}
      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="none"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmModalTitle}>生成前确认</Text>
            <Text style={styles.confirmModalSubtitle}>请确认以下事项后开始生成</Text>

            <View style={styles.confirmCheckList}>
              <TouchableOpacity
                style={styles.confirmCheckItem}
                onPress={() => setConfirmChecks(prev => ({ ...prev, outlineReviewed: !prev.outlineReviewed }))}
              >
                <View style={[styles.confirmCheckbox, confirmChecks.outlineReviewed && styles.confirmCheckboxChecked]}>
                  {confirmChecks.outlineReviewed && <Text style={{fontSize: 14, color: '#fff', fontWeight: '700', lineHeight: 16}}>✓</Text>}
                </View>
                <Text style={styles.confirmCheckText}>已检查大纲结构和内容</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmCheckItem}
                onPress={() => setConfirmChecks(prev => ({ ...prev, knowledgeReady: !prev.knowledgeReady }))}
              >
                <View style={[styles.confirmCheckbox, confirmChecks.knowledgeReady && styles.confirmCheckboxChecked]}>
                  {confirmChecks.knowledgeReady && <Text style={{fontSize: 14, color: '#fff', fontWeight: '700', lineHeight: 16}}>✓</Text>}
                </View>
                <Text style={styles.confirmCheckText}>已准备好知识库文件</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmCheckItem}
                onPress={() => setConfirmChecks(prev => ({ ...prev, configConfirmed: !prev.configConfirmed }))}
              >
                <View style={[styles.confirmCheckbox, confirmChecks.configConfirmed && styles.confirmCheckboxChecked]}>
                  {confirmChecks.configConfirmed && <Text style={{fontSize: 14, color: '#fff', fontWeight: '700', lineHeight: 16}}>✓</Text>}
                </View>
                <Text style={styles.confirmCheckText}>已确认生成配置（暗标、字数等）</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.confirmModalButtons}>
              <TouchableOpacity
                style={styles.confirmModalCancelBtn}
                onPress={() => setConfirmModalVisible(false)}
              >
                <Text style={styles.confirmModalCancelText}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmModalConfirmBtn,
                  !(confirmChecks.outlineReviewed && confirmChecks.knowledgeReady && confirmChecks.configConfirmed) &&
                    styles.confirmModalConfirmBtnDisabled,
                ]}
                onPress={handleConfirmAndGenerate}
                disabled={!(confirmChecks.outlineReviewed && confirmChecks.knowledgeReady && confirmChecks.configConfirmed)}
              >
                <Text style={[
                  styles.confirmModalConfirmText,
                  !(confirmChecks.outlineReviewed && confirmChecks.knowledgeReady && confirmChecks.configConfirmed) &&
                    styles.confirmModalConfirmTextDisabled,
                ]}>
                  {saving ? '处理中...' : '开始生成'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 12,
  },
  generatingContainer: {
    flex: 1,
    padding: 16,
  },
  generatingCard: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  generatingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 16,
  },
  streamScrollView: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 16,
  },
  streamText: {
    fontSize: 13,
    color: '#444',
    lineHeight: 22,
  },
  listContent: {
    padding: 12,
    paddingBottom: 100,
  },
  chapterItem: {
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chapterItemActive: {
    opacity: 0.9,
    transform: [{ scale: 1.02 }],
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  dragHandle: {
    padding: 4,
    marginRight: 4,
  },
  chapterTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chapterTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  actionBtn: {
    padding: 4,
    marginLeft: 2,
  },
  editRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  editInputFlex: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    color: '#333',
  },
  editInputChapter: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
  },
  editInputSub: {
    backgroundColor: '#fff',
    color: '#333',
  },
  editInputSection: {
    backgroundColor: '#fff',
    color: '#666',
    fontSize: 12,
  },
  editBtn: {
    padding: 4,
    marginLeft: 4,
  },
  subChaptersContainer: {
    padding: 8,
  },
  subChapterItem: {
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  subChapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f8f8f8',
  },
  subChapterTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  subChapterTitle: {
    flex: 1,
    color: '#333',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
  },
  sectionsContainer: {
    padding: 6,
    paddingLeft: 24,
  },
  sectionItem: {
    marginBottom: 3,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  sectionDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#B20000',
    marginRight: 6,
  },
  sectionTitle: {
    flex: 1,
    color: '#666',
    fontSize: 12,
  },
  confirmButton: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#B20000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  confirmModal: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  confirmModalSubtitle: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmCheckList: {
    marginBottom: 20,
  },
  confirmCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  confirmCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCheckboxChecked: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  confirmCheckText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  confirmModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmModalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  confirmModalCancelText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  confirmModalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: '#B20000',
    alignItems: 'center',
  },
  confirmModalConfirmBtnDisabled: {
    backgroundColor: '#ccc',
  },
  confirmModalConfirmText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  confirmModalConfirmTextDisabled: {
    color: '#999',
  },
  // 错误状态样式
  errorIconContainer: {
    marginBottom: 12,
  },
  errorIcon: {
    fontSize: 48,
  },
  errorMessage: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  retryButton: {
    backgroundColor: '#B20000',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 16,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textAlign: 'center',
  },
  // 添加按钮样式
  addChapterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  addChapterBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  addSubChapterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(178,0,0,0.08)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 6,
  },
  addSubChapterBtnText: {
    color: '#B20000',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },
  addSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginTop: 4,
  },
  addSectionBtnText: {
    color: '#B20000',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
});

export default OutlineContent;
