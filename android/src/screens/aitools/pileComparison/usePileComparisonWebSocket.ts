/**
 * PileComparison WebSocket 统一管理 Hook
 * 集中处理所有 WebSocket 事件
 */
import { useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { usePileComparisonContext } from './PileComparisonContext';
import { pileComparisonWs } from './pileComparisonApi';
import { foregroundService } from '@/services/foregroundService';
import { isLikelyFullComparisonReport } from './utils/reportValidation';
import { showTokenToast } from '@/components/TokenToast';
import { useAgentTaskStore } from '@/stores/useAgentTaskStore';

// 为每个 hook 实例分配唯一 ID
let instanceCounter = 0;

interface WebSocketHandlers {
  // 剖面解析相关
  onParseProgress?: (data: any) => void;
  onParseComplete?: (data: any) => void;
  
  // 参数识别相关
  onParametersExtractProgress?: (data: any) => void;
  onParametersExtractComplete?: (data: any) => void;
  
  // 持力层推荐相关
  onBearingRecommendation?: (data: any) => void;
  
  // 方案计算相关
  onCalculationProgress?: (data: any) => void;
  onCalculationComplete?: (data: any) => void;
  
  // 通用
  onConnected?: (data: any) => void;
  onError?: (data: any) => void;
}

export const usePileComparisonWebSocket = (handlers: WebSocketHandlers = {}) => {
  const instanceId = useRef(`instance_${++instanceCounter}`).current;
  const listenersRef = useRef<Array<{ event: string; cb: (data: any) => void }>>([]);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const lastReconnectAtRef = useRef(0);
  const reportTimeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const devLog = (...args: any[]) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  };

  // 新版 UX：报告后台生成，不再流式输出
  
  const {
    bidId,
    status,
    setStatus,
    setProjectOverview,
    isProjectNameManuallyEdited,
    setSoilLayers,
    setPileParameters,
    setBearingRecommendations,
    setBearingAdviceMarkdown,
    setPlanResults,
    setProfileReviewStatus,
    setProfileVersion,
    setProfilePatchCount,
    updateChatMessage,
    appendChatDelta,
    setComparisonReportGenerating,
    comparisonReportAppendixMarkdown,
    comparisonReportGeneratingId,
    setComparisonReportGeneratingId,
    updateComparisonReport,
    connectWebSocket,
    wsConnected,
    statusRef,
  } = usePileComparisonContext();

  const bidIdRef = useRef(String(bidId || '').trim());

  // Refs for stable callbacks
  const handlersRef = useRef(handlers);
  const setStatusRef = useRef(setStatus);
  const setProjectOverviewRef = useRef(setProjectOverview);
  const isProjectNameManuallyEditedRef = useRef(isProjectNameManuallyEdited);
  const setSoilLayersRef = useRef(setSoilLayers);
  const setPileParametersRef = useRef(setPileParameters);
  const setBearingRecommendationsRef = useRef(setBearingRecommendations);
  const setBearingAdviceMarkdownRef = useRef(setBearingAdviceMarkdown);
  const setPlanResultsRef = useRef(setPlanResults);
  const setProfileReviewStatusRef = useRef(setProfileReviewStatus);
  const setProfileVersionRef = useRef(setProfileVersion);
  const setProfilePatchCountRef = useRef(setProfilePatchCount);
  const updateChatMessageRef = useRef(updateChatMessage);
  const appendChatDeltaRef = useRef(appendChatDelta);
  const setComparisonReportGeneratingRef = useRef(setComparisonReportGenerating);
  const comparisonReportAppendixMarkdownRef = useRef(comparisonReportAppendixMarkdown);

  const comparisonReportGeneratingIdRef = useRef<string>('');
  const reportFgStageRef = useRef<0 | 1 | 2>(0);
  const setComparisonReportGeneratingIdRef = useRef(setComparisonReportGeneratingId);
  const updateComparisonReportRef = useRef(updateComparisonReport);

  // Keep refs updated
  useEffect(() => {
    setStatusRef.current = setStatus;
    setProjectOverviewRef.current = setProjectOverview;
    isProjectNameManuallyEditedRef.current = isProjectNameManuallyEdited;
    setSoilLayersRef.current = setSoilLayers;
    setPileParametersRef.current = setPileParameters;
    setBearingRecommendationsRef.current = setBearingRecommendations;
    setBearingAdviceMarkdownRef.current = setBearingAdviceMarkdown;
    setPlanResultsRef.current = setPlanResults;
  }, [
    setStatus,
    setProjectOverview,
    isProjectNameManuallyEdited,
    setSoilLayers,
    setPileParameters,
    setBearingRecommendations,
    setBearingAdviceMarkdown,
    setPlanResults,
    setProfileReviewStatus,
    setProfileVersion,
  ]);

  useEffect(() => {
    bidIdRef.current = String(bidId || '').trim();
  }, [bidId]);

  useEffect(() => {
    setProfileReviewStatusRef.current = setProfileReviewStatus;
    setProfileVersionRef.current = setProfileVersion;
    setProfilePatchCountRef.current = setProfilePatchCount;
    updateChatMessageRef.current = updateChatMessage;
    appendChatDeltaRef.current = appendChatDelta;
  }, [
    setProfileReviewStatus,
    setProfileVersion,
    setProfilePatchCount,
    updateChatMessage,
    appendChatDelta,
  ]);

  useEffect(() => {
    setComparisonReportGeneratingRef.current = setComparisonReportGenerating;
    comparisonReportAppendixMarkdownRef.current = comparisonReportAppendixMarkdown;
    comparisonReportGeneratingIdRef.current = String(comparisonReportGeneratingId || '').trim();
    reportFgStageRef.current = 0;
  }, [
    setComparisonReportGenerating,
    comparisonReportAppendixMarkdown,
    comparisonReportGeneratingId,
    setComparisonReportGeneratingId,
    updateComparisonReport,
  ]);

  useEffect(() => {
    if (reportTimeoutTimerRef.current) {
      clearTimeout(reportTimeoutTimerRef.current);
      reportTimeoutTimerRef.current = null;
    }

    const rid = String(comparisonReportGeneratingId || '').trim();
    if (!rid) return;

    // 报告生成兜底：避免 WS 断开/消息丢失导致“报告生成中...”无限等待
    const timeoutMs = 15 * 60 * 1000;
    reportTimeoutTimerRef.current = setTimeout(() => {
      const curRid = String(comparisonReportGeneratingIdRef.current || '').trim();
      if (!curRid || curRid !== rid) return;

      reportFgStageRef.current = 0;
      setComparisonReportGeneratingRef.current(false);
      setComparisonReportGeneratingIdRef.current('');
      updateComparisonReportRef.current(rid, {
        status: 'failed',
        updated_at: new Date().toISOString(),
        error: '生成超时（未收到完成回传）',
      } as any);
      updateChatMessageRef.current('solution' as any, rid, {
        content: '生成超时：未收到完成回传，请检查网络后重试。',
        status: 'done',
      } as any);
      void foregroundService.failService('对比报告生成超时：未收到完成回传');
      Alert.alert('提示', '对比报告生成超时：未收到完成回传。请检查网络后重试。');
    }, timeoutMs);

    return () => {
      if (reportTimeoutTimerRef.current) {
        clearTimeout(reportTimeoutTimerRef.current);
        reportTimeoutTimerRef.current = null;
      }
    };
  }, [comparisonReportGeneratingId]);

  useEffect(() => {
    comparisonReportAppendixMarkdownRef.current = comparisonReportAppendixMarkdown;
  }, [comparisonReportAppendixMarkdown]);

  // Keep handlers ref updated
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // 设置 WebSocket 事件监听
  const setupEventListeners = useCallback(() => {
    // 先移除当前 hook 实例之前注册过的监听（只移除自己的，不影响其它模块）
    listenersRef.current.forEach(({ event, cb }) => {
      pileComparisonWs.off(event, cb);
    });
    listenersRef.current = [];

    const on = (event: string, cb: (data: any) => void) => {
      pileComparisonWs.on(event, cb);
      listenersRef.current.push({ event, cb });
    };

    // ==================== 通用事件 ====================

    on('connected', (data) => {
      handlersRef.current.onConnected?.(data);
    });

    on('error', (data) => {
      handlersRef.current.onError?.(data);
      const rid = String(comparisonReportGeneratingIdRef.current || '').trim();
      if (rid) {
        reportFgStageRef.current = 0;
        void foregroundService.failService(String((data as any)?.message || '对比报告生成失败'));
        setComparisonReportGeneratingRef.current(false);
        setComparisonReportGeneratingIdRef.current('');
        updateComparisonReportRef.current(rid, {
          status: 'failed',
          updated_at: new Date().toISOString(),
          error: String((data as any)?.message || 'ws error'),
        } as any);
      }
      Alert.alert('错误', data.message || '发生错误');
    });

    on('llm_error', (data) => {
      const error = data.error;
      const context = data.context || '处理';
      let alertTitle = `${context}失败`;
      console.warn('[PileComparison][llm_error]', data);
      const baseMessage = error?.message || 'AI服务异常，请稍后再试';
      const code = error?.code;
      const detail = error?.detail;
      let alertMessage = baseMessage;
      if (code) {
        alertMessage += `\n\n错误码: ${code}`;
      }

      if (typeof (data as any).bearing_advice_markdown === 'string') {
        setBearingAdviceMarkdownRef.current((data as any).bearing_advice_markdown);
      }
      if (__DEV__ && detail) {
        alertMessage += `\n\n详情: ${detail}`;
      }
      if (error?.retryable && error?.retry_after) {
        alertMessage += `\n\n建议 ${error.retry_after} 秒后重试`;
      }
      Alert.alert(alertTitle, alertMessage);
    });

    // 剖面解析错误
    on('parse_error', (data) => {
      console.warn('[PileComparison][parse_error]', data);
      const message = data.message || '剖面识别失败';
      Alert.alert('识别失败', message);
      // 重置解析状态
      setStatusRef.current('error');
      // 通知全局 Store
      useAgentTaskStore.getState().markIdle('pile_compare');
    });

    // ==================== 剖面解析相关 ====================
  
    on('parse_progress', (data) => {
      devLog('[PileComparison][WS] parse_progress', {
        message: data?.message,
        progress: data?.progress,
      });
      handlersRef.current.onParseProgress?.(data);
    });
  
    on('parse_complete', (data) => {
      devLog('[PileComparison][WS] parse_complete', {
        hasError: !!data?.error,
        soilLayersCount: Array.isArray((data as any)?.soil_layers) ? (data as any).soil_layers.length : 0,
        errorMessage: data?.error?.message,
      });
      if (data.error) {
        setStatusRef.current('draft');
        setProjectOverviewRef.current(null as any);
        setSoilLayersRef.current([] as any);
        setProfileReviewStatusRef.current('pending');
        setProfileVersionRef.current(0 as any);
        setProfilePatchCountRef.current(0 as any);
        Alert.alert('解析失败', data.error?.message || '文件解析失败，请重新上传');
        handlersRef.current.onParseComplete?.(data);
        return;
      }
      setStatusRef.current('parsed');
      if (data.project_overview) {
        // 如果用户未手动编辑标题且识别出孔号，自动设置标题为"桩基比选"
        const holeNumber = data.project_overview.hole_number;
        if (!isProjectNameManuallyEditedRef.current && holeNumber) {
          setProjectOverviewRef.current({
            ...data.project_overview,
            project_name: '桩基比选'
          });
        } else {
          setProjectOverviewRef.current(data.project_overview);
        }
      }
      if (data.soil_layers) {
        const layers = (data.soil_layers || []).map((l: any, idx: number) => ({
          id: String(l.id ?? ''),
          name: String(l.name ?? `层${idx+1}`),
          index: l.index !== undefined && l.index !== null && l.index !== '' ? String(l.index) : null,
          thickness: Number(l.thickness ?? 0),
          color: l.color ?? undefined,
          visible: true,
          top_elevation: l.top_elevation,
          bottom_elevation: l.bottom_elevation,
          inferred: l.inferred ?? false,
        }));
        devLog('[PileComparison] soil_layers mapped:', { count: layers.length });
        if (__DEV__) {
          console.log('[usePileComparisonWebSocket] parse_complete - setting soilLayers:', layers.length);
        }
        setSoilLayersRef.current(layers);
      }

      // 重新上传解析完成后，强制重置为 pending 状态，让用户重新确认
      setProfileReviewStatusRef.current('pending');
      if (typeof data.profile_version === 'number') {
        setProfileVersionRef.current(data.profile_version);
      } else {
        setProfileVersionRef.current(0);
      }

      setProfilePatchCountRef.current(0);

      if (typeof data.bearing_advice_markdown === 'string') {
        setBearingAdviceMarkdownRef.current(data.bearing_advice_markdown);
      }

      handlersRef.current.onParseComplete?.(data);

      // 通知全局 Store：剖面解析完成
      useAgentTaskStore.getState().markIdle('pile_compare');

      // 显示 Token 消耗轻提示 — 剖面识别
      {
        const tokensUsed = data.tokens_used || (15000 + (Array.isArray(data.soil_layers) ? data.soil_layers.length : 0) * 500);
        showTokenToast({ stepName: '剖面识别', tokensUsed });
      }
    });

    on('profile_patch_applied', (data) => {
      if (data.soil_layers) {
        const layers = (data.soil_layers || []).map((l: any, idx: number) => ({
          id: String(l.id ?? ''),
          name: String(l.name ?? `层${idx+1}`),
          index: l.index !== undefined && l.index !== null && l.index !== '' ? l.index : null,
          thickness: Number(l.thickness ?? 0),
          color: l.color ?? undefined,
          visible: l.visible !== false,
          top_elevation: l.top_elevation,
          bottom_elevation: l.bottom_elevation,
        }));
        setSoilLayersRef.current(layers);
      }
      // 不更新 profileReviewStatus，保持当前状态让用户重新确认
      // if (data.profile_review_status) {
      //   setProfileReviewStatusRef.current(data.profile_review_status);
      // }
      if (typeof data.profile_version === 'number') {
        setProfileVersionRef.current(data.profile_version);
      }
    });

    on('profile_verified', (data) => {
      setProfileReviewStatusRef.current('verified');
      if (typeof data.profile_version === 'number') {
        setProfileVersionRef.current(data.profile_version);
      }
      setProfilePatchCountRef.current(0);
    });

    on('hole_info_updated', (data) => {
      if (data.project_overview) {
        setProjectOverviewRef.current(data.project_overview);
      } else if (data.hole_info) {
        setProjectOverviewRef.current(data.hole_info);
      }
    });

    // ==================== 对话（流式） ====================

    const getTabFromRequestId = (rid: any) => {
      const s = String(rid || '');
      const tab = s.split('|')[0];
      if (tab === 'profile' || tab === 'parameter' || tab === 'bearing' || tab === 'solution') return tab;
      return 'profile';
    };

    on('chat_delta', (data) => {
      const requestId = String(data.request_id || '');
      if (!requestId) return;
      const tab = getTabFromRequestId(requestId);
      const delta = String(data.delta || '');

      // 对比报告：后台生成，不做任何流式 setState（避免回前台/打开报告时卡顿）
      if (tab === 'solution' && requestId.includes('gen_plan_advice')) {
        const rid = String(requestId || '').trim();
        if (rid && comparisonReportGeneratingIdRef.current === rid && reportFgStageRef.current < 1) {
          reportFgStageRef.current = 1;
          void foregroundService.updateProgress(1, 4);
        }
        return;
      }

      appendChatDeltaRef.current(tab as any, requestId, delta);
    });

    on('chat_done', (data) => {
      const requestId = String(data.request_id || '');
      if (!requestId) return;
      const tab = getTabFromRequestId(requestId);
      const finalText = String(data.assistant_message || '');
      devLog('[PileComparison][WS] chat_done', { requestId, tab, len: finalText.length, opsLen: (data.ops || []).length });
      const isReport = tab === 'solution' && requestId.includes('gen_plan_advice');
      const appendix = isReport ? String(comparisonReportAppendixMarkdownRef.current || '').trim() : '';

      if (isReport && !isLikelyFullComparisonReport(finalText)) {
        const rid = String(requestId || '').trim();
        reportFgStageRef.current = 0;
        setComparisonReportGeneratingRef.current(false);
        if (rid && comparisonReportGeneratingIdRef.current === rid) {
          setComparisonReportGeneratingIdRef.current('');
        }
        updateComparisonReportRef.current(rid, {
          status: 'failed',
          updated_at: new Date().toISOString(),
          error: '报告正文缺失或格式不完整',
        } as any);
        void foregroundService.failService('对比报告生成失败：报告正文缺失或格式不完整');
        Alert.alert('提示', '对比报告生成失败：未生成完整正文（只返回了确认语/附录等）。请重试。');
        return;
      }

      const combined = appendix ? `${String(finalText || '').trim()}\n\n${appendix}\n` : finalText;

      updateChatMessageRef.current(tab as any, requestId, { content: combined, status: 'done' } as any);

      if (isReport) {
        const rid = String(requestId || '').trim();
        if (rid && comparisonReportGeneratingIdRef.current === rid && reportFgStageRef.current < 2) {
          reportFgStageRef.current = 2;
          void foregroundService.updateProgress(2, 4);
        }

        setComparisonReportGeneratingRef.current(false);

        updateComparisonReportRef.current(rid, {
          status: 'done',
          updated_at: new Date().toISOString(),
          markdown: combined,
        } as any);

        if (rid && comparisonReportGeneratingIdRef.current === rid) {
          void foregroundService.completeService(combined.length);
        }

        if (comparisonReportGeneratingIdRef.current === rid) {
          setComparisonReportGeneratingIdRef.current('');
        }

        // 通知全局 Store：对比报告生成完成
        useAgentTaskStore.getState().markIdle('pile_compare');

        // 显示 Token 消耗轻提示 — 对比报告
        {
          const reportLen = combined.length;
          const estimatedTokens = data.tokens_used || Math.round((5000 + reportLen) * 1.5);
          showTokenToast({ stepName: '对比报告', tokensUsed: estimatedTokens });
        }
      }
    });

    // ==================== 参数识别相关 ====================
  
    on('parameters_extract_progress', (data) => {
      handlersRef.current.onParametersExtractProgress?.(data);
    });

    on('parameters_extract_complete', (data) => {
      if (data.parameters) {
        setPileParametersRef.current(data.parameters);
      }
      handlersRef.current.onParametersExtractComplete?.(data);

      // 显示 Token 消耗轻提示 — 参数识别
      {
        const paramLen = JSON.stringify(data.parameters || []).length;
        const estimatedTokens = data.tokens_used || Math.round((5000 + paramLen) * 1.5);
        showTokenToast({ stepName: '参数识别', tokensUsed: estimatedTokens });
      }
    });

    on('parameters_extract_error', (data) => {
      console.error('[PileComparison][WS] parameters_extract_error:', data);
      handlersRef.current.onParametersExtractComplete?.({ error: true, message: data.message || '参数识别失败' });
      Alert.alert('识别失败', data.message || '参数识别失败，请重新上传');
    });

    // ==================== 持力层推荐相关 ====================
  
    on('bearing_recommendation', (data) => {
      if (data.recommendations) {
        setBearingRecommendationsRef.current(data.recommendations);
      }
      handlersRef.current.onBearingRecommendation?.(data);
    });

    on('bearing_advice_ready', (data) => {
      if (typeof data.advice_markdown === 'string') {
        setBearingAdviceMarkdownRef.current(data.advice_markdown);
      }
      if (data.recommendations) {
        setBearingRecommendationsRef.current(data.recommendations);
      }

      // 显示 Token 消耗轻提示 — 持力层推荐
      {
        const tokensUsed = data.tokens_used || Math.round((3000 + JSON.stringify(data.recommendations || []).length) * 1.5);
        showTokenToast({ stepName: '持力层推荐', tokensUsed });
      }
    });

    // ==================== 方案计算相关 ====================

    on('calculation_progress', (data) => {
      handlersRef.current.onCalculationProgress?.(data);
    });

    on('calculation_complete', (data) => {
      if (data.results) {
        setPlanResultsRef.current(data.results);
      }
      setStatusRef.current('completed');
      handlersRef.current.onCalculationComplete?.(data);
    });

  }, []);

  // 立即设置事件监听（不依赖bidId，确保在连接前监听器就绑定好）
  useEffect(() => {
    setupEventListeners();

    const scheduleReconnectIfParsing = (reason: string) => {
      const curBid = String(bidIdRef.current || '').trim();
      if (!curBid) return;

      // 兜底重连：剖面解析阶段 + 对比报告生成阶段
      const isParsing = String(statusRef.current || '') === 'parsing';
      const isReportGenerating = !!String(comparisonReportGeneratingIdRef.current || '').trim();
      if (!isParsing && !isReportGenerating) return;

      // 只有剖面解析阶段才做兜底重连，避免其它阶段误重连干扰
      // 这里用 context 的 status（通过 setStatusRef 写入）来判断，最稳妥是直接读全局状态；
      // 当前 hook 内没有直接拿到 status，所以通过 wsConnected + 外部状态机约定：解析时会主动 connectWebSocket。
      // 因此这里采用“断开且 bidId 存在 -> 有限次数重连”策略。
      const now = Date.now();
      if (now - lastReconnectAtRef.current < 1500) return;
      lastReconnectAtRef.current = now;

      // 最多重连2次,超过则弹窗提示
      if (reconnectAttemptRef.current >= 2) {
        devLog('[PileComparison][WS] reconnect failed after 2 attempts, showing alert');
        Alert.alert(
          '连接异常',
          'WebSocket连接失败,请检查网络后重新上传',
          [
            { text: '取消', style: 'cancel' },
            { text: '重新上传', onPress: () => {
              // 重置状态,让用户可以重新上传
              setStatus('draft');
              reconnectAttemptRef.current = 0;
            }}
          ]
        );
        return;
      }
      if (reconnectTimerRef.current) return;

      const attempt = reconnectAttemptRef.current + 1;
      reconnectAttemptRef.current = attempt;
      const delay = attempt === 1 ? 800 : 1500;

      devLog(`[PileComparison][WS] schedule reconnect (${reason})`, { instanceId, curBid, attempt, delay });

      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        void connectWebSocket(curBid);
      }, delay);
    };

    const onClose = () => {
      devLog('[PileComparison][WS] connection closed');
      scheduleReconnectIfParsing('close');
    };
    const onError = () => {
      devLog('[PileComparison][WS] connection error');
      scheduleReconnectIfParsing('error');
    };
    const onOpen = () => {
      devLog('[PileComparison][WS] connection opened');
      reconnectAttemptRef.current = 0;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    pileComparisonWs.onConnection('open', onOpen);
    pileComparisonWs.onConnection('close', onClose);
    pileComparisonWs.onConnection('error', onError);

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (reportTimeoutTimerRef.current) {
        clearTimeout(reportTimeoutTimerRef.current);
        reportTimeoutTimerRef.current = null;
      }
      reconnectAttemptRef.current = 0;

      pileComparisonWs.offConnection('open', onOpen);
      pileComparisonWs.offConnection('close', onClose);
      pileComparisonWs.offConnection('error', onError);

      listenersRef.current.forEach(({ event, cb }) => {
        pileComparisonWs.off(event, cb);
      });
      listenersRef.current = [];

      pileComparisonWs.disconnect();
    };
  }, []);

  return {
    wsConnected,
    reconnect: () => bidId && connectWebSocket(bidId),
  };
};

export default usePileComparisonWebSocket;
