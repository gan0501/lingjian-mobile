/**
 * BidWriter WebSocket 统一管理 Hook
 * 集中处理所有 WebSocket 事件，避免各页面重复注册
 */
import { useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { bidWriterWs } from '@/services/bidWriter';
import { useBidWriterContext } from './BidWriterContext';
import { useAgentTaskStore } from '@/stores/useAgentTaskStore';


interface WebSocketHandlers {
  // Step 1: 解析相关
  onParseProgress?: (data: any) => void;
  onStreamChunk?: (data: any) => void;
  onParseComplete?: (data: any) => void;
  
  // Step 2: 大纲相关
  onStreamUpdate?: () => void;
  onOutlineReady?: (data: any) => void;
  onOutlineError?: (data: { error: string }) => void;
  
  // Step 3: 生成相关
  onGenerationProgress?: (data: any) => void;
  onContentProgress?: (data: any) => void;
  onSectionComplete?: (data: any) => void;
  onImageProgress?: (data: any) => void;
  onImageSearchComplete?: (data: any) => void;
  onReviewProgress?: (data: any) => void;
  onReviewComplete?: (data: any) => void;
  onGenerationComplete?: (data: any) => void;
  
  // 通用
  onConnected?: (data: any) => void;
  onError?: (data: any) => void;
}

export const useBidWriterWebSocket = (handlers: WebSocketHandlers = {}) => {
  
  const {
    bidId,
    setStatus,
    setGenerationPhase,
    setProjectOverview,
    setScoringCriteria,
    outline,
    setOutline,
    setReviewResult,
    setGeneratedContent,
    setCompletedSections,
    setCurrentSectionId,
    findChapterIdBySectionId,
    connectWebSocket,
    wsConnected,
  } = useBidWriterContext();

  // Refs for stable callbacks and chunk buffering
  const handlersRef = useRef(handlers);
  const setStatusRef = useRef(setStatus);
  const setGenerationPhaseRef = useRef(setGenerationPhase);
  const setProjectOverviewRef = useRef(setProjectOverview);
  const setScoringCriteriaRef = useRef(setScoringCriteria);
  const setOutlineRef = useRef(setOutline);
  const setReviewResultRef = useRef(setReviewResult);
  const setGeneratedContentRef = useRef(setGeneratedContent);
  const setCompletedSectionsRef = useRef(setCompletedSections);
  const setCurrentSectionIdRef = useRef(setCurrentSectionId);
  const findChapterIdBySectionIdRef = useRef(findChapterIdBySectionId);
  const chunkBufferRef = useRef<Record<string, string>>({});
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const generatingSectionIdRef = useRef<string | null>(null);
  const expandedChaptersRef = useRef<Set<string>>(new Set());
  const outlineRef = useRef<Outline | null>(null);
  const FLUSH_INTERVAL_MS = 200; // 降低到200ms，提升流式内容的实时感

  // Keep refs updated
  useEffect(() => {
    outlineRef.current = outline;
    setStatusRef.current = setStatus;
    setGenerationPhaseRef.current = setGenerationPhase;
    setProjectOverviewRef.current = setProjectOverview;
    setScoringCriteriaRef.current = setScoringCriteria;
    setOutlineRef.current = setOutline;
    setReviewResultRef.current = setReviewResult;
    setGeneratedContentRef.current = setGeneratedContent;
    setCompletedSectionsRef.current = setCompletedSections;
    setCurrentSectionIdRef.current = setCurrentSectionId;
    findChapterIdBySectionIdRef.current = findChapterIdBySectionId;
  }, [
    outline,
    setStatus,
    setGenerationPhase,
    setProjectOverview,
    setScoringCriteria,
    setOutline,
    setReviewResult,
    setGeneratedContent,
    setCompletedSections,
    setCurrentSectionId,
    findChapterIdBySectionId,
  ]);

  // Keep handlers ref updated
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // 设置 WebSocket 事件监听
  const setupEventListeners = useCallback(() => {
    // 清除该实例之前的所有监听器
    const events = [
      'connected', 'error', 'llm_error',
      'parse_progress', 'stream_chunk', 'parse_complete',
      'stream_update', 'outline_ready', 'outline_error',
      'generation_progress', 'content_progress', 'section_complete',
      'image_progress', 'review_progress', 'review_complete',
      'generation_complete', 'generation_error'
    ];
    
    events.forEach(event => {
      bidWriterWs.off(event);
    });

    // ==================== 通用事件 ====================
    
    bidWriterWs.on('connected', (data) => {
      handlersRef.current.onConnected?.(data);
    });
  
    bidWriterWs.on('error', (data) => {
      handlersRef.current.onError?.(data);
      Alert.alert('错误', data.message || '发生错误');
    });
  
    bidWriterWs.on('llm_error', (data) => {
      const error = data.error;
      const context = data.context || '处理';
      let alertTitle = `${context}失败`;
      console.warn('[BidWriter][llm_error]', data);
      const baseMessage = error?.message || 'AI服务异常，请稍后再试';
      const code = error?.code;
      const detail = error?.detail;
      let alertMessage = baseMessage;
      if (code) {
        alertMessage += `\n\n错误码: ${code}`;
      }
      if (__DEV__ && detail) {
        alertMessage += `\n\n详情: ${detail}`;
      }
      if (error?.retryable && error?.retry_after) {
        alertMessage += `\n\n建议 ${error.retry_after} 秒后重试`;
      }
      Alert.alert(alertTitle, alertMessage);
    });
  
    // ==================== Step 1: 解析相关 ====================
  
    bidWriterWs.on('parse_progress', (data) => {
      handlersRef.current.onParseProgress?.(data);
    });
  
    bidWriterWs.on('stream_chunk', (data) => {
      handlersRef.current.onStreamChunk?.(data);
    });
  
    bidWriterWs.on('parse_complete', (data) => {
      if (data.project_overview) {
        setProjectOverviewRef.current(data.project_overview);
      }
      if (data.scoring_criteria) {
        setScoringCriteriaRef.current(data.scoring_criteria);
      }
      setStatusRef.current('parsed');
      handlersRef.current.onParseComplete?.(data);
    });
  
    // ==================== Step 2: 大纲相关 ====================
  
    bidWriterWs.on('stream_update', () => {
      handlersRef.current.onStreamUpdate?.();
    });
  
    bidWriterWs.on('outline_ready', (data) => {
      if (data.outline && data.outline.chapters?.length > 0) {
        const current = outlineRef.current;
        if (!current?.chapters?.length) {
          setOutlineRef.current(data.outline);
        }
      }
      handlersRef.current.onOutlineReady?.(data);
    });
  
    bidWriterWs.on('outline_error', (data) => {
      handlersRef.current.onOutlineError?.(data);
    });

    // ==================== Step 3: 生成相关 ====================

    bidWriterWs.on('generation_progress', (data) => {
      handlersRef.current.onGenerationProgress?.(data);
      
      // 处理内嵌的事件类型
      const eventType = data.event_type || data.type;
      
      // section_chunk: 写入 buffer，不立即 setState（简化逻辑，性能优先）
      if (eventType === 'section_chunk' && data.section_id && data.chunk) {
        const sectionId = data.section_id;
        const chunkText = String(data.chunk);
        const prevBuf = chunkBufferRef.current[sectionId] || '';
        
        // 直接追加：后端已经处理了累积/增量模式，只yield增量部分
        chunkBufferRef.current[sectionId] = prevBuf + chunkText;

        // 启动定时 flush（使用requestAnimationFrame避免阻塞UI线程）
        if (!flushTimerRef.current) {
          flushTimerRef.current = setInterval(() => {
            requestAnimationFrame(() => {
              const buf = chunkBufferRef.current;
              if (Object.keys(buf).length > 0) {
                setGeneratedContentRef.current(prev => {
                  const next = { ...prev };
                  for (const sid in buf) {
                    next[sid] = buf[sid];
                  }
                  return next;
                });
              }
            });
          }, FLUSH_INTERVAL_MS);
        }
      }

      // section_start: 更新当前生成的 section
      if (eventType === 'section_start' && data.section_id) {
        generatingSectionIdRef.current = data.section_id;
        setCurrentSectionIdRef.current(data.section_id);
        const chapterId = findChapterIdBySectionIdRef.current(data.section_id);
        if (chapterId) {
          expandedChaptersRef.current.add(chapterId);
        }
      }

      // section_complete: flush buffer 并标记完成
      if (eventType === 'section_complete' && data.section_id) {
        const finalContent = data.content || chunkBufferRef.current[data.section_id] || '';
        delete chunkBufferRef.current[data.section_id];
        setGeneratedContentRef.current(prev => ({
          ...prev,
          [data.section_id]: finalContent,
        }));
        setCompletedSectionsRef.current(prev => new Set(prev).add(data.section_id));
        generatingSectionIdRef.current = null;
        setCurrentSectionIdRef.current(data.section_id);
      }

      // chapter_complete
      if (eventType === 'chapter_complete') {
        generatingSectionIdRef.current = null;
        setCurrentSectionIdRef.current(null);
        
        // 更新章节状态为 completed
        if (data.chapter_index !== undefined && outlineRef.current?.chapters) {
          setOutlineRef.current(prev => {
            if (!prev?.chapters) return prev;
            const nextChapters = [...prev.chapters];
            const chapterIndex = data.chapter_index;
            if (chapterIndex >= 0 && chapterIndex < nextChapters.length) {
              nextChapters[chapterIndex] = {
                ...nextChapters[chapterIndex],
                status: 'completed' as const
              };
            }
            return { ...prev, chapters: nextChapters };
          });
        }
      }

      // 状态更新（单调递增）
      if (data.status) {
        setStatusRef.current(prev => {
          if (prev === 'completed') return prev;
          if (prev === 'reviewing' && (data.status === 'generating' || data.status === 'searching_images')) return prev;
          if (data.status === 'reviewing') return 'reviewing';
          if (data.status === 'completed') return 'completed';
          if (data.status === 'generating' || data.status === 'searching_images') return 'generating';
          if (data.status === 'generating_outline') return 'generating_outline';
          if (data.status === 'outline_confirmed') return 'outline_confirmed';
          if (data.status === 'parsed') return 'parsed';
          return prev;
        });
      }

      {
        const phaseRaw = data.phase || data.status || data.event_type || data.type;
        const p = String(phaseRaw || '').toLowerCase();
        setGenerationPhaseRef.current(prev => {
          if (p.includes('review')) return 'review';
          if (p.includes('image') || p.includes('images') || p.includes('searching_images')) return 'image';
          if (p.includes('complete') || p.includes('completed')) return 'completed';
          if (p.includes('content') || p.includes('section') || p.includes('chapter') || p.includes('generat')) return 'content';
          return prev;
        });
      }
    });

    bidWriterWs.on('content_progress', (data) => {
      handlersRef.current.onContentProgress?.(data);
    });

    bidWriterWs.on('content_generated', (data) => {
      if (data.section_id && data.content) {
        setGeneratedContentRef.current(prev => ({
          ...prev,
          [data.section_id]: data.content,
        }));
      }
    });

    bidWriterWs.on('section_complete', (data) => {
      if (data.section_id) {
        setCompletedSectionsRef.current(prev => new Set(prev).add(data.section_id));
      }
      handlersRef.current.onSectionComplete?.(data);
    });

    bidWriterWs.on('image_progress', (data) => {
      handlersRef.current.onImageProgress?.(data);
      
      // 处理图片搜索完成事件
      if (data.type === 'image_search_complete' && data.section_id && data.images) {
        handlersRef.current.onImageSearchComplete?.(data);
      }
    });

    bidWriterWs.on('review_progress', (data) => {
      handlersRef.current.onReviewProgress?.(data);
    });

    bidWriterWs.on('review_complete', (data) => {
      if (data.result) {
        setReviewResultRef.current(data.result);
      }
      setStatusRef.current(prev => prev === 'completed' ? prev : 'completed');
      setGenerationPhaseRef.current('completed');
      handlersRef.current.onReviewComplete?.(data);
    });

    bidWriterWs.on('generation_complete', (data) => {
      // 清理 flush 定时器
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      // 最后一次 flush
      const buf = chunkBufferRef.current;
      if (Object.keys(buf).length > 0) {
        setGeneratedContentRef.current(prev => {
          const next = { ...prev };
          for (const sid in buf) {
            next[sid] = buf[sid];
          }
          return next;
        });
        chunkBufferRef.current = {};
      }
      // 更新状态为已完成
      setStatusRef.current('completed');
      setGenerationPhaseRef.current('completed');
      // 保存审稿结果
      if (data.review_result) {
        setReviewResultRef.current(data.review_result);
      }
      // 通知全局 Store：标书生成完成
      useAgentTaskStore.getState().markIdle('bid_writer');
      handlersRef.current.onGenerationComplete?.(data);
    });

    bidWriterWs.on('generation_error', (data) => {
      // 通知全局 Store：标书生成失败
      useAgentTaskStore.getState().markIdle('bid_writer');
      Alert.alert('生成错误', data.error || data.message || '生成过程中发生错误');
    });

  }, []);

  // 立即设置事件监听（不依赖bidId，确保在连接前监听器就绑定好）
  useEffect(() => {
    setupEventListeners();

    return () => {
      // 清理 flush 定时器
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      chunkBufferRef.current = {};
      
      // 清除所有事件监听器 - 完全清理
      bidWriterWs.cleanup();
    };
  }, []);

  return {
    wsConnected,
    generatingSectionIdRef,
    expandedChaptersRef,
    reconnect: () => bidId && connectWebSocket(bidId),
  };
};

export default useBidWriterWebSocket;
