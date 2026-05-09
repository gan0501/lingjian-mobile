/**
 * Step 1: 上传/解析内容区
 * 负责文件上传、解析状态显示、土层展示
 */
import React, { forwardRef, useImperativeHandle, useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Upload, FileText } from 'lucide-react-native';
import DocumentPicker from 'react-native-document-picker';
import { pileComparisonApi } from '../pileComparisonApi';
import { usePileComparisonContext } from '../PileComparisonContext';
import { usePileComparisonWebSocket } from '../usePileComparisonWebSocket';
import { useAuthStore } from '@/stores/useAuthStore';
import type { RootStackScreenProps } from '@/navigation/types';
import Soil3DWebView from '../components/Soil3DWebView';
import ChatThread from '../components/ChatThread';
import { ThinkingLoader } from '../components/ChatThread';
import { useAgentTaskStore } from '@/stores/useAgentTaskStore';

const circledNumbers: Record<number, string> = {
  1: '①', 2: '②', 3: '③', 4: '④', 5: '⑤',
  6: '⑥', 7: '⑦', 8: '⑧', 9: '⑨', 10: '⑩',
  11: '⑪', 12: '⑫', 13: '⑬', 14: '⑭', 15: '⑮',
  16: '⑯', 17: '⑰', 18: '⑱', 19: '⑲', 20: '⑳',
};

const circledToNumber: Record<string, number> = {
  '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5,
  '⑥': 6, '⑦': 7, '⑧': 8, '⑨': 9, '⑩': 10,
  '⑪': 11, '⑫': 12, '⑬': 13, '⑭': 14, '⑮': 15,
  '⑯': 16, '⑰': 17, '⑱': 18, '⑲': 19, '⑳': 20,
};

// 数字到带圈数字的映射（与鸿蒙版本一致）
const NUMBER_CIRCLES: Record<string, string> = {
  '1': '①', '2': '②', '3': '③', '4': '④', '5': '⑤',
  '6': '⑥', '7': '⑦', '8': '⑧', '9': '⑨', '10': '⑩',
  '11': '⑪', '12': '⑫', '13': '⑬', '14': '⑭', '15': '⑮',
  '16': '⑯', '17': '⑰', '18': '⑱', '19': '⑲', '20': '⑳'
};

// 将数字字符串转换为带圈数字格式（如 "4-1" -> "④-1"）
const numberToCircled = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) return '';
  
  // 匹配数字开头，可能带有后缀（如 "4-1"）
  const match = trimmed.match(/^(\d+)(.*)$/);
  if (!match) return trimmed;
  
  const num = match[1];
  const suffix = match[2] || '';
  const circled = NUMBER_CIRCLES[num];
  
  if (circled) {
    return circled + suffix;
  }
  return trimmed;
};

const formatLayerLabel = (layer: any): string => {
  if (layer === undefined || layer === null || layer === '') {
    return '';
  }

  const id = String(layer).trim();

  // 如果已经是带圈数字格式（如 ①、④-1），直接返回
  const circledMatch = id.match(/^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])(.*)$/);
  if (circledMatch) {
    return id;
  }

  // 匹配数字部分（支持 1, 1-1, 2-2 等格式）
  const match = id.match(/^(\d+)(.*)$/);
  if (!match) {
    return id;
  }

  const num = match[1];
  const suffix = match[2] || '';

  // 将数字转换为带圈数字
  const circleNum = NUMBER_CIRCLES[num] || num;

  return circleNum + suffix;
};

const parseLayerToNumber = (layer: any): string => {
  const raw = String(layer ?? '').trim();
  if (!raw) return '';
  const m = raw.match(/^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])([-－—–]?\s*\d+)?$/);
  if (!m) return raw;
  const circled = m[1];
  const num = circledToNumber[circled];
  if (num === undefined) return raw;
  const tail = (m[2] || '').replace(/\s+/g, '').replace(/^[－—–]/, '-');
  return `${num}${tail}`;
};

type Props = {
  navigation: RootStackScreenProps<'PileComparison'>['navigation'];
  onConfirm?: () => void;
  onCorrect?: () => void;
  onUploadPress?: () => void;  // 点击上传区域的回调
  onAnalyzingChange?: (analyzing: boolean) => void;  // 识别状态变化回调
};

export interface UploadContentRef {
  triggerUpload: () => void;
  pickFromGallery: () => void;
  takePhoto: () => void;
}

