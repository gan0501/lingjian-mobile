/**
 * BidWriter 统一状态管理 Context
 * 管理整个标书编写流程的共享状态
 */
import React, { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import { bidWriterApi, bidWriterWs } from '@/services/bidWriter';
import type { 
  BidStatus, 
  Outline, 
  ProjectOverview, 
  ScoringCriteria, 
  ReviewResult,
  Chapter,
  SubChapter,
  Section,
} from '@/services/bidWriter';
import { useBidWriterStore } from '@/stores/useBidWriterStore';
import { useAuthStore } from '@/stores';
import {
  AI_MODELS as BID_WRITER_AI_MODELS,
} from '@/constants/bidWriter';

// ==================== Types ====================

export type BidWriterStep = 1 | 2 | 3;

export interface BidWriterContextValue {
  // 当前步骤
  step: BidWriterStep;
  setStep: (step: BidWriterStep) => void;
  
  // 标书基本信息
  bidId: string | null;
  setBidId: (id: string | null) => void;
  status: BidStatus;
  setStatus: React.Dispatch<React.SetStateAction<BidStatus>>;
  
  // 上传/解析状态（用于按钮状态判断）
  uploading: boolean;
  setUploading: (uploading: boolean) => void;
  analyzing: boolean;
  setAnalyzing: (analyzing: boolean) => void;
  
  // 数据
  projectOverview: ProjectOverview | null;
  setProjectOverview: (overview: ProjectOverview | null) => void;
  scoringCriteria: ScoringCriteria | null;
  setScoringCriteria: (criteria: ScoringCriteria | null) => void;
  outline: Outline | null;
  setOutline: (outline: Outline | null) => void;
  reviewResult: ReviewResult | null;
  setReviewResult: (result: ReviewResult | null) => void;
  
  // 生成相关
  generatedContent: Record<string, string>;
  setGeneratedContent: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  completedSections: Set<string>;
  setCompletedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  currentSectionId: string | null;
  setCurrentSectionId: (id: string | null) => void;

  generationPhase: 'content' | 'image' | 'review' | 'completed';
  setGenerationPhase: React.Dispatch<
    React.SetStateAction<'content' | 'image' | 'review' | 'completed'>
  >;
  
  // 加载状态
  loading: boolean;
  setLoading: (loading: boolean) => void;
  
  // WebSocket 相关
  wsConnected: boolean;
  connectWebSocket: (bidId: string) => Promise<void>;
  disconnectWebSocket: () => void;
  
  // 配置相关
  loadUserConfig: () => Promise<void>;
  saveUserConfig: (updates: Partial<UserConfigUpdates>) => Promise<void>;
  
  // 工具函数
  findChapterIdBySectionId: (sectionId: string) => string | null;
  initGeneratedStateFromOutline: (outlineData: Outline | null) => void;
  
  // 主按钮回调
  mainButtonAction: (() => void) | null;
  setMainButtonAction: (action: (() => void) | null) => void;
  
  // 导出状态
  exporting: boolean;
  setExporting: (exporting: boolean) => void;
  
  // Step3 视图模式
  viewMode: 'directory' | 'content';
  setViewMode: (mode: 'directory' | 'content') => void;
  toggleViewMode: () => void;
}

interface UserConfigUpdates {
  model_provider: string;
  model_code: string;
  default_word_count: number;
  default_dark_bid_mode: boolean;
  auto_web_image: boolean;
  generate_flowchart: boolean;
  auto_proofread: boolean;
  default_cover_style: string;
  default_layout_style: string;
  default_color_scheme: string;
}

// ==================== Context ====================

const BidWriterContext = createContext<BidWriterContextValue | null>(null);

export const useBidWriterContext = () => {
  const context = useContext(BidWriterContext);
  if (!context) {
    throw new Error('useBidWriterContext must be used within BidWriterProvider');
  }
  return context;
};

// ==================== Provider ====================

interface BidWriterProviderProps {
  children: ReactNode;
  initialBidId?: string;
  initialStep?: BidWriterStep;
}

export const BidWriterProvider: React.FC<BidWriterProviderProps> = ({
  children,
  initialBidId,
  initialStep = 1,
}) => {
  const { user } = useAuthStore();
  const {
    setSelectedModel,
    setWordCount,
    setDarkBidMode,
    setAutoWebImage,
    setGenerateFlowchart,
    setAutoProofread,
    setSelectedCover,
    setSelectedLayout,
    setSelectedColor,
  } = useBidWriterStore();

  // 步骤状态
  const [step, setStep] = useState<BidWriterStep>(initialStep);
  
  // 标书基本信息
  const [bidId, setBidId] = useState<string | null>(initialBidId || null);
  const [status, setStatus] = useState<BidStatus>('draft');
  
  // 上传/解析状态
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  
  // 数据状态
  const [projectOverview, setProjectOverview] = useState<ProjectOverview | null>(null);
  const [scoringCriteria, setScoringCriteria] = useState<ScoringCriteria | null>(null);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  
  // 生成相关状态
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set());
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  const [generationPhase, setGenerationPhase] = useState<'content' | 'image' | 'review' | 'completed'>('content');
  
  // 加载状态
  const [loading, setLoading] = useState(false);
  
  // 主按钮回调
  const [mainButtonAction, setMainButtonAction] = useState<(() => void) | null>(null);
  
  // 导出状态
  const [exporting, setExporting] = useState(false);
  
  // Step3 视图模式（保留Context接口兼容性）
  const [viewMode, setViewMode] = useState<'directory' | 'content'>('directory');
  const toggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'directory' ? 'content' : 'directory');
  }, []);

  useEffect(() => {
    setGenerationPhase('content');
  }, [bidId]);
  
  // WebSocket 状态
  const [wsConnected, setWsConnected] = useState(false);
  const outlineRef = useRef<Outline | null>(null);

  useEffect(() => {
    const handleOpen = () => setWsConnected(true);
    const handleClose = () => setWsConnected(false);
    const handleError = () => setWsConnected(false);

    bidWriterWs.onConnection('open', handleOpen);
    bidWriterWs.onConnection('close', handleClose);
    bidWriterWs.onConnection('error', handleError);

    return () => {
      bidWriterWs.offConnection('open', handleOpen);
      bidWriterWs.offConnection('close', handleClose);
      bidWriterWs.offConnection('error', handleError);
    };
  }, []);

  // 保持 outlineRef 同步
  useEffect(() => {
    outlineRef.current = outline;
  }, [outline]);

  // 加载用户配置
  useEffect(() => {
    loadUserConfig();
  }, [loadUserConfig]);

  // 工具函数：通过 sectionId 查找 chapterId
  const findChapterIdBySectionId = useCallback((sectionId: string): string | null => {
    const outlineData = outlineRef.current;
    if (!outlineData?.chapters?.length) return null;
    for (const ch of outlineData.chapters) {
      for (const sub of ch.sub_chapters || []) {
        for (const sec of sub.sections || []) {
          if (sec.id === sectionId) return ch.id;
        }
      }
    }
    return null;
  }, []);

  // 从大纲初始化生成状态（用于重进页面时恢复已完成的内容）
  const initGeneratedStateFromOutline = useCallback((outlineData: Outline | null) => {
    if (!outlineData?.chapters?.length) return;

    const nextContent: Record<string, string> = {};
    const nextCompleted = new Set<string>();

    for (const ch of outlineData.chapters) {
      for (const sub of ch.sub_chapters || []) {
        for (const sec of sub.sections || []) {
          if (sec?.content && String(sec.content).trim().length > 0) {
            nextContent[sec.id] = String(sec.content);
            nextCompleted.add(sec.id);
          }
        }
      }
    }

    if (Object.keys(nextContent).length > 0) {
      setGeneratedContent(nextContent);
      setCompletedSections(nextCompleted);
    }
  }, []);

  // WebSocket 连接
  const connectWebSocket = useCallback(async (targetBidId: string) => {
    if (!targetBidId) return;
    
    try {
      // 先清除旧的回调（避免累积）
      bidWriterWs.disconnect();
      
      await bidWriterWs.connect(targetBidId);
      setWsConnected(true);
    } catch (err) {
      console.error('[BidWriter] WebSocket 连接失败:', err);
      setWsConnected(false);
    }
  }, []);

  // WebSocket 断开
  const disconnectWebSocket = useCallback(() => {
    bidWriterWs.disconnect();
    setWsConnected(false);
  }, []);

  // 加载用户配置
  const loadUserConfig = useCallback(async () => {
    if (!user?.id) return;

    try {
      const config = await bidWriterApi.getConfig(user.id);

      const model = BID_WRITER_AI_MODELS.find(
        m => m.provider === config.model_provider && m.code === config.model_code
      );
      if (model) {
        setSelectedModel(model.id);
      }
      setWordCount(config.default_word_count || 30000);
      setDarkBidMode(config.default_dark_bid_mode || false);
      setAutoWebImage(config.auto_web_image !== false);
      setGenerateFlowchart(config.generate_flowchart !== false);
      setAutoProofread(config.auto_proofread === true);  // 默认关闭,只有明确设置为 true 才开启
      setSelectedCover(config.default_cover_style || 'cover1');
      setSelectedLayout(config.default_layout_style || 'text');
      setSelectedColor(config.default_color_scheme || 'black');
    } catch (err) {
      // 使用默认配置
    }
  }, [user?.id, setSelectedModel, setWordCount, setDarkBidMode, setAutoWebImage, 
      setGenerateFlowchart, setAutoProofread, setSelectedCover, setSelectedLayout, setSelectedColor]);

  // 保存用户配置
  const saveUserConfig = useCallback(async (updates: Partial<UserConfigUpdates>) => {
    if (!user?.id) return;
    try {
      await bidWriterApi.updateConfig(user.id, updates);
    } catch (err) {
      console.error('[BidWriter] 保存配置失败:', err);
    }
  }, [user?.id]);

  // 组件卸载时完全清理 WebSocket（包括回调）
  useEffect(() => {
    return () => {
      bidWriterWs.cleanup();
      setWsConnected(false);
    };
  }, []);

  const value: BidWriterContextValue = {
    step,
    setStep,
    bidId,
    setBidId,
    status,
    setStatus,
    uploading,
    setUploading,
    analyzing,
    setAnalyzing,
    projectOverview,
    setProjectOverview,
    scoringCriteria,
    setScoringCriteria,
    outline,
    setOutline,
    reviewResult,
    setReviewResult,
    generatedContent,
    setGeneratedContent,
    completedSections,
    setCompletedSections,
    currentSectionId,
    setCurrentSectionId,
    generationPhase,
    setGenerationPhase,
    loading,
    setLoading,
    wsConnected,
    connectWebSocket,
    disconnectWebSocket,
    loadUserConfig,
    saveUserConfig,
    findChapterIdBySectionId,
    initGeneratedStateFromOutline,
    mainButtonAction,
    setMainButtonAction,
    exporting,
    setExporting,
    viewMode,
    setViewMode,
    toggleViewMode,
  };

  return (
    <BidWriterContext.Provider value={value}>
      {children}
    </BidWriterContext.Provider>
  );
};

export default BidWriterContext;
