/**
 * 桩基比选统一状态管理 Context
 * 管理整个桩基比选流程的共享状态
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pileComparisonWs, pileComparisonApi } from './pileComparisonApi';

type PileComparisonStatus = 'draft' | 'parsing' | 'parsed' | 'parameter_editing' | 'parameter_confirmed' | 'bearing_editing' | 'bearing_confirmed' | 'calculating' | 'completed' | 'error';

export type PileComparisonStep = 1 | 2 | 3 | 4 | 5;

export type ProfileReviewStatus = 'pending' | 'editing' | 'verified';

export type PileComparisonTabId = 'profile' | 'parameter' | 'bearing' | 'solution';

export type PileComparisonChatRole = 'user' | 'assistant';

export type PileComparisonChatMessage = {
  id: string;
  role: PileComparisonChatRole;
  content: string;
  status?: 'streaming' | 'done';
  createdAt?: number;
};

export type PileComparisonAttachment = {
  uri: string;
  name?: string;
  type?: string;
  kind?: 'profile' | 'parameters' | 'other';
};

export type ComparisonReportStatus = 'generating' | 'done' | 'failed';

export type ComparisonReportListItem = {
  id: string;
  title: string;
  status: ComparisonReportStatus;
  created_at: string;
  updated_at: string;
  error?: string;
  markdown?: string;
};

export interface PileComparisonContextValue {
  step: PileComparisonStep;
  setStep: (step: PileComparisonStep) => void;
  
  bidId: string | null;
  setBidId: (id: string | null) => void;
  status: PileComparisonStatus;
  setStatus: React.Dispatch<React.SetStateAction<PileComparisonStatus>>;
  setStatusSync: (status: PileComparisonStatus) => void;
  
  projectOverview: { 
    project_name?: string;
    hole_number?: string;
    ground_elevation?: number;
    water_level?: number;
    hole_depth?: number;
  } | null;
  setProjectOverview: React.Dispatch<React.SetStateAction<{ 
    project_name?: string;
    hole_number?: string;
    ground_elevation?: number;
    water_level?: number;
    hole_depth?: number;
  } | null>>;

  isProjectNameManuallyEdited: boolean;
  setIsProjectNameManuallyEdited: React.Dispatch<React.SetStateAction<boolean>>;
  
  soilLayers: Array<{ 
    id: string; 
    name: string; 
    index: string | null; 
    thickness: number; 
    color?: string; 
    visible?: boolean;
    top_elevation?: number;
    bottom_elevation?: number;
    inferred?: boolean;
  }>;
  setSoilLayers: React.Dispatch<React.SetStateAction<Array<{ 
    id: string; 
    name: string; 
    index: string | null; 
    thickness: number; 
    color?: string; 
    visible?: boolean;
    top_elevation?: number;
    bottom_elevation?: number;
    inferred?: boolean;
  }>>>;

  profileReviewStatus: ProfileReviewStatus;
  setProfileReviewStatus: React.Dispatch<React.SetStateAction<ProfileReviewStatus>>;
  profileVersion: number;
  setProfileVersion: React.Dispatch<React.SetStateAction<number>>;

  profilePatchCount: number;
  setProfilePatchCount: React.Dispatch<React.SetStateAction<number>>;
  incrementProfilePatchCount: (delta?: number) => void;

  profileImageUri: string | null;
  setProfileImageUri: React.Dispatch<React.SetStateAction<string | null>>;

  chatThreads: Record<PileComparisonTabId, PileComparisonChatMessage[]>;
  appendChatMessage: (tab: PileComparisonTabId, message: PileComparisonChatMessage) => void;
  updateChatMessage: (tab: PileComparisonTabId, id: string, patch: Partial<PileComparisonChatMessage>) => void;
  appendChatDelta: (tab: PileComparisonTabId, id: string, delta: string) => void;

  pileParameters: Array<{ layer: string; name?: string; side_friction_prefab?: number; end_bearing_prefab?: number; side_friction_drilled?: number; end_bearing_drilled?: number; uplift_coeff_lambda?: number }>;
  setPileParameters: React.Dispatch<React.SetStateAction<Array<{ layer: string; name?: string; side_friction_prefab?: number; end_bearing_prefab?: number; side_friction_drilled?: number; end_bearing_drilled?: number; uplift_coeff_lambda?: number }>>>;

  bearingRecommendations: Array<{ layer: string; reason?: string; compliance?: Array<string>; score?: number }>;
  setBearingRecommendations: React.Dispatch<React.SetStateAction<Array<{ layer: string; reason?: string; compliance?: Array<string>; score?: number }>>>;

  bearingAdviceMarkdown: string;
  setBearingAdviceMarkdown: React.Dispatch<React.SetStateAction<string>>;

  planResults: Array<{ pile_type: string; spec: string; length: number; design_capacity: number; unit_cost?: number; total_cost?: number; rank?: number }>;
  setPlanResults: React.Dispatch<React.SetStateAction<Array<{ pile_type: string; spec: string; length: number; design_capacity: number; unit_cost?: number; total_cost?: number; rank?: number }>>>;

  comparisonReportGenerating: boolean;
  setComparisonReportGenerating: React.Dispatch<React.SetStateAction<boolean>>;

  comparisonReportAppendixMarkdown: string;
  setComparisonReportAppendixMarkdown: React.Dispatch<React.SetStateAction<string>>;

  comparisonReports: ComparisonReportListItem[];
  setComparisonReports: React.Dispatch<React.SetStateAction<ComparisonReportListItem[]>>;
  upsertComparisonReport: (item: ComparisonReportListItem) => void;
  updateComparisonReport: (id: string, patch: Partial<ComparisonReportListItem>) => void;

  lastViewedComparisonReportsAt: string;
  markComparisonReportsViewed: () => Promise<void>;
  hasUnreadComparisonReports: boolean;
  comparisonReportGeneratingId: string;
  setComparisonReportGeneratingId: React.Dispatch<React.SetStateAction<string>>;

  attachments: PileComparisonAttachment[];
  setAttachments: React.Dispatch<React.SetStateAction<PileComparisonAttachment[]>>;

  loading: boolean;
  setLoading: (loading: boolean) => void;
  isInitializing: boolean;
  refreshComparisonReports: () => Promise<void>;
  
  wsConnected: boolean;
  connectWebSocket: (bidId: string) => Promise<void>;
  disconnectWebSocket: () => void;
  statusRef: React.MutableRefObject<PileComparisonStatus>;
  initialReportId?: string;
  initialRoute?: string;
}

const PileComparisonContext = createContext<PileComparisonContextValue | null>(null);

export const usePileComparisonContext = () => {
  const context = useContext(PileComparisonContext);
  if (!context) {
    throw new Error('usePileComparisonContext must be used within PileComparisonProvider');
  }
  return context;
};

interface PileComparisonProviderProps {
  children: ReactNode;
  initialBidId?: string;
  initialReportId?: string;
  initialStep?: PileComparisonStep;
  initialRoute?: string;
}

export const PileComparisonProvider: React.FC<PileComparisonProviderProps> = ({
  children,
  initialBidId,
  initialReportId,
  initialStep = 1,
  initialRoute = 'ReportDetail',
}) => {
  const LAST_VIEWED_REPORTS_KEY = 'pile_comparison:last_viewed_reports_at';
  const LAST_BID_ID_KEY = 'pile_comparison:last_bid_id';
  const [step, setStep] = useState<PileComparisonStep>(initialStep);
  const [bidId, setBidIdState] = useState<string | null>(initialBidId || null);
  const [status, setStatus] = useState<PileComparisonStatus>('draft');

  // 封装 setBidId，同时持久化到 AsyncStorage
  const setBidId = useCallback((newBidId: string | null) => {
    setBidIdState(newBidId);
    if (newBidId) {
      AsyncStorage.setItem(LAST_BID_ID_KEY, newBidId).catch((err) => {
        if (__DEV__) {
          console.error('[PileComparison] Failed to save bidId:', err);
        }
      });
    } else {
      AsyncStorage.removeItem(LAST_BID_ID_KEY).catch((err) => {
        if (__DEV__) {
          console.error('[PileComparison] Failed to remove bidId:', err);
        }
      });
    }
  }, []);

  const [projectOverview, setProjectOverview] = useState<{ 
    project_name?: string;
    hole_number?: string;
    ground_elevation?: number;
    water_level?: number;
    hole_depth?: number;
  } | null>(null);

  const [isProjectNameManuallyEdited, setIsProjectNameManuallyEdited] = useState(false);

  const [soilLayers, setSoilLayers] = useState<Array<{ 
    id: string; 
    name: string; 
    index: string | null; 
    thickness: number; 
    color?: string; 
    visible?: boolean;
    top_elevation?: number;
    bottom_elevation?: number;
  }>>([]);

  const [profileReviewStatus, setProfileReviewStatus] = useState<ProfileReviewStatus>('pending');
  const [profileVersion, setProfileVersion] = useState(0);
  const [profilePatchCount, setProfilePatchCount] = useState(0);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);

  const [chatThreads, setChatThreads] = useState<Record<PileComparisonTabId, PileComparisonChatMessage[]>>({
    profile: [],
    parameter: [],
    bearing: [],
    solution: [],
  });
  const [pileParameters, setPileParameters] = useState<Array<{ layer: string; name?: string; side_friction_prefab?: number; end_bearing_prefab?: number; side_friction_drilled?: number; end_bearing_drilled?: number; uplift_coeff_lambda?: number }>>([]);
  const [bearingRecommendations, setBearingRecommendations] = useState<Array<{ layer: string; reason?: string; compliance?: Array<string>; score?: number }>>([]);
  const [bearingAdviceMarkdown, setBearingAdviceMarkdown] = useState('');
  const [planResults, setPlanResults] = useState<Array<{ pile_type: string; spec: string; length: number; design_capacity: number; unit_cost?: number; total_cost?: number; rank?: number }>>([]);
  const [comparisonReportGenerating, setComparisonReportGenerating] = useState(false);
  const [comparisonReportAppendixMarkdown, setComparisonReportAppendixMarkdown] = useState('');

  const [comparisonReports, setComparisonReports] = useState<ComparisonReportListItem[]>([]);
  const [comparisonReportGeneratingId, setComparisonReportGeneratingId] = useState('');

  const [lastViewedComparisonReportsAt, setLastViewedComparisonReportsAt] = useState<string>('');

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(LAST_VIEWED_REPORTS_KEY);
        const s = String(raw || '').trim();
        setLastViewedComparisonReportsAt(s);
      } catch {
        setLastViewedComparisonReportsAt('');
      }
    })();
  }, []);

  const markComparisonReportsViewed = useCallback(async () => {
    const nowIso = new Date().toISOString();
    setLastViewedComparisonReportsAt(nowIso);
    try {
      await AsyncStorage.setItem(LAST_VIEWED_REPORTS_KEY, nowIso);
    } catch {
      // ignore
    }
  }, []);

  const hasUnreadComparisonReports = useMemo(() => {
    const ts = new Date(lastViewedComparisonReportsAt || 0).getTime();
    const baseline = Number.isFinite(ts) ? ts : 0;
    const arr = Array.isArray(comparisonReports) ? comparisonReports : [];
    return arr.some((r) => {
      const t = new Date(r.updated_at || r.created_at || 0).getTime();
      return Number.isFinite(t) && t > baseline;
    });
  }, [comparisonReports, lastViewedComparisonReportsAt]);

  const upsertComparisonReport = useCallback((item: ComparisonReportListItem) => {
    const next = item;
    setComparisonReports(prev => {
      const arr = Array.isArray(prev) ? prev : [];
      const idx = arr.findIndex(x => x.id === next.id);
      if (idx >= 0) {
        const copy = [...arr];
        copy[idx] = { ...copy[idx], ...next };
        return copy;
      }
      return [next, ...arr];
    });

    // 同步到后端
    const bidId = wsBidIdRef.current;
    console.log('[PileComparisonContext] upsertComparisonReport, bidId:', bidId, 'reportId:', next.id, 'isNew:', !comparisonReports.find(r => r.id === next.id));
    if (bidId && next.id) {
      const isNew = !comparisonReports.find(r => r.id === next.id);
      if (isNew) {
        // 创建新报告
        console.log('[PileComparisonContext] 创建新报告:', next.id);
        pileComparisonApi.createComparisonReport(bidId, {
          id: next.id,
          title: next.title || '对比报告',
          markdown: next.markdown || '',
          status: next.status || 'generating',
          error: next.error,
        }).then(res => {
          console.log('[PileComparisonContext] 创建报告成功:', res);
        }).catch(err => {
          console.error('[PileComparisonContext] 创建报告失败:', err);
        });
      } else {
        // 更新现有报告
        console.log('[PileComparisonContext] 更新报告:', next.id);
        pileComparisonApi.updateComparisonReport(bidId, next.id, {
          title: next.title,
          markdown: next.markdown,
          status: next.status,
          error: next.error,
        }).then(res => {
          console.log('[PileComparisonContext] 更新报告成功:', res);
        }).catch(err => {
          console.error('[PileComparisonContext] 更新报告失败:', err);
        });
      }
    }
  }, [comparisonReports]);

  const updateComparisonReport = useCallback((id: string, patch: Partial<ComparisonReportListItem>) => {
    const rid = String(id || '').trim();
    if (!rid) return;
    setComparisonReports(prev => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.map(x => (x.id === rid ? { ...x, ...patch } : x));
    });

    // 同步到后端
    const bidId = wsBidIdRef.current;
    if (bidId && rid) {
      pileComparisonApi.updateComparisonReport(bidId, rid, {
        title: patch.title,
        markdown: patch.markdown,
        status: patch.status,
        error: patch.error,
      }).catch(err => {
        console.error('[PileComparisonContext] 更新报告失败:', err);
      });
    }
  }, []);

  const [attachments, setAttachments] = useState<PileComparisonAttachment[]>([]);

  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const [wsConnected, setWsConnected] = useState(false);
  const wsBidIdRef = useRef<string>('');
  const statusRef = useRef<PileComparisonStatus>(status);
  
  // 同步设置状态：先更新 ref，再更新 state
  const setStatusSync = useCallback((newStatus: PileComparisonStatus) => {
    statusRef.current = newStatus;
    setStatus(newStatus);
  }, []);

  // 加载报告列表（合并策略：保留内存中尚未持久化的报告）
  const loadComparisonReports = useCallback(async (targetBidId: string) => {
    if (!targetBidId) return;
    try {
      console.log('[PileComparisonContext] loadComparisonReports, bidId:', targetBidId);
      const reports = await pileComparisonApi.getComparisonReports(targetBidId);
      console.log('[PileComparisonContext] loadComparisonReports result:', {
        isArray: Array.isArray(reports),
        length: Array.isArray(reports) ? reports.length : 'N/A',
        type: typeof reports,
        raw: JSON.stringify(reports)?.slice(0, 200),
      });
      if (Array.isArray(reports)) {
        const serverReports = reports.map(r => ({
          id: r.id,
          title: r.title,
          markdown: r.markdown,
          status: r.status as any,
          error: r.error,
          created_at: r.created_at,
          updated_at: r.updated_at,
        }));
        setComparisonReports(prev => {
          const serverIds = new Set(serverReports.map(r => r.id));
          // 保留内存中正在生成但还未持久化到服务器的报告
          const localOnly = (Array.isArray(prev) ? prev : []).filter(
            r => !serverIds.has(r.id) && r.status === 'generating'
          );
          return [...localOnly, ...serverReports];
        });
      } else {
        console.warn('[PileComparisonContext] loadComparisonReports: response is not array, got:', typeof reports);
      }
    } catch (err: any) {
      console.error('[PileComparisonContext] loadComparisonReports failed:', err);
      // 显示加载失败的提示
      const errorMsg = err?.message || '加载失败';
      Alert.alert('提示', `加载对比报告列表失败：${errorMsg}`);
    }
  }, []);

  const connectWebSocket = useCallback(async (targetBidId: string) => {
    if (!targetBidId) return;
    const nextBid = String(targetBidId || '').trim();
    if (!nextBid) return;

    // 同一 bidId 且当前已连接时不重复断开重连（避免解析过程中误触发导致丢事件）
    if (wsConnected && wsBidIdRef.current === nextBid) {
      return;
    }
    
    try {
      pileComparisonWs.disconnect();
      
      await pileComparisonWs.connect(nextBid);
      wsBidIdRef.current = nextBid;
      setWsConnected(true);
      
      // 连接成功后加载报告列表
      await loadComparisonReports(nextBid);
    } catch (err) {
      console.error('[PileComparison] WebSocket 连接失败:', err);
      wsBidIdRef.current = '';
      setWsConnected(false);
    }
  }, [wsConnected, loadComparisonReports]);

  const disconnectWebSocket = useCallback(() => {
    pileComparisonWs.disconnect();
    wsBidIdRef.current = '';
    setWsConnected(false);
  }, []);

  useEffect(() => {
    const onOpen = () => {
      setWsConnected(true);
    };
    const onClose = () => {
      wsBidIdRef.current = '';
      setWsConnected(false);
    };
    const onError = () => {
      wsBidIdRef.current = '';
      setWsConnected(false);
    };

    pileComparisonWs.onConnection('open', onOpen);
    pileComparisonWs.onConnection('close', onClose);
    pileComparisonWs.onConnection('error', onError);

    return () => {
      pileComparisonWs.offConnection('open', onOpen);
      pileComparisonWs.offConnection('close', onClose);
      pileComparisonWs.offConnection('error', onError);
      wsBidIdRef.current = '';
      setWsConnected(false);
    };
  }, []);

  // 组件挂载时从 AsyncStorage 恢复 bidId
  useEffect(() => {
    const restoreBidId = async () => {
      // 如果有 initialBidId，优先使用
      if (initialBidId) {
        setBidIdState(initialBidId);
        setIsInitializing(false);
        return;
      }
      // 否则从 AsyncStorage 恢复
      try {
        const savedBidId = await AsyncStorage.getItem(LAST_BID_ID_KEY);
        if (savedBidId) {
          setBidIdState(savedBidId);
        }
      } catch (e) {
        // 恢复失败，保持空值
      } finally {
        setIsInitializing(false);
      }
    };
    restoreBidId();
  }, [initialBidId]);

  // bidId 变化时自动加载历史数据（与鸿蒙端 loadExistingData 对齐）
  useEffect(() => {
    if (!bidId) {
      setComparisonReports([]);
      return;
    }
    setLoading(true);
    loadComparisonReports(bidId);
    // 加载文档详情（土层、参数、项目概览）
    const loadExistingData = async () => {
      try {
        const detail = await pileComparisonApi.getDocumentDetail(bidId);
        if (!detail) return;
        if (detail.layers && detail.layers.length > 0) {
          if (__DEV__) {
            console.log('[PileComparisonContext] loadExistingData - setting soilLayers:', detail.layers.length);
          }
          setSoilLayers(detail.layers.map((l, idx) => ({
            id: String(l.id ?? ''),
            name: String(l.name ?? `层${idx + 1}`),
            index: l.index !== undefined && l.index !== null && l.index !== '' ? String(l.index) : null,
            thickness: Number(l.thickness ?? 0),
            color: l.color,
            visible: l.visible ?? true,
            top_elevation: l.top_elevation,
            bottom_elevation: l.bottom_elevation,
          })));
        }
        if (detail.parameters && detail.parameters.length > 0) {
          setPileParameters(detail.parameters);
        }
        if (detail.project_overview) {
          const p = detail.project_overview;
          const hasData = p.hole_number !== undefined || p.ground_elevation !== undefined ||
                         p.hole_depth !== undefined || p.water_level !== undefined;
          if (hasData) {
            setProjectOverview(p);
          }
        }
        if (detail.profile_version !== undefined) {
          setProfileVersion(detail.profile_version);
        }
        // 恢复持力层推荐方案和初步建议
        if (Array.isArray((detail as any).bearing_recommendations) && (detail as any).bearing_recommendations.length > 0) {
          setBearingRecommendations((detail as any).bearing_recommendations);
        }
        if (typeof (detail as any).bearing_advice_markdown === 'string' && (detail as any).bearing_advice_markdown.trim()) {
          setBearingAdviceMarkdown((detail as any).bearing_advice_markdown);
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[PileComparison] 加载历史数据失败:', err);
        }
      } finally {
        setLoading(false);
      }
    };
    loadExistingData();
  }, [bidId, loadComparisonReports]);

  const value: PileComparisonContextValue = {
    step,
    setStep,
    bidId,
    setBidId,
    status,
    setStatus,
    projectOverview,
    setProjectOverview,
    isProjectNameManuallyEdited,
    setIsProjectNameManuallyEdited,
    soilLayers,
    setSoilLayers,
    profileReviewStatus,
    setProfileReviewStatus,
    profileVersion,
    setProfileVersion,

    profilePatchCount,
    setProfilePatchCount,
    incrementProfilePatchCount: (delta = 1) => {
      const d = Number(delta || 0);
      if (!d) return;
      setProfilePatchCount(prev => prev + d);
    },

    chatThreads,
    appendChatMessage: (tab, message) => {
      setChatThreads(prev => ({
        ...prev,
        [tab]: [...(prev[tab] || []), message],
      }));
    },
    updateChatMessage: (tab, id, patch) => {
      setChatThreads(prev => ({
        ...prev,
        [tab]: (prev[tab] || []).map(m => (m.id === id ? { ...m, ...patch } : m)),
      }));
    },
    appendChatDelta: (tab, id, delta) => {
      const safeDelta = String(delta || '');
      if (!safeDelta) return;
      setChatThreads(prev => ({
        ...prev,
        [tab]: (prev[tab] || []).map(m => (m.id === id ? { ...m, content: `${m.content || ''}${safeDelta}` } : m)),
      }));
    },

    pileParameters,
    setPileParameters,
    bearingRecommendations,
    setBearingRecommendations,
    bearingAdviceMarkdown,
    setBearingAdviceMarkdown,
    planResults,
    setPlanResults,
    comparisonReportGenerating,
    setComparisonReportGenerating,
    comparisonReportAppendixMarkdown,
    setComparisonReportAppendixMarkdown,

    comparisonReports,
    setComparisonReports,
    upsertComparisonReport,
    updateComparisonReport,
    lastViewedComparisonReportsAt,
    markComparisonReportsViewed,
    hasUnreadComparisonReports,
    comparisonReportGeneratingId,
    setComparisonReportGeneratingId,
    attachments,
    setAttachments,
    loading,
    setLoading,
    isInitializing,
    refreshComparisonReports: async () => {
      if (bidId) await loadComparisonReports(bidId);
    },
    wsConnected,
    connectWebSocket,
    disconnectWebSocket,
    statusRef,
    setStatusSync,
    initialReportId,
    initialRoute,
  };

  return (
    <PileComparisonContext.Provider value={value}>
      {children}
    </PileComparisonContext.Provider>
  );
};

export default PileComparisonContext;
