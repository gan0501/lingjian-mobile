import { Loading } from '@/components/common/Loading';
/**
 * PileComparison 主容器组件
 * 统一管理 Header、Modals，内容区根据 tab 切换
 */
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';

// 土层 key 标准化函数（与 BearingContent 保持一致）
const normalizeLayerKey = (v: any) => {
  const circledToNum: Record<string, string> = {
    '⓪': '0', '①': '1', '②': '2', '③': '3', '④': '4',
    '⑤': '5', '⑥': '6', '⑦': '7', '⑧': '8', '⑨': '9',
    '⑩': '10', '⑪': '11', '⑫': '12', '⑬': '13', '⑭': '14',
    '⑮': '15', '⑯': '16', '⑰': '17', '⑱': '18', '⑲': '19', '⑳': '20',
  };
  const s0 = String(v ?? '').trim();
  const s = s0.replace(/[⓪①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/g, (m) => circledToNum[m] ?? m);
  if (!s) return '';
  const m = s.match(/[0-9]+(?:-[0-9]+)?/g);
  if (m && m[0]) return m[0];
  return s;
};
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Alert,
  TextInput,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PileComparisonHeader } from './PileComparisonHeader';
import { BottomSearchBar } from '@/components/common/BottomSearchBar';
import { AIContentDisclaimer } from '@/components/common/AIContentDisclaimer';
import { usePileComparisonContext } from './PileComparisonContext';
import { usePileComparisonWebSocket } from './usePileComparisonWebSocket';
import { pileComparisonApi } from './pileComparisonApi';
import { useAIToolGuard } from '@/hooks';
import UploadContent from './contents/UploadContent';
import ParameterContent from './contents/ParameterContent';
import BearingContent from './contents/BearingContent';
import PlanContent from './contents/PlanContent';
import ReportListSidebar from './components/ReportListSidebar';
import type { PileComparisonStackScreenProps } from './PileComparisonStack';
import type { RootStackParamList } from '@/navigation/types';

type Props = PileComparisonStackScreenProps<'Main'>;

// ==================== 内部组件 ====================

// 权限检查包装组件
const PileComparisonGuard: FC<Props> = ({ navigation }) => {
  const guard = useAIToolGuard('pile_comparison');
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    console.log('[PileComparison] 检查权限...');
    guard().then((result) => {
      console.log('[PileComparison] 权限检查结果:', result);
      if (!result) navigation.goBack();
      setAllowed(result);
    }).catch((err) => {
      console.error('[PileComparison] 权限检查失败:', err);
      navigation.goBack();
      setAllowed(false);
    });
  }, []);

  if (allowed === null || !allowed) {
    return null;
  }

  return <PileComparisonMainContent navigation={navigation} />;
};