const UploadContent = forwardRef<UploadContentRef, Props>(({ navigation, onConfirm, onUploadPress, onAnalyzingChange }, ref) => {
  const { user } = useAuthStore();

  const {
    bidId,
    setBidId,
    status,
    setStatus,
    setStatusSync,
    projectOverview,
    setProjectOverview,
    setStep,
    connectWebSocket,
    setSoilLayers,
    soilLayers,
    profileVersion,
    setProfileVersion,
    setProfileReviewStatus,
    chatThreads,
    setAttachments,
    setProfilePatchCount,
    setBearingRecommendations,
    setBearingAdviceMarkdown,
    setPlanResults,
  } = usePileComparisonContext();

  // 上传和解析状态
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parseMessage, setParseMessage] = useState('');
  const [localSheetVisible, setLocalSheetVisible] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [holeInfoEditing, setHoleInfoEditing] = useState(false);
  const [editableLayers, setEditableLayers] = useState(soilLayers);
  const [editableHoleNumber, setEditableHoleNumber] = useState('');
  const [editableGroundElevation, setEditableGroundElevation] = useState('');
  const [editableHoleDepth, setEditableHoleDepth] = useState('');
  const [editableWaterLevel, setEditableWaterLevel] = useState('');
  const busyRef = React.useRef({ uploading: false, analyzing: false });
  const parseTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const onAnalyzingChangeRef = React.useRef<((analyzing: boolean) => void) | undefined>(undefined);

  useEffect(() => {
    busyRef.current = { uploading, analyzing };
    onAnalyzingChangeRef.current = onAnalyzingChange;
  }, [uploading, analyzing, onAnalyzingChange]);

  // 剖面识别超时兜底：2分钟无响应则提示超时
  useEffect(() => {
    if (analyzing) {
      // 开始识别时启动定时器
      parseTimeoutRef.current = setTimeout(() => {
        // 2分钟后如果还在 analyzing 状态，说明超时了
        if (busyRef.current.analyzing) {
          setAnalyzing(false);
          setSoilLayers([]);
          setProjectOverview(null);
          setImageUri(null);
          setFileName('');
          setStatus('draft');
          setParseMessage('');
          Alert.alert(
            '识别超时',
            '地勘剖面识别超时（2分钟），请检查网络后重新上传',
            [{ text: '确定', style: 'default' }]
          );
        }
      }, 120000); // 2分钟 = 120000ms
    } else {
      // 识别完成或出错时清除定时器
      if (parseTimeoutRef.current) {
        clearTimeout(parseTimeoutRef.current);
        parseTimeoutRef.current = null;
      }
    }

    return () => {
      if (parseTimeoutRef.current) {
        clearTimeout(parseTimeoutRef.current);
        parseTimeoutRef.current = null;
      }
    };
  }, [analyzing, setStatus]);

  const hasResult = soilLayers.length > 0;

  const startEdit = useCallback(() => {
    // 初始化可编辑土层数据，添加输入字符串字段
    const layersWithInput = soilLayers.map(layer => ({
      ...layer,
      top_elevation_input: layer.top_elevation != null ? String(layer.top_elevation) : '',
      bottom_elevation_input: layer.bottom_elevation != null ? String(layer.bottom_elevation) : '',
    }));
    setEditableLayers(layersWithInput);
    setEditing(true);
  }, [soilLayers]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!bidId) {
      setEditing(false);
      return;
    }
    try {
      const ops: Array<{ op: 'update_layer'; id: string; path: string; value: any }> = [];
      soilLayers.forEach((orig, idx) => {
        const next = editableLayers[idx];
        if (!next) return;
        const targetId = orig.id || String(idx + 1);
        if (String(next.id ?? '') !== String(orig.id ?? '')) {
          ops.push({ op: 'update_layer', id: targetId, path: 'id', value: String(next.id ?? '') });
        }
        if (String(next.name ?? '') !== String(orig.name ?? '')) {
          ops.push({ op: 'update_layer', id: targetId, path: 'name', value: String(next.name ?? '') });
        }
        // 保存面标高修改
        if (next.top_elevation !== orig.top_elevation) {
          ops.push({ op: 'update_layer', id: targetId, path: 'top_elevation', value: next.top_elevation ?? null });
        }
        // 保存底标高修改
        if (next.bottom_elevation !== orig.bottom_elevation) {
          ops.push({ op: 'update_layer', id: targetId, path: 'bottom_elevation', value: next.bottom_elevation ?? null });
        }
        // 保存厚度修改
        if (next.thickness !== orig.thickness) {
          ops.push({ op: 'update_layer', id: targetId, path: 'thickness', value: next.thickness ?? null });
        }
      });

      // 同时保存地面标高（第一层土的面标高）
      const firstLayerTopElevation = editableLayers[0]?.top_elevation;
      const currentGroundElevation = projectOverview?.ground_elevation;
      const shouldUpdateGroundElevation = firstLayerTopElevation !== undefined && 
        (currentGroundElevation === undefined || Math.abs(firstLayerTopElevation - currentGroundElevation) > 0.001);

      if (ops.length > 0 || shouldUpdateGroundElevation) {
        // 先保存土层分层表
        if (ops.length > 0) {
          const res = await pileComparisonApi.patchProfile(bidId, {
            base_version: profileVersion,
            ops,
            reason: 'manual_edit',
          });

          if (res?.success && res.soil_layers) {
            setSoilLayers(
              (res.soil_layers || []).map((l: any, idx: number) => ({
                id: String(l.id ?? ''),
                name: String(l.name ?? `层${idx + 1}`),
                index: l.index !== undefined && l.index !== null && l.index !== '' ? l.index : null,
                thickness: Number(l.thickness ?? 0),
                color: l.color ?? undefined,
                visible: l.visible !== false,
                top_elevation: l.top_elevation,
                bottom_elevation: l.bottom_elevation,
              }))
            );
          }
          if (typeof (res as any)?.profile_version === 'number') {
            setProfileVersion((res as any).profile_version);
          }
          // 纠错编辑后，强制重置 profileReviewStatus 为 pending，让用户重新确认
          setProfileReviewStatus('pending');
        }

        // 同步保存地面标高
        if (shouldUpdateGroundElevation) {
          try {
            const holeInfoResult = await pileComparisonApi.patchHoleInfo(bidId, {
              ground_elevation: firstLayerTopElevation,
            });
            if (holeInfoResult.success) {
              setProjectOverview(holeInfoResult.project_overview);
            }
          } catch (e) {
            console.error('保存地面标高失败:', e);
          }
        }
      }
    } catch (e: any) {
      const errorMsg = e?.message || '保存失败';
      console.error('保存剖面失败:', e);
      Alert.alert('解析失败', '请重新识别');
    } finally {
      setEditing(false);
    }
  }, [bidId, soilLayers, editableLayers, profileVersion, setSoilLayers, setProfileVersion, setProfileReviewStatus, projectOverview?.ground_elevation, setProjectOverview]);

  const soilLayersWithElevations = useMemo(() => {
    const ground = projectOverview?.ground_elevation;
    if (ground == null) return soilLayers;
    let depthAcc = 0;
    return soilLayers.map(l => {
      const top = l.top_elevation ?? (ground - depthAcc);
      depthAcc += l.thickness || 0;
      const bottom = l.bottom_elevation ?? (ground - depthAcc);
      return {
        ...l,
        top_elevation: top,
        bottom_elevation: bottom,
      };
    });
  }, [soilLayers, projectOverview?.ground_elevation]);

  // WebSocket 事件处理
  usePileComparisonWebSocket({
    onParseProgress: (data) => {
      if (__DEV__) {
        console.log('[UploadContent] parse_progress:', data?.message);
      }
      setParseMessage(data.message || '正在识别中...');
    },
    onParseComplete: (data) => {
      if (__DEV__) {
        console.log('[UploadContent] parse_complete:', {
          hasError: !!data?.error,
          layersCount: (data as any)?.soil_layers?.length || 0,
        });
      }
      // 无论是否有土层数据，都要停止分析状态
      setAnalyzing(false);
      onAnalyzingChangeRef.current?.(false);

      const layers = (data as any)?.soil_layers;
      if (Array.isArray(layers) && layers.length > 0) {
        setSoilLayers(
          layers.map((layer: any, idx: number) => ({
            id: String(layer.id ?? ''),
            name: layer.name || '未知土层',
            // index 是序号（排列顺序），id 才是编号（如 ①、④-1）
            // 序号用于排列顺序，编号用于匹配参数表
            index: layer.index !== undefined && layer.index !== null && layer.index !== '' ? String(layer.index) : null,
            thickness: layer.thickness || 0,
            color: layer.color || '#8B4513',
            visible: true,
            top_elevation: layer.top_elevation,
            bottom_elevation: layer.bottom_elevation,
            inferred: layer.inferred ?? false,
          }))
        );
      } else {
        // 如果没有识别出土层，显示提示
        setSoilLayers([]);
        if (data?.error) {
          Alert.alert('识别失败', data.error?.message || '未能识别出地勘剖面土层，请重新上传');
        }
      }
    },
    onError: (data) => {
      // WebSocket 错误时关闭分析状态
      if (__DEV__) {
        console.log('[UploadContent] WebSocket error:', data);
      }
      setAnalyzing(false);
      onAnalyzingChangeRef.current?.(false);
      Alert.alert('连接错误', data?.message || 'WebSocket 连接失败，请检查网络后重试');
    },
    onConnected: () => {},
  });

  // 上传文件（与参数页面 processPickedFile 一致：普通函数，非 useCallback）
  const doUploadFile = async (file: { uri: string; name?: string; type?: string }) => {
    try {
      if (busyRef.current.uploading || busyRef.current.analyzing) {
        return;
      }
      setUploading(true);
      setAnalyzing(true);
      onAnalyzingChangeRef.current?.(true);
      setFileName(file.name || '图片');
      setImageUri(file.uri);
      setAttachments((prev) => {
        const others = (prev || []).filter((a) => (a as any)?.kind !== 'profile');
        return [...others, { uri: file.uri, name: file.name || 'profile.jpg', type: file.type, kind: 'profile' } as any];
      });
      setSoilLayers([]);
      setProjectOverview(null);
      setEditing(false);
      // 重新上传剖面 = 步骤2重新开始，清除步骤 2、3、4 数据
      setProfileReviewStatus('pending');
      setProfileVersion(0);
      setProfilePatchCount(0);
      setBearingRecommendations([]);
      setBearingAdviceMarkdown('');
      setPlanResults([]);

      const payload = {
        uri: file.uri,
        name: file.name || 'image.jpg',
        type: file.type || 'image/jpeg',
      };

      if (__DEV__) {
        console.log('[UploadContent] 开始上传文件');
      }
      const response = bidId
        ? await pileComparisonApi.uploadProfile(bidId, payload, user?.id ?? 0)
        : await pileComparisonApi.upload(payload, user?.id ?? 0);
      if (__DEV__) {
        console.log('[UploadContent] 上传成功, bidId:', response.bid_id);
      }
      setUploading(false);
      setAnalyzing(true);
      onAnalyzingChangeRef.current?.(true);
      if (!bidId) {
        setBidId(response.bid_id);
      }
      setStatusSync('parsing');
      setParseMessage('正在识别地勘剖面...');
      // 通知全局 Store：剖面解析开始
      useAgentTaskStore.getState().markWorking('pile_compare', '正在识别地勘剖面...', bidId || response.bid_id);
      if (__DEV__) {
        console.log('[UploadContent] 开始连接 WebSocket, bidId:', bidId || response.bid_id);
      }
      await connectWebSocket(bidId || response.bid_id);
      if (__DEV__) {
        console.log('[UploadContent] WebSocket 连接成功');
      }
    } catch (uploadErr: any) {
      setUploading(false);
      setAnalyzing(false);
      onAnalyzingChangeRef.current?.(false);
      Alert.alert('上传失败', uploadErr.message || '文件上传失败，请重试');
    }
  };

  const handlePickFromGalleryLocal = async () => {
    try {
      if (busyRef.current.uploading || busyRef.current.analyzing) {
        return;
      }
      const first = await DocumentPicker.pickSingle({ type: [DocumentPicker.types.images] });
      if (first) {
        await doUploadFile({ uri: first.uri, name: first.name, type: first.type });
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('选择失败', '无法打开相册');
      }
    } finally {
      setLocalSheetVisible(false);
    }
  };

  const handleTakePhotoLocal = async () => {
    Alert.alert('拍照', '相机模块未安装，暂用相册代替');
    await handlePickFromGalleryLocal();
  };

  // 确认剖面
  const handleGenerateOutline = useCallback(() => {
    if (!bidId) {
      Alert.alert('提示', '请先上传地勘剖面');
      return;
    }
    setStep(2);
  }, [bidId, setStep]);

  // 判断是否显示上传区域
  const showUploadArea = !uploading && !analyzing && !hasResult;

  // 处理上传区域点击
  const handleUploadPress = useCallback(() => {
    if (onUploadPress) {
      onUploadPress();
    } else {
      setLocalSheetVisible(true);
    }
  }, [onUploadPress]);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    triggerUpload: () => {
      if (!uploading && !analyzing) {
        handleUploadPress();
      }
    },
    pickFromGallery: () => {
      if (!uploading && !analyzing) {
        handlePickFromGalleryLocal();
      }
    },
    takePhoto: () => {
      if (!uploading && !analyzing) {
        handleTakePhotoLocal();
      }
    },
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* 上传区域 */}
        {showUploadArea && (
          <TouchableOpacity style={styles.uploadArea} onPress={handleUploadPress}>
            <View style={styles.uploadIcon}>
              <Upload size={48} color="#B20000" />
            </View>
            <Text style={styles.uploadTitle}>上传地勘剖面</Text>
            <Text style={styles.uploadHint}>上传单孔剖面，支持分段拍照或图片</Text>
          </TouchableOpacity>
        )}

        {/* 上传中/识别中状态 - 显示图片预览 + 加载指示器（与参数页面一致） */}
        {(uploading || analyzing) && (
          <View style={styles.statusCard}>
            {imageUri && (
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
            )}
            <View style={[styles.loadingRow, styles.cardInnerPad]}>
              <ThinkingLoader />
              <Text style={styles.loadingText}>识别中...</Text>
            </View>
          </View>
        )}

      {/* 解析完成 - 显示结果（识别中不显示，避免 hooks 顺序变化） */}
      {hasResult && !analyzing && (
        <>
          {/* 3D土层预览 */}
          <Soil3DWebView />

          {/* 孔信息卡片 */}
          <View style={styles.holeInfoCard}>
            <View style={styles.holeInfoHeader}>
              <Text style={styles.holeInfoTitle}>勘探孔信息</Text>
              <View style={styles.holeInfoActions}>
                {hasResult && (
                  !holeInfoEditing ? (
                    <TouchableOpacity style={[styles.holeInfoActionBtn, { backgroundColor: '#FFFFFF' }]} onPress={() => {
                      setEditableHoleNumber(projectOverview?.hole_number || '');
                      setEditableGroundElevation(projectOverview?.ground_elevation !== undefined ? String(projectOverview.ground_elevation) : '');
                      setEditableHoleDepth(projectOverview?.hole_depth !== undefined ? String(projectOverview.hole_depth) : '');
                      setEditableWaterLevel(projectOverview?.water_level !== undefined ? String(projectOverview.water_level) : '');
                      setHoleInfoEditing(true);
                    }}>
                      <Text style={[styles.holeInfoActionText, { color: '#000000' }]}>进入纠错</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity style={[styles.holeInfoActionBtn, { backgroundColor: '#4CAF50' }]} onPress={async () => {
                        if (!bidId) return;
                        const payload: { hole_number?: string; ground_elevation?: number; hole_depth?: number; water_level?: number } = {};
                        
                        // 孔号：直接保存，不做类型限制
                        payload.hole_number = editableHoleNumber || '';
                        
                        // 地面标高：必须是有效数字
                        if (editableGroundElevation && editableGroundElevation.trim() !== '') {
                          const val = parseFloat(editableGroundElevation);
                          if (isNaN(val)) {
                            Alert.alert('输入错误', '地面标高必须是数字');
                            return;
                          }
                          payload.ground_elevation = val;
                        }
                        
                        // 孔深：必须是有效数字
                        if (editableHoleDepth && editableHoleDepth.trim() !== '') {
                          const val = parseFloat(editableHoleDepth);
                          if (isNaN(val)) {
                            Alert.alert('输入错误', '孔深必须是数字');
                            return;
                          }
                          payload.hole_depth = val;
                        }
                        
                        // 水位标高：必须是有效数字
                        if (editableWaterLevel && editableWaterLevel.trim() !== '') {
                          const val = parseFloat(editableWaterLevel);
                          if (isNaN(val)) {
                            Alert.alert('输入错误', '水位标高必须是数字');
                            return;
                          }
                          payload.water_level = val;
                        }
                        
                        try {
                          // 保存勘探孔信息
                          const result = await pileComparisonApi.patchHoleInfo(bidId, payload);
                          if (result.success) {
                            setProjectOverview(result.project_overview);
                            
                            // 同步保存土层分层表（地面标高已同步到第一层土的面标高）
                            const ops: Array<{ op: 'update_layer'; id: string; path: string; value: any }> = [];
                            const firstLayer = editableLayers[0];
                            const origFirstLayer = soilLayers[0];
                            if (firstLayer && origFirstLayer && payload.ground_elevation !== undefined) {
                              const targetId = origFirstLayer.id || String(1);
                              // 如果面标高发生变化，保存修改
                              if (Math.abs(payload.ground_elevation - (origFirstLayer.top_elevation ?? 0)) > 0.001) {
                                ops.push({ op: 'update_layer', id: targetId, path: 'top_elevation', value: payload.ground_elevation });
                                // 重新计算厚度
                                if (firstLayer.bottom_elevation !== undefined) {
                                  const newThickness = payload.ground_elevation - firstLayer.bottom_elevation;
                                  ops.push({ op: 'update_layer', id: targetId, path: 'thickness', value: newThickness });
                                }
                              }
                            }
                            
                            if (ops.length > 0) {
                              try {
                                const res = await pileComparisonApi.patchProfile(bidId, {
                                  base_version: profileVersion,
                                  ops,
                                  reason: 'ground_elevation_sync',
                                });
                                if (res?.success && res.soil_layers) {
                                  setSoilLayers(
                                    (res.soil_layers || []).map((l: any, idx: number) => ({
                                      id: String(l.id ?? ''),
                                      name: String(l.name ?? `层${idx + 1}`),
                                      index: l.index !== undefined && l.index !== null && l.index !== '' ? l.index : null,
                                      thickness: Number(l.thickness ?? 0),
                                      color: l.color ?? undefined,
                                      visible: l.visible !== false,
                                      top_elevation: l.top_elevation,
                                      bottom_elevation: l.bottom_elevation,
                                    }))
                                  );
                                }
                                if (typeof (res as any)?.profile_version === 'number') {
                                  setProfileVersion((res as any).profile_version);
                                }
                              } catch (e) {
                                console.error('同步保存土层分层表失败:', e);
                              }
                            }
                            
                            setHoleInfoEditing(false);
                          }
                        } catch (e) {
                          Alert.alert('保存失败', '请稍后重试');
                        }
                      }}>
                        <Text style={[styles.holeInfoActionText, { color: '#FFFFFF' }]}>保存</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.holeInfoActionBtn, { backgroundColor: '#000000' }]} onPress={() => setHoleInfoEditing(false)}>
                        <Text style={[styles.holeInfoActionText, { color: '#FFFFFF' }]}>取消</Text>
                      </TouchableOpacity>
                    </>
                  )
                )}
              </View>
            </View>
            <View style={styles.holeInfoRow}>
              <View style={styles.holeInfoItem}>
                <Text style={styles.holeInfoLabel}>孔号</Text>
                {holeInfoEditing ? (
                  <TextInput
                    style={styles.holeInfoInput}
                    value={editableHoleNumber}
                    onChangeText={setEditableHoleNumber}
                    placeholder="请输入孔号"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                  />
                ) : (
                  <Text style={styles.holeInfoValue}>{projectOverview?.hole_number || '--'}</Text>
                )}
              </View>
              <View style={styles.holeInfoItem}>
                <Text style={styles.holeInfoLabel}>地面标高</Text>
                {holeInfoEditing ? (
                  <TextInput
                    style={styles.holeInfoInput}
                    value={editableGroundElevation}
                    onChangeText={(t) => {
                      // 只允许输入数字、正负号、小数点
                      const filtered = t.replace(/[^0-9+\-.]/g, '');
                      setEditableGroundElevation(filtered);
                      // 处理特殊输入：如果只有 "-" 或 "." 或 "-."，先保留原值，等待完整输入
                      if (filtered === '-' || filtered === '.' || filtered === '-.' || filtered === '') {
                        return;
                      }
                      // 联动更新：修改地面标高时，同步更新第一层面标高
                      const numValue = Number(filtered);
                      if (isNaN(numValue)) {
                        return;
                      }
                      const formattedValue = Number(numValue.toFixed(2));
                      setEditableLayers(prev => {
                        if (prev.length === 0) return prev;
                        const newLayers = [...prev];
                        const firstLayer = newLayers[0];
                        const bottom = firstLayer.bottom_elevation;
                        let newThickness = firstLayer.thickness;
                        if (bottom !== undefined) {
                          newThickness = formattedValue - bottom;
                          if (newThickness <= 0) {
                            Alert.alert('温馨提示', '面标高应不小于底标高，厚度必须大于0', [{ text: '知道了' }]);
                          }
                        }
                        newLayers[0] = {
                          ...firstLayer,
                          top_elevation: formattedValue,
                          top_elevation_input: formattedValue.toFixed(2),
                          thickness: newThickness
                        };
                        return newLayers;
                      });
                    }}
                    placeholder="请输入地面标高"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="numbers-and-punctuation"
                  />
                ) : (
                  <Text style={styles.holeInfoValue}>{
                    editing && editableLayers[0]?.top_elevation !== undefined
                      ? Number(editableLayers[0].top_elevation).toFixed(2)
                      : (projectOverview?.ground_elevation !== undefined ? projectOverview.ground_elevation.toFixed(2) : '--')
                  } m</Text>
                )}
              </View>
            </View>
            <View style={styles.holeInfoRow}>
              <View style={styles.holeInfoItem}>
                <Text style={styles.holeInfoLabel}>孔深</Text>
                {holeInfoEditing ? (
                  <TextInput
                    style={styles.holeInfoInput}
                    value={editableHoleDepth}
                    onChangeText={(t) => {
                      // 只允许输入数字、正负号、小数点
                      const filtered = t.replace(/[^0-9+\-.]/g, '');
                      setEditableHoleDepth(filtered);
                    }}
                    placeholder="请输入孔深"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="numbers-and-punctuation"
                  />
                ) : (
                  <Text style={styles.holeInfoValue}>{projectOverview?.hole_depth !== undefined ? projectOverview.hole_depth.toFixed(2) : '--'} m</Text>
                )}
              </View>
              <View style={styles.holeInfoItem}>
                <Text style={styles.holeInfoLabel}>水位标高</Text>
                {holeInfoEditing ? (
                  <TextInput
                    style={styles.holeInfoInput}
                    value={editableWaterLevel}
                    onChangeText={(t) => {
                      // 只允许输入数字、正负号、小数点
                      const filtered = t.replace(/[^0-9+\-.]/g, '');
                      setEditableWaterLevel(filtered);
                    }}
                    placeholder="请输入水位标高"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="numbers-and-punctuation"
                  />
                ) : (
                  <Text style={styles.holeInfoValue}>{projectOverview?.water_level != null ? projectOverview.water_level.toFixed(2) : '--'} m</Text>
                )}
              </View>
            </View>
          </View>

          {/* 土层列表卡片 */}
          <View style={styles.soilListCard}>
            <View style={[styles.soilListInnerPad, styles.soilListHeader]}>
              <Text style={styles.soilListTitle}>土层分层表</Text>
              {hasResult && (
                <>
                  {!editing ? (
                    <TouchableOpacity style={[styles.soilActionBtn, { backgroundColor: '#FFFFFF' }]} onPress={startEdit}>
                      <Text style={[styles.soilActionText, { color: '#000000' }]}>进入纠错</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.soilActionsRight}>
                      <TouchableOpacity style={[styles.soilActionBtn, { backgroundColor: '#4CAF50' }]} onPress={saveEdit}>
                        <Text style={[styles.soilActionText, { color: '#FFFFFF' }]}>保存</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.soilActionBtn, { backgroundColor: '#000000' }]} onPress={cancelEdit}>
                        <Text style={[styles.soilActionText, { color: '#FFFFFF' }]}>取消</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
            {/* 表头 */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>编号</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>名称</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>面标高</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>底标高</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>厚度</Text>
            </View>
            {/* 表体 */}
            {(editing ? editableLayers : soilLayersWithElevations).map((layer: any, index: number) => (
              <View key={`layer-${index}`} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
                {editing ? (
                  <TextInput
                    style={[styles.tableInput, { flex: 1.2 }]}
                    value={parseLayerToNumber(layer.id)}
                    onChangeText={(t) => setEditableLayers(prev => prev.map((x, i) => i === index ? { ...x, id: numberToCircled(t) } : x))}
                  />
                ) : (
                  <Text style={[styles.tableCell, { flex: 1.2 }, layer.inferred && { color: '#FFD700' }]}>{formatLayerLabel(layer.id)}</Text>
                )}
                {editing ? (
                  <TextInput
                    style={[styles.tableInput, { flex: 2 }]}
                    value={String(layer.name ?? '')}
                    onChangeText={(t) => setEditableLayers(prev => prev.map((x, i) => i === index ? { ...x, name: t } : x))}
                  />
                ) : (
                  <Text style={[styles.tableCell, { flex: 2 }, layer.inferred && { color: '#FFD700' }]} numberOfLines={1}>{layer.name}</Text>
                )}
                {editing ? (
                  <TextInput
                    style={[styles.tableInput, { flex: 1.5 }]}
                    value={layer.top_elevation_input ?? ''}
                    keyboardType="numbers-and-punctuation"
                    onChangeText={(t) => {
                      // 只允许输入数字、正负号、小数点
                      const filtered = t.replace(/[^0-9+\-.]/g, '');
                      // 先更新输入字符串
                      setEditableLayers(prev => {
                        const newLayers = [...prev];
                        newLayers[index] = { ...newLayers[index], top_elevation_input: filtered };
                        return newLayers;
                      });
                      // 处理特殊输入：如果只有 "-" 或 "." 或 "-."，先保留原值，等待完整输入
                      if (filtered === '-' || filtered === '.' || filtered === '-.' || filtered === '') {
                        return;
                      }
                      const numValue = Number(filtered);
                      // 如果转换结果是 NaN，则不更新
                      if (isNaN(numValue)) {
                        return;
                      }
                      // 使用 toFixed(2) 格式化，避免精度问题
                      const formattedValue = Number(numValue.toFixed(2));
                      // 联动更新：如果是第一行，同步更新地面标高
                      if (index === 0) {
                        setEditableGroundElevation(formattedValue.toFixed(2));
                      }
                      setEditableLayers(prev => {
                        const newLayers = [...prev];
                        const x = newLayers[index];
                        const bottom = x.bottom_elevation;
                        let newThickness = x.thickness;
                        // 自动计算厚度 = 面标高 - 底标高
                        if (bottom !== undefined) {
                          newThickness = formattedValue - bottom;
                          // 厚度必须大于0，报错提示
                          if (newThickness <= 0) {
                            Alert.alert('温馨提示', '面标高应不小于底标高，厚度必须大于0', [{ text: '知道了' }]);
                          }
                        }
                        newLayers[index] = { ...newLayers[index], top_elevation: formattedValue, thickness: newThickness };
                        // 联动更新：修改当前行顶标高时，更新上一行的底标高（如果不是第一行）
                        if (index > 0) {
                          const prevLayer = newLayers[index - 1];
                          const prevTop = prevLayer.top_elevation;
                          let prevThickness = prevLayer.thickness;
                          if (prevTop !== undefined) {
                            prevThickness = prevTop - formattedValue;
                            if (prevThickness <= 0) {
                              Alert.alert('温馨提示', `第${index}行：面标高应不小于底标高`, [{ text: '知道了' }]);
                            }
                          }
                          newLayers[index - 1] = {
                            ...prevLayer,
                            bottom_elevation: formattedValue,
                            bottom_elevation_input: formattedValue.toFixed(2),
                            thickness: prevThickness
                          };
                        }
                        return newLayers;
                      });
                    }}
                  />
                ) : (
                  <Text style={[styles.tableCell, { flex: 1.5 }]}>
                    {layer.top_elevation != null && layer.top_elevation !== undefined ? Number(layer.top_elevation).toFixed(2) : '--'}
                  </Text>
                )}
                {editing ? (
                  <TextInput
                    style={[styles.tableInput, { flex: 1.5 }]}
                    value={layer.bottom_elevation_input ?? ''}
                    keyboardType="numbers-and-punctuation"
                    onChangeText={(t) => {
                      // 只允许输入数字、正负号、小数点
                      const filtered = t.replace(/[^0-9+\-.]/g, '');
                      setEditableLayers(prev => {
                        const newLayers = [...prev];
                        const x = newLayers[index];
                        // 更新原始输入字符串
                        newLayers[index] = { ...x, bottom_elevation_input: filtered };
                        // 处理特殊输入：如果只有 "-" 或 "." 或 "-."，先保留原值，等待完整输入
                        if (filtered === '-' || filtered === '.' || filtered === '-.' || filtered === '') {
                          return newLayers;
                        }
                        const numValue = Number(filtered);
                        // 如果转换结果是 NaN，则不更新
                        if (isNaN(numValue)) {
                          return newLayers;
                        }
                        // 使用 toFixed(2) 格式化，避免精度问题
                        const formattedValue = Number(numValue.toFixed(2));
                        const top = x.top_elevation;
                        let newThickness = x.thickness;
                        // 自动计算厚度 = 面标高 - 底标高
                        if (top !== undefined) {
                          newThickness = top - formattedValue;
                          // 厚度必须大于0，报错提示
                          if (newThickness <= 0) {
                            Alert.alert('温馨提示', '面标高应不小于底标高，厚度必须大于0', [{ text: '知道了' }]);
                          }
                        }
                        newLayers[index] = { ...newLayers[index], bottom_elevation: formattedValue, thickness: newThickness };
                        // 联动更新：修改当前行底标高时，更新下一行的顶标高（如果不是最后一行）
                        if (index < newLayers.length - 1) {
                          const nextLayer = newLayers[index + 1];
                          const nextBottom = nextLayer.bottom_elevation;
                          let nextThickness = nextLayer.thickness;
                          if (nextBottom !== undefined) {
                            nextThickness = formattedValue - nextBottom;
                            if (nextThickness <= 0) {
                              Alert.alert('温馨提示', `第${index + 2}行：面标高应不小于底标高`, [{ text: '知道了' }]);
                            }
                          }
                          newLayers[index + 1] = {
                            ...nextLayer,
                            top_elevation: formattedValue,
                            top_elevation_input: formattedValue.toFixed(2),
                            thickness: nextThickness
                          };
                        }
                        return newLayers;
                      });
                    }}
                  />
                ) : (
                  <Text style={[styles.tableCell, { flex: 1.5 }]}>
                    {layer.bottom_elevation != null && layer.bottom_elevation !== undefined ? Number(layer.bottom_elevation).toFixed(2) : '--'}
                  </Text>
                )}
                <Text style={[styles.tableCell, { flex: 1 }]}>{Number(layer.thickness || 0).toFixed(2)}</Text>
              </View>
            ))}

          </View>

          <ChatThread messages={chatThreads.profile} />

        </>
      )}

      {/* 上传底部弹窗 */}
      <Modal
        visible={localSheetVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setLocalSheetVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setLocalSheetVisible(false)}
        >
          <View style={styles.uploadSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.uploadSheetTitle}>选择来源</Text>
            <View style={styles.uploadSheetRow}>
              <TouchableOpacity style={styles.uploadSheetBtn} onPress={handleTakePhotoLocal}>
                <View style={styles.uploadEmojiContainer}>
                  <Text style={styles.uploadEmoji}>📷</Text>
                </View>
                <Text style={styles.uploadSheetBtnText}>拍照</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadSheetBtn} onPress={handlePickFromGalleryLocal}>
                <View style={styles.uploadEmojiContainer}>
                  <Text style={styles.uploadEmoji}>🖼️</Text>
                </View>
                <Text style={styles.uploadSheetBtnText}>相册</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.uploadSheetCancel} onPress={() => setLocalSheetVisible(false)}>
              <Text style={styles.uploadSheetCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  uploadArea: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  uploadIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  uploadHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  statusCard: {
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 16,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 8,
  },
  cardInnerPad: {
    paddingHorizontal: 16,
  },
  imageCard: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    marginBottom: 16,
  },
  resultImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  holeInfoCard: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 16,
    marginBottom: 16,
  },
  holeInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  holeInfoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  holeInfoActions: {
    flexDirection: 'row',
    gap: 8,
  },
  holeInfoActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  holeInfoActionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  holeInfoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  holeInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  holeInfoLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginRight: 8,
  },
  holeInfoValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  holeInfoInput: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 0,
    height: 26,
    minHeight: 26,
    minWidth: 80,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  soilListCard: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 16,
    marginBottom: 16,
  },
  soilListInnerPad: {
    paddingHorizontal: 16,
  },
  soilListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  soilListTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  soilActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  soilActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  soilActionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableHeaderCell: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tableRowEven: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
  },
  tableCell: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  tableInput: {
    backgroundColor: '#fff',
    color: '#333',
    fontSize: 12,
    height: 26,
    minHeight: 26,
    paddingHorizontal: 6,
    paddingVertical: 0,
    borderRadius: 15,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  actionsRight: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 12 },
  primaryBtn: { backgroundColor: '#FFFFFF' },
  actionPrimaryText: { color: '#000000', fontSize: 12, fontWeight: '600' },
  actionBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#000',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionText: { color: '#fff', fontSize: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  uploadSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
  },
  uploadSheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  uploadSheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  uploadSheetBtn: {
    alignItems: 'center',
    padding: 16,
  },
  uploadEmojiContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadEmoji: {
    fontSize: 28,
  },
  uploadSheetBtnText: {
    fontSize: 14,
    color: '#333',
  },
  uploadSheetCancel: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  uploadSheetCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
});

export default UploadContent;