// 主内容组件（确保 hooks 调用顺序一致）
const PileComparisonMainContent: FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const devLog = (...args: any[]) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  };

  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const {
    bidId,
    status,
    projectOverview,
    setProjectOverview,
    isProjectNameManuallyEdited,
    setIsProjectNameManuallyEdited,
    loading,
    isInitializing,
    setAttachments,
    attachments,
    pileParameters,
    bearingRecommendations,
    bearingAdviceMarkdown,
    soilLayers,
    setSoilLayers,
    profileReviewStatus,
    setProfileReviewStatus,
    profileVersion,
    setProfileVersion,
    profilePatchCount,
    incrementProfilePatchCount,
    setProfilePatchCount,
    chatThreads,
    appendChatMessage,
    updateChatMessage,
    comparisonReportGenerating,
    comparisonReports,
    setComparisonReports,
    hasUnreadComparisonReports,
    markComparisonReportsViewed,
    refreshComparisonReports,
    initialReportId,
    initialRoute,
  } = usePileComparisonContext();

  usePileComparisonWebSocket({
    onParseComplete: () => {
      setProfileAnalyzing(false);
    },
  });

  const initialReportIdRef = useRef(false);
  useEffect(() => {
    if (initialReportId && !initialReportIdRef.current && !loading && comparisonReports && comparisonReports.length > 0) {
      initialReportIdRef.current = true;
      if (initialRoute !== 'ReportViewer') {
        const timer = setTimeout(() => {
          navigation.navigate('ReportViewer', { reportId: initialReportId });
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [initialReportId, loading, comparisonReports, initialRoute]);

  // 编辑项目名称
  const [editNameModalVisible, setEditNameModalVisible] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState('');

  // 上传方式弹窗
  const [uploadModalVisible, setUploadModalVisible] = useState(false);

  // 标签栏配置
  const tabs = [
    { id: 'parameter', label: '参数' },
    { id: 'profile', label: '剖面' },
    { id: 'bearing', label: '持力层' },
    { id: 'solution', label: '方案' },
  ];
  const [selectedTab, setSelectedTab] = useState('parameter');

  const [parameterPatchCount, setParameterPatchCount] = useState(0);
  const [parameterVerified, setParameterVerified] = useState(true);
  const [parameterRecognizing, setParameterRecognizing] = useState(false);

  const [bearingPatchCount, setBearingPatchCount] = useState(0);
  const [bearingVerified, setBearingVerified] = useState(true);
  const [bearingAdviceReady, setBearingAdviceReady] = useState(false);

  // 剖面识别和持力层分析加载状态
  const [profileAnalyzing, setProfileAnalyzing] = useState(false);
  const [bearingAdviceLoading, setBearingAdviceLoading] = useState(false);

  // 满屏遮罩超时保护：最多显示5分钟后自动关闭
  const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    const showOverlay = parameterRecognizing || profileAnalyzing || bearingAdviceLoading;
    if (showOverlay) {
      // 清除之前的定时器
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
      // 设置5分钟超时保护
      overlayTimeoutRef.current = setTimeout(() => {
        devLog('[PileComparison] 满屏遮罩超时保护触发，强制关闭遮罩');
        // 强制重置所有加载状态
        if (parameterRecognizing) setParameterRecognizing(false);
        if (profileAnalyzing) setProfileAnalyzing(false);
        if (bearingAdviceLoading) setBearingAdviceLoading(false);
        Alert.alert('提示', '操作超时，请检查网络后重试');
      }, 300000); // 5分钟
    } else {
      // 遮罩关闭时清除定时器
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
        overlayTimeoutRef.current = null;
      }
    }
    return () => {
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
    };
  }, [parameterRecognizing, profileAnalyzing, bearingAdviceLoading]);

  const [reportListVisible, setReportListVisible] = useState(false);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (comparisonReportGenerating) {
        e.preventDefault();
        Alert.alert(
          '报告生成中',
          '对比报告正在生成中，退出后将在后台继续。\n完成后可在报告列表或「牛马视窗 · 桩基比选」中查看。',
          [
            { text: '继续等待', style: 'cancel' },
            { text: '回到首页', onPress: () => navigation.dispatch(e.data.action) },
          ]
        );
      }
    });
    return unsub;
  }, [navigation, comparisonReportGenerating]);

  // 计算 candidateLayers（持力层列表），用于传递给后端 AI
  // 注意：只用编号(id)匹配参数表，不用序号(index)，避免序号与编号混淆
  const soilLayerByKey = useMemo(() => {
    const map = new Map<string, any>();
    const layers = Array.isArray(soilLayers) ? soilLayers : [];
    layers.forEach((l: any) => {
      const k1 = normalizeLayerKey(l.id);
      const k3 = normalizeLayerKey(l.layer_number);
      if (k1) map.set(k1, l);
      if (k3 && k3 !== k1) map.set(k3, l);
    });
    return map;
  }, [soilLayers]);

  const candidateLayers = useMemo(() => {
    const ps = Array.isArray(pileParameters) ? pileParameters : [];
    return ps
      .filter(p => {
        const endPrefab = Number(p.end_bearing_prefab ?? NaN);
        const endDrilled = Number(p.end_bearing_drilled ?? NaN);
        return (!Number.isNaN(endPrefab) && endPrefab > 0) || (!Number.isNaN(endDrilled) && endDrilled > 0);
      })
      .map(p => {
        const key = normalizeLayerKey(p.layer);
        if (!key) return null;
        const sl = soilLayerByKey.get(key) || null;
        if (!sl) return null;
        return { key, param: p, soil: sl };
      })
      .filter(Boolean) as Array<{ key: string; param: any; soil: any }>;
  }, [pileParameters, soilLayerByKey]);

  const lastBearingGenBidRef = useRef<string | null>(null);
  const bearingInitBidRef = useRef<string | null>(null);
  const bearingConfirmedBidRef = useRef<string | null>(null);
  const mergedSolutionChatBidRef = useRef<string | null>(null);

  // UploadContent ref
  const uploadContentRef = useRef<{ pickFromGallery: () => void; takePhoto: () => void } | null>(null);
  // ParameterContent ref
  const parameterContentRef = useRef<{ pickFromGallery: () => void; takePhoto: () => void } | null>(null);

  const prevBearingLenRef = useRef(0);
  useEffect(() => {
    const len = Array.isArray(bearingRecommendations) ? bearingRecommendations.length : 0;
    // 首次挂载时 bearingRecommendations 可能已从 Context 恢复为非空（例如从“对比报告详情页”返回）
    // 这不代表用户未确认持力层，不应强制重新确认。
    if (prevBearingLenRef.current === 0 && len > 0 && bearingVerified) {
      prevBearingLenRef.current = len;
      return;
    }
    const prev = prevBearingLenRef.current;
    prevBearingLenRef.current = len;
    if (prev === 0 && len > 0) {
      setBearingVerified(false);
      setBearingPatchCount(0);
    }
  }, [bearingRecommendations, bearingVerified]);

  useEffect(() => {
    if (selectedTab !== 'bearing') return;
    if (!bidId) return;
    if (bearingInitBidRef.current === bidId) return;
    bearingInitBidRef.current = bidId;

    // 用户已在当前 bidId 下确认过持力层：再次进入持力层页面（例如从报告详情返回）
    // 不应强制重置确认状态，否则会阻断进入“方案”步骤。
    if (bearingConfirmedBidRef.current === bidId && bearingVerified) {
      return;
    }
    setBearingVerified(false);
    setBearingPatchCount(0);
    setBearingAdviceReady(false);
  }, [selectedTab, bidId, bearingVerified]);

  useEffect(() => {
    if (!bidId) {
      setBearingAdviceReady(false);
    }
  }, [bidId]);

  // 注意：推荐卡片现在由 AI 初步建议接口统一生成，不再单独调用 generateBearing
  // bearingRecommendations 会通过 WebSocket 从 bearing_advice_ready 事件中获取

  useEffect(() => {
    if (bidId) return;
    if (attachments.length > 0) return;
    if (soilLayers.length > 0) return;
    if (pileParameters.length > 0) return;
    setSelectedTab('parameter');
  }, [bidId, attachments.length, soilLayers.length, pileParameters.length]);

  // 搜索栏状态
  const [searchText, setSearchText] = useState('');



  const handleSearchSubmit = useCallback(() => {
    void (async () => {
      const text = searchText.trim();
      if (!text) return;

      if (text.toLowerCase().startsWith('patch:')) {
        if (!bidId) {
          Alert.alert('提示', '请先完成剖面识别');
          return;
        }

        const jsonText = text.slice(6).trim();
        const payload = JSON.parse(jsonText);
        if (!payload || !Array.isArray(payload.ops) || payload.ops.length === 0) {
          Alert.alert('提示', 'patch 格式错误：需要包含 ops 数组');
          return;
        }

        const res = await pileComparisonApi.patchProfile(bidId, {
          base_version: profileVersion,
          ops: payload.ops,
          reason: payload.reason,
        });

        if (res?.success) {
          if (res.soil_layers) {
            const layers = (res.soil_layers || []).map((l: any, idx: number) => ({
              id: String(l.id ?? ''),
              name: String(l.name ?? `层${idx + 1}`),
              index: l.index !== undefined && l.index !== null && l.index !== '' ? String(l.index) : null,
              thickness: Number(l.thickness ?? 0),
              color: l.color ?? undefined,
              visible: l.visible !== false,
              top_elevation: l.top_elevation,
              bottom_elevation: l.bottom_elevation,
            }));
            setSoilLayers(layers);
          }
          if (res.profile_review_status) {
            setProfileReviewStatus(res.profile_review_status as any);
          }
          if (typeof res.profile_version === 'number') {
            setProfileVersion(res.profile_version);
          }
          setSearchText('');
          return;
        }

        Alert.alert('提示', 'patch 失败');
        return;
      }

      if (!bidId) {
        setSearchText('');
        Alert.alert('提示', '请先上传并完成剖面识别后再对话');
        return;
      }

      const requestId = `${selectedTab}|${Date.now()}`;

      appendChatMessage(selectedTab as any, {
        id: `user|${requestId}`,
        role: 'user',
        content: text,
        status: 'done',
        createdAt: Date.now(),
      });
      appendChatMessage(selectedTab as any, {
        id: requestId,
        role: 'assistant',
        content: '',
        status: 'streaming',
        createdAt: Date.now(),
      });

      setSearchText('');
      const chatRes = await pileComparisonApi.chat(bidId, { message: text, request_id: requestId });
      devLog('[PileComparison] chat response', {
        requestId,
        hasAssistantMessage: Boolean(chatRes?.assistant_message),
        opsLen: Array.isArray(chatRes?.ops) ? chatRes.ops.length : 0,
      });
      if (chatRes?.assistant_message) {
        updateChatMessage(selectedTab as any, requestId, { content: chatRes.assistant_message, status: 'done' });
      }

      if (chatRes?.success && Array.isArray(chatRes.ops) && chatRes.ops.length > 0) {
        devLog('[PileComparison] applying patch from chat ops', { requestId, ops: chatRes.ops });
        const res = await pileComparisonApi.patchProfile(bidId, {
          base_version: profileVersion,
          ops: chatRes.ops,
          reason: 'agent_chat',
        });

        devLog('[PileComparison] patch result', { requestId, success: Boolean(res?.success), profile_version: res?.profile_version });

        if (res?.success) {
          if (res.soil_layers) {
            const layers = (res.soil_layers || []).map((l: any, idx: number) => ({
              id: String(l.id ?? ''),
              name: String(l.name ?? `层${idx + 1}`),
              index: l.index !== undefined && l.index !== null && l.index !== '' ? String(l.index) : null,
              thickness: Number(l.thickness ?? 0),
              color: l.color ?? undefined,
              visible: l.visible !== false,
              top_elevation: l.top_elevation,
              bottom_elevation: l.bottom_elevation,
            }));
            setSoilLayers(layers);
          }
          if (res.profile_review_status) {
            setProfileReviewStatus(res.profile_review_status as any);
          }
          if (typeof res.profile_version === 'number') {
            setProfileVersion(res.profile_version);
          }

          incrementProfilePatchCount(chatRes.ops.length);

          appendChatMessage(selectedTab as any, {
            id: `assistant_patch_done|${requestId}`,
            role: 'assistant',
            content: `我已完成 **${chatRes.ops.length}** 处修改，其它内容保持不变。\n\n请在上方结果中核对是否正确。`,
            status: 'done',
            createdAt: Date.now(),
          });
        }
      }
    })().catch((e: any) => {
      Alert.alert('提示', e?.message || '发送失败');
    });
  }, [
    searchText,
    bidId,
    profileVersion,
    setSoilLayers,
    setProfileReviewStatus,
    setProfileVersion,
    appendChatMessage,
    updateChatMessage,
    selectedTab,
    incrementProfilePatchCount,
  ]);

  const handleConfirmProfile = useCallback(async () => {
    if (!bidId) return;

    // 校验规则
    const errors: string[] = [];
    const layers = soilLayers || [];
    const groundElevation = projectOverview?.ground_elevation;

    if (layers.length > 0) {
      // 1. 地面标高 = 第一行土层的面标高
      const firstLayer = layers[0];
      if (groundElevation !== undefined && firstLayer.top_elevation !== undefined) {
        if (Math.abs(groundElevation - firstLayer.top_elevation) > 0.01) {
          errors.push(`地面标高(${groundElevation.toFixed(2)})应等于第一行土层面标高(${firstLayer.top_elevation.toFixed(2)})`);
        }
      }

      // 2. 第一行土层底标高 = 第二行土层面标高
      for (let i = 0; i < layers.length - 1; i++) {
        const current = layers[i];
        const next = layers[i + 1];
        if (current.bottom_elevation !== undefined && next.top_elevation !== undefined) {
          if (Math.abs(current.bottom_elevation - next.top_elevation) > 0.01) {
            errors.push(`第${i + 1}行底标高(${current.bottom_elevation.toFixed(2)})应等于第${i + 2}行面标高(${next.top_elevation.toFixed(2)})`);
          }
        }
      }

      // 3. 每层土的面标高 >= 底标高
      layers.forEach((layer, idx) => {
        if (layer.top_elevation !== undefined && layer.bottom_elevation !== undefined) {
          if (layer.top_elevation < layer.bottom_elevation) {
            errors.push(`第${idx + 1}行面标高(${layer.top_elevation.toFixed(2)})应不小于底标高(${layer.bottom_elevation.toFixed(2)})`);
          }
        }
      });

      // 4. 每层土的厚度 = 面标高 - 底标高
      layers.forEach((layer, idx) => {
        if (layer.top_elevation !== undefined && layer.bottom_elevation !== undefined) {
          const calculatedThickness = layer.top_elevation - layer.bottom_elevation;
          const actualThickness = layer.thickness || 0;
          if (Math.abs(calculatedThickness - actualThickness) > 0.01) {
            errors.push(`第${idx + 1}行厚度(${actualThickness.toFixed(2)})应等于面标高-底标高(${calculatedThickness.toFixed(2)})`);
          }
        }
      });

      // 5. 编号逐行变大
      // 带圈数字到阿拉伯数字的映射
      const circledToNumber: Record<string, number> = {
        '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5,
        '⑥': 6, '⑦': 7, '⑧': 8, '⑨': 9, '⑩': 10,
        '⑪': 11, '⑫': 12, '⑬': 13, '⑭': 14, '⑮': 15,
        '⑯': 16, '⑰': 17, '⑱': 18, '⑲': 19, '⑳': 20,
      };

      const parseLayerId = (id: string): number => {
        // 先尝试匹配带圈数字格式（如 ①、②-1、③-2）
        const circledMatch = id.match(/^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])(?:[-–—](\d+))?$/);
        if (circledMatch) {
          const main = circledToNumber[circledMatch[1]] || 0;
          const sub = circledMatch[2] ? parseInt(circledMatch[2], 10) : 0;
          return main * 1000 + sub;
        }
        // 再尝试匹配阿拉伯数字格式（如 1、2-1、3-2）
        const match = id.match(/^(\d+)(?:[-–—](\d+))?$/);
        if (!match) return 0;
        const main = parseInt(match[1], 10);
        const sub = match[2] ? parseInt(match[2], 10) : 0;
        return main * 1000 + sub;
      };

      // 验证编号顺序（使用 id 字段即编号，序号 index 仅用于排列）
      for (let i = 0; i < layers.length - 1; i++) {
        const currentLayerId = layers[i].id;
        const nextLayerId = layers[i + 1].id;
        // 如果任一编号为空，跳过验证
        if (!currentLayerId || !nextLayerId) {
          continue;
        }
        const currentIdVal = parseLayerId(String(currentLayerId));
        const nextIdVal = parseLayerId(String(nextLayerId));
        if (currentIdVal >= nextIdVal) {
          errors.push(`第${i + 2}行编号(${nextLayerId})应大于第${i + 1}行编号(${currentLayerId})`);
        }
      }

      // 6. 厚度不能为负值
      layers.forEach((layer, idx) => {
        if (layer.thickness !== undefined && layer.thickness < 0) {
          errors.push(`第${idx + 1}行厚度不能为负值`);
        }
      });
    }

    if (errors.length > 0) {
      Alert.alert('温馨提示', errors.join('\n\n'), [{ text: '知道了', style: 'default' }]);
      return;
    }

    try {
      const res = await pileComparisonApi.confirmProfile(bidId);
      if (res?.success) {
        setProfileReviewStatus('verified');
        setProfilePatchCount(0);
        if (typeof (res as any).profile_version === 'number') {
          setProfileVersion((res as any).profile_version);
        }
        setSelectedTab('bearing');
        const hasAdvice = typeof bearingAdviceMarkdown === 'string' && bearingAdviceMarkdown.trim();
        const hasRecs = Array.isArray(bearingRecommendations) && bearingRecommendations.length > 0;
        if (!hasAdvice && !hasRecs) {
          setBearingAdviceLoading(true);
        }
      } else {
        Alert.alert('提示', res?.message || '确认失败');
      }
    } catch (e: any) {
      Alert.alert('提示', e?.message || '确认失败');
    }
  }, [bidId, soilLayers, projectOverview, setProfileReviewStatus, setProfileVersion, setProfilePatchCount, setSelectedTab, bearingAdviceMarkdown, bearingRecommendations, setBearingAdviceLoading]);

  const handleConfirmParameters = useCallback(async () => {
    if (!bidId) return;
    try {
      const res = await pileComparisonApi.confirmParameters(bidId);
      if ((res as any)?.success) {
        setParameterPatchCount(0);
        setParameterVerified(true);
        setSelectedTab('profile');
      } else {
        Alert.alert('提示', (res as any)?.message || '确认失败');
      }
    } catch (e: any) {
      Alert.alert('提示', e?.message || '确认失败');
    }
  }, [bidId]);

  const handleParametersRecognized = useCallback(() => {
    setParameterVerified(false);
  }, []);

  const handleParametersPatched = useCallback(() => {
    setParameterVerified(false);
    setParameterPatchCount(prev => prev + 1);
  }, []);

  const handleBearingPatched = useCallback(() => {
    setBearingVerified(false);
    setBearingPatchCount(prev => prev + 1);
  }, []);

  const handleConfirmBearing = useCallback(async () => {
    if (!bidId) return;
    try {
      const res = await pileComparisonApi.confirmBearing(bidId);
      if ((res as any)?.success) {
        setBearingPatchCount(0);
        setBearingVerified(true);
        bearingConfirmedBidRef.current = bidId;
        if (mergedSolutionChatBidRef.current !== bidId) {
          mergedSolutionChatBidRef.current = bidId;
          const parameterThread = chatThreads?.parameter || [];
          const profileThread = chatThreads?.profile || [];
          const bearingThread = chatThreads?.bearing || [];
          const solutionThread = chatThreads?.solution || [];

          const existingIds = new Set((solutionThread || []).map(m => m.id));
          const merged = [
            ...parameterThread.map(m => ({ ...m, id: `from_parameter|${m.id}` })),
            ...profileThread.map(m => ({ ...m, id: `from_profile|${m.id}` })),
            ...bearingThread.map(m => ({ ...m, id: `from_bearing|${m.id}` })),
          ]
            .filter(m => !existingIds.has(m.id))
            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

          merged.forEach((m) => appendChatMessage('solution', m));
        }
        setSelectedTab('solution');
      } else {
        Alert.alert('提示', (res as any)?.message || '确认失败');
      }
    } catch (e) {
      Alert.alert('提示', '确认失败');
    }
  }, [bidId, appendChatMessage, chatThreads]);


  const handleEditProjectName = useCallback(() => {
    setEditingProjectName(projectOverview?.project_name || '桩基比选');
    setEditNameModalVisible(true);
  }, [projectOverview?.project_name]);

  const handleSaveProjectName = useCallback(() => {
    if (editingProjectName.trim()) {
      setProjectOverview({ ...projectOverview, project_name: editingProjectName.trim() });
      setIsProjectNameManuallyEdited(true);
      setEditNameModalVisible(false);
    }
  }, [editingProjectName, projectOverview, setProjectOverview, setIsProjectNameManuallyEdited]);

  const handleViewComparisonReport = useCallback(() => {
    void markComparisonReportsViewed();
    setReportListVisible(true);
    // 打开时主动刷新报告列表
    void refreshComparisonReports();
  }, [markComparisonReportsViewed, refreshComparisonReports]);

  const handleOpenReportModal = useCallback(() => {
    // 旧逻辑入口保留：改为打开列表，避免直接弹正文
    void markComparisonReportsViewed();
    setReportListVisible(true);
    void refreshComparisonReports();
  }, [markComparisonReportsViewed, refreshComparisonReports]);

  const handleTabPress = useCallback((tabId: string) => {
    const paramsReady = !!(pileParameters && pileParameters.length > 0);
    const paramsConfirmed = paramsReady && parameterVerified;
    const profileConfirmed = profileReviewStatus === 'verified' && !!projectOverview;

    // 强制按步骤顺序进入下一步，但允许回退到已完成/当前步骤查看与修正
    if (tabId === 'profile') {
      if (!paramsConfirmed) {
        Alert.alert('提示', '请先完成参数识别并点击确认，再进入剖面步骤');
        return;
      }
    }

    if (tabId === 'bearing') {
      if (!paramsConfirmed) {
        Alert.alert('提示', '请先完成参数步骤并确认');
        return;
      }
      if (!profileConfirmed) {
        Alert.alert('提示', '请先完成剖面步骤并确认');
        return;
      }
    }
    if (tabId === 'solution') {
      const bearingReady = !!bearingVerified;
      if (!paramsConfirmed) {
        Alert.alert('提示', '请先完成参数步骤并确认');
        return;
      }
      if (!profileConfirmed) {
        Alert.alert('提示', '请先完成剖面步骤并确认');
        return;
      }
      if (!bearingReady) {
        Alert.alert('提示', '请先完成持力层步骤并确认');
        return;
      }
    }
    setSelectedTab(tabId);

    if (tabId === 'bearing') {
      const hasAdvice = typeof bearingAdviceMarkdown === 'string' && bearingAdviceMarkdown.trim();
      const hasRecs = Array.isArray(bearingRecommendations) && bearingRecommendations.length > 0;
      if (!hasAdvice && !hasRecs) {
        setBearingAdviceLoading(true);
      }
    }
  }, [pileParameters, parameterVerified, profileReviewStatus, projectOverview, bearingVerified, bearingAdviceMarkdown, bearingRecommendations]);

  // 渲染内容区
  const renderContent = () => {
    switch (selectedTab) {
      case 'profile':
        return (
          <UploadContent
            ref={uploadContentRef}
            navigation={navigation}
            onConfirm={handleConfirmProfile}
            onCorrect={() => {}}
            onUploadPress={() => setUploadModalVisible(true)}
            onAnalyzingChange={setProfileAnalyzing}
          />
        );
      case 'parameter':
        return (
          <ParameterContent
            ref={parameterContentRef}
            navigation={navigation}
            onConfirm={handleConfirmParameters}
            onCorrect={() => {}}
            onPatched={handleParametersPatched}
            onRecognized={handleParametersRecognized}
            onRecognizingChange={setParameterRecognizing}
            onUploadPress={() => setUploadModalVisible(true)}
          />
        );
      case 'bearing':
        return (
          <BearingContent
            navigation={navigation}
            onConfirm={handleConfirmBearing}
            onPatched={handleBearingPatched}
            onAdviceReadyChange={setBearingAdviceReady}
            onAdviceLoadingChange={setBearingAdviceLoading}
          />
        );
      case 'solution':
        return (
          <PlanContent />
        );
      default:
        return null;
    }
  };

  // 必须在条件return之前调用所有Hooks
  const reviewBanner = useMemo(() => {
    if (!bidId) return null;

    if (selectedTab === 'profile') {
      if (profileReviewStatus === 'verified') return null;
      if (!soilLayers || soilLayers.length === 0) return null;
      if (profileReviewStatus !== 'pending' && (!profilePatchCount || profilePatchCount <= 0)) return null;
      return (
        <View style={styles.reviewBannerWrap} pointerEvents="box-none">
          <View style={styles.reviewBanner}>
            <Text style={styles.reviewBannerText}>
              {profilePatchCount > 0 ? (
                <Text style={styles.reviewBannerCount}>{`+${profilePatchCount} `}</Text>
              ) : null}
              请检查是否正确？
            </Text>
            <TouchableOpacity style={styles.reviewBannerConfirmBtn} onPress={handleConfirmProfile}>
              <Text style={styles.reviewBannerConfirmText}>确认</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (selectedTab === 'bearing') {
      if (bearingVerified) return null;
      const paramsReady = !!(pileParameters && pileParameters.length > 0);
      const profileReady = !!projectOverview;
      if (!paramsReady || !profileReady) return null;
      // 当推荐方案已就绪（有推荐卡片可供选择）时显示确认按钮
      const hasRecommendations = Array.isArray(bearingRecommendations) && bearingRecommendations.length > 0;
      if (!hasRecommendations && !bearingAdviceReady) return null;
      return (
        <View style={styles.reviewBannerWrap} pointerEvents="box-none">
          <View style={styles.reviewBanner}>
            <Text style={styles.reviewBannerText}>
              {bearingPatchCount > 0 ? (
                <Text style={styles.reviewBannerCount}>{`+${bearingPatchCount} `}</Text>
              ) : null}
              请检查是否正确？
            </Text>
            <TouchableOpacity style={styles.reviewBannerConfirmBtn} onPress={handleConfirmBearing}>
              <Text style={styles.reviewBannerConfirmText}>确认</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (selectedTab === 'parameter') {
      if (parameterRecognizing) return null;
      if (!pileParameters || pileParameters.length === 0) return null;
      if (parameterVerified) return null;
      return (
        <View style={styles.reviewBannerWrap} pointerEvents="box-none">
          <View style={styles.reviewBanner}>
            <Text style={styles.reviewBannerText}>
              {parameterPatchCount > 0 ? (
                <Text style={styles.reviewBannerCount}>{`+${parameterPatchCount} `}</Text>
              ) : null}
              请检查是否正确？
            </Text>
            <TouchableOpacity style={styles.reviewBannerConfirmBtn} onPress={handleConfirmParameters}>
              <Text style={styles.reviewBannerConfirmText}>确认</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return null;
  }, [
    bidId,
    selectedTab,
    profileReviewStatus,
    soilLayers,
    profilePatchCount,
    handleConfirmProfile,
    pileParameters,
    parameterPatchCount,
    handleConfirmParameters,
    parameterVerified,
    parameterRecognizing,
    handleParametersRecognized,
    handleParametersPatched,
    bearingRecommendations,
    bearingPatchCount,
    bearingVerified,
    bearingAdviceReady,
    handleConfirmBearing,
    pileParameters,
    projectOverview,
  ]);

  const showFullScreenOverlay = parameterRecognizing || profileAnalyzing || bearingAdviceLoading;
  const overlayText = parameterRecognizing
    ? '参数识别中...'
    : profileAnalyzing
    ? '剖面识别中...'
    : bearingAdviceLoading
    ? '持力层分析中...'
    : '';

  // 全局加载状态 - 全屏遮罩
  // 仅在首次初始化（isInitializing）阶段显示全屏加载页
  // 不再依赖 loading 状态：因为 setBidId 触发的历史数据加载会短暂设置
  // loading=true，此时如果 showFullScreenOverlay 因 React 批量更新的
  // 时序问题暂时为 false，就会导致全屏变黑
  // loading 期间的加载体验由各子组件（ParameterContent 等）内部管理
  if (isInitializing && !showFullScreenOverlay) {
    return (
      <LinearGradient colors={['#80011A', '#000000']} style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <Loading size="large" color="#fff" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#80011A', '#000000']} style={styles.container}>
      {/* 满屏遮罩 - 用于参数识别、剖面识别、持力层分析 */}
      {showFullScreenOverlay && (
        <View style={styles.fullScreenOverlay}>
          <Loading size="large" color="#fff" />
          <Text style={styles.fullScreenOverlayText}>{overlayText}</Text>
        </View>
      )}

      {/* 顶部标题栏 */}
      <PileComparisonHeader
        navigation={navigation}
        projectName={projectOverview?.project_name}
        holeNumber={projectOverview?.hole_number}
        onEditProjectName={handleEditProjectName}
        onViewReport={handleViewComparisonReport}
        hasUnreadReport={hasUnreadComparisonReports}
        tabs={tabs}
        selectedTab={selectedTab}
        maxReachedStep={
          (() => {
            const paramsReady = !!(pileParameters && pileParameters.length > 0);
            const paramsConfirmed = paramsReady && parameterVerified;
            const profileConfirmed = profileReviewStatus === 'verified' && !!projectOverview;
            const bearingReady = !!bearingVerified;

            if (paramsConfirmed && profileConfirmed && bearingReady) return 3; // 可以到方案
            if (paramsConfirmed && profileConfirmed) return 2; // 可以到持力层
            if (paramsConfirmed) return 1; // 可以到剖面
            return 0; // 只能看参数
          })()
        }
        onTabPress={handleTabPress}
      />

      {/* 内容区 */}
      <View style={styles.contentArea}>
        {renderContent()}
      </View>

      {/* 底部搜索栏（方案页面隐藏） */}
      {selectedTab !== 'solution' && (
        <View style={[styles.bottomBarContainer, { paddingBottom: insets.bottom + 15 }]}>
          {reviewBanner}
          <BottomSearchBar
            value={searchText}
            onChangeText={setSearchText}
            onSubmit={handleSearchSubmit}
            placeholder="输入问题..."
            absolute={false}
            avoidKeyboard={true}
            showUploadButton={selectedTab === 'parameter' || selectedTab === 'profile'}
            onUpload={() => {
              setUploadModalVisible(true);
            }}
            hasAttachment={false}
            enableVoice={true}
            onRequireLogin={() => {
              rootNavigation.navigate('Login');
            }}
          />
          <AIContentDisclaimer style={{ position: 'absolute', bottom: insets.bottom, left: 0, right: 0 }} />
        </View>
      )}

      {/* 编辑项目名称弹窗 */}
      <Modal
        visible={editNameModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditNameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>修改项目名称</Text>
            <TextInput
              style={styles.modalInput}
              value={editingProjectName}
              onChangeText={setEditingProjectName}
              placeholder="请输入项目名称"
              placeholderTextColor="rgba(0,0,0,0.4)"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditNameModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleSaveProjectName}
              >
                <Text style={styles.confirmButtonText}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 上传方式选择弹窗 - 遮罩无动画，底部弹窗有动画 */}
      {uploadModalVisible && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* 遮罩 - 无动画直接显示 */}
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setUploadModalVisible(false)}
          />
          {/* 底部弹窗 - 有动画 */}
          <Modal
            visible={uploadModalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setUploadModalVisible(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setUploadModalVisible(false)}
            >
              <View style={styles.uploadSheet} onStartShouldSetResponder={() => true}>
                <Text style={styles.uploadSheetTitle}>{selectedTab === 'profile' ? '上传剖面' : '上传参数'}</Text>
            <View style={styles.uploadSheetRow}>
              <TouchableOpacity
                style={styles.uploadSheetBtn}
                onPress={() => {
                  setUploadModalVisible(false);
                  if (selectedTab === 'profile') {
                    setProfileAnalyzing(true);
                    uploadContentRef.current?.takePhoto();
                  } else {
                    setParameterRecognizing(true);
                    parameterContentRef.current?.takePhoto();
                  }
                }}
              >
                <View style={styles.uploadEmojiContainer}>
                  <Text style={styles.uploadEmoji}>📷</Text>
                </View>
                <Text style={styles.uploadSheetBtnText}>拍照</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.uploadSheetBtn}
                onPress={() => {
                  setUploadModalVisible(false);
                  if (selectedTab === 'profile') {
                    setProfileAnalyzing(true);
                    uploadContentRef.current?.pickFromGallery();
                  } else {
                    setParameterRecognizing(true);
                    parameterContentRef.current?.pickFromGallery();
                  }
                }}
              >
                <View style={styles.uploadEmojiContainer}>
                  <Text style={styles.uploadEmoji}>🖼️</Text>
                </View>
                <Text style={styles.uploadSheetBtnText}>相册</Text>
              </TouchableOpacity>
            </View>
                <TouchableOpacity style={styles.uploadSheetCancel} onPress={() => setUploadModalVisible(false)}>
                  <Text style={styles.uploadSheetCancelText}>取消</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      )}

      <ReportListSidebar
        visible={reportListVisible}
        items={comparisonReports as any}
        onClose={() => setReportListVisible(false)}
        onSelect={(item) => {
          void markComparisonReportsViewed();
          setReportListVisible(false);
          const rid = String((item as any)?.id || '').trim();
          if (!rid) return;
          navigation.navigate('ReportViewer', { reportId: rid });
        }}
        onDelete={async (item) => {
          const rid = String((item as any)?.id || '').trim();
          if (!rid || !bidId) return;
          try {
            await pileComparisonApi.deleteComparisonReport(bidId, rid);
            // 从本地状态中移除
            setComparisonReports(prev => (Array.isArray(prev) ? prev.filter(r => r.id !== rid) : []));
          } catch (err: any) {
            Alert.alert('提示', `删除失败：${err?.message || '未知错误'}`);
          }
        }}
      />
    </LinearGradient>
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
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  fullScreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  fullScreenOverlayText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  contentArea: {
    flex: 1,
    marginTop: 0,
  },
  bottomBarContainer: {
    position: 'relative',
    backgroundColor: '#000',
    paddingTop: 6,
    paddingBottom: 10,
  },
  reviewBannerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 74,
  },
  reviewBanner: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 9999,
  },
  reviewBannerText: {
    color: '#fff',
    fontSize: 12,
    flexShrink: 1,
    marginRight: 12,
  },
  reviewBannerCount: {
    color: '#4CD964',
    fontSize: 12,
    fontWeight: '700',
  },
  reviewBannerConfirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 64,
    backgroundColor: '#4CAF50',
    zIndex: 21,
    elevation: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBannerConfirmText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: '#B20000',
    marginLeft: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  uploadModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 320,
    alignItems: 'center',
  },
  uploadModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  uploadModalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  uploadModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  uploadModalButton: {
    flex: 1,
    backgroundColor: '#B20000',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  uploadModalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  uploadSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
    width: '100%',
  },
  uploadSheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  uploadSheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  uploadSheetBtn: {
    alignItems: 'center',
    padding: 16,
    minWidth: 80,
  },
  uploadEmojiContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadEmoji: {
    fontSize: 28,
  },
  uploadSheetBtnText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  uploadSheetCancel: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  uploadSheetCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
});

export default PileComparisonGuard;
