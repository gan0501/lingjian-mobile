import React, { forwardRef, useImperativeHandle, useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, Image } from 'react-native';
import type { RootStackScreenProps } from '@/navigation/types';
import Soil3DWebView from '../components/Soil3DWebView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePileComparisonContext } from '../PileComparisonContext';
import { ThinkingLoader } from '../components/ChatThread';
import { pileComparisonApi } from '../pileComparisonApi';
import ChatThread from '../components/ChatThread';
import DocumentPicker from 'react-native-document-picker';
import { usePileComparisonWebSocket } from '../usePileComparisonWebSocket';
import { useAuthStore } from '@/stores/useAuthStore';
import { Upload } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = {
  navigation: RootStackScreenProps<'PileComparison'>['navigation'];
  onConfirm?: () => void;
  onCorrect?: () => void;
  onRecognized?: () => void;
  onPatched?: () => void;
  onRecognizingChange?: (recognizing: boolean) => void;
  onUploadPress?: () => void;
};

export interface ParameterContentRef {
  pickFromGallery: () => void;
  takePhoto: () => void;
}

const circledNumbers: Record<number, string> = {
  1: '①',
  2: '②',
  3: '③',
  4: '④',
  5: '⑤',
  6: '⑥',
  7: '⑦',
  8: '⑧',
  9: '⑨',
  10: '⑩',
  11: '⑪',
  12: '⑫',
  13: '⑬',
  14: '⑭',
  15: '⑮',
  16: '⑯',
  17: '⑰',
  18: '⑱',
  19: '⑲',
  20: '⑳',
};

const circledToNumber: Record<string, number> = {
  '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5,
  '⑥': 6, '⑦': 7, '⑧': 8, '⑨': 9, '⑩': 10,
  '⑪': 11, '⑫': 12, '⑬': 13, '⑭': 14, '⑮': 15,
  '⑯': 16, '⑰': 17, '⑱': 18, '⑲': 19, '⑳': 20,
};

const formatLayerLabel = (layer: any) => {
  const raw = String(layer ?? '').trim();
  if (!raw) return '';
  if (/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/.test(raw)) return raw;

  const m = raw.match(/^\s*(\d{1,2})([-－—–]\s*\d+)?\s*$/);
  if (!m) return raw;
  const n = Number(m[1]);
  const circled = circledNumbers[n];
  if (!circled) return raw;
  const tail = (m[2] || '').replace(/\s+/g, '');
  const normalizedTail = tail.replace(/^[－—–]/, '-');
  return `${circled}${normalizedTail}`;
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

const ParameterContent = forwardRef<ParameterContentRef, Props>(({
  navigation,
  onConfirm,
  onCorrect,
  onRecognized,
  onPatched,
  onRecognizingChange,
  onUploadPress,
}, ref) => {
  const devLog = (...args: any[]) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  };

  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const uploadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useAuthStore();
  const { 
    bidId, setBidId, connectWebSocket, 
    pileParameters, setPileParameters, 
    chatThreads, setAttachments,
    soilLayers, setSoilLayers, setProjectOverview,
    setProfileReviewStatus, setProfileVersion, setProfilePatchCount,
    setBearingRecommendations, setBearingAdviceMarkdown,
    setPlanResults
  } = usePileComparisonContext();
  const [editing, setEditing] = useState(false);
  const [editableParams, setEditableParams] = useState(pileParameters);

  const isLikelyDesignParameterTable = useCallback((data: any) => {
    // 放宽验证条件：只要有土层数据就通过，允许部分字段缺失
    const params = (data as any)?.parameters;
    if (Array.isArray(params) && params.length > 0) {
      // 只要有土层数据（包含土层名称或编号）就认为是有效参数表
      const hasValidRow = params.some((p: any) => {
        // 检查是否有土层标识（layer字段）或土层名称（soil_name字段）
        const hasLayer = p?.layer !== undefined && p?.layer !== null && String(p.layer).trim() !== '';
        const hasSoilName = p?.soil_name !== undefined && p?.soil_name !== null && String(p.soil_name).trim() !== '';
        
        // 第一优先级：有土层数据（层号或土层名称）
        if (hasLayer || hasSoilName) {
          return true;
        }
        
        // 第二优先级：有桩基参数（兼容原有逻辑）
        const endPrefab = Number(p?.end_bearing_prefab ?? NaN);
        const endDrilled = Number(p?.end_bearing_drilled ?? NaN);
        const sidePrefab = Number(p?.side_friction_prefab ?? NaN);
        const sideDrilled = Number(p?.side_friction_drilled ?? NaN);
        return (
          (Number.isFinite(endPrefab) && endPrefab > 0) ||
          (Number.isFinite(endDrilled) && endDrilled > 0) ||
          (Number.isFinite(sidePrefab) && sidePrefab > 0) ||
          (Number.isFinite(sideDrilled) && sideDrilled > 0)
        );
      });
      return hasValidRow;
    }

    // 只有在结构化结果为空时，才用关键字作为兜底启发式
    const text = String(
      (data as any)?.ocr_text ??
        (data as any)?.ocrText ??
        (data as any)?.extracted_text ??
        (data as any)?.extractedText ??
        (data as any)?.raw_text ??
        (data as any)?.rawText ??
        (data as any)?.text ??
        ''
    );
    if (!text) return false;
    const t = text.replace(/\s+/g, '');
    return t.includes('力') && t.includes('值') && t.includes('桩');
  }, []);

  usePileComparisonWebSocket({
    onParametersExtractProgress: (data) => {
      setLoading(true);
      onRecognizingChange?.(true);
    },
    onParametersExtractComplete: (data) => {
      clearUploadTimeout();
      setLoading(false);
      onRecognizingChange?.(false);

      // 处理识别错误
      if ((data as any)?.error) {
        setPileParameters([]);
        setAttachments((prev) => (prev || []).filter((a) => (a as any)?.kind !== 'parameters'));
        return;
      }

      const ok = isLikelyDesignParameterTable(data);
      if (!ok) {
        devLog('[PileComparison][Parameter] invalid parameters payload', {
          keys: data ? Object.keys(data as any) : [],
          parametersCount: Array.isArray((data as any)?.parameters) ? (data as any).parameters.length : 0,
        });
        setPileParameters([]);
        setAttachments((prev) => (prev || []).filter((a) => (a as any)?.kind !== 'parameters'));
        Alert.alert('提示', '请上传正确的设计参数表');
        return;
      }

      onRecognized?.();
    },
  });

  const startEdit = () => {
    setEditableParams(pileParameters);
    setEditing(true);
  };
  const cancelEdit = () => {
    setEditing(false);
  };
  const saveEdit = async () => {
    setPileParameters(editableParams);
    if (bidId) {
      try { await pileComparisonApi.updateParameters(bidId, editableParams); } catch {}
    }
    onPatched?.();
    setEditing(false);
  };

  const handleConfirm = async () => {
    // 校验侧阻力和端承力上限
    const invalidItems: string[] = [];
    pileParameters.forEach((p, idx) => {
      const layerLabel = formatLayerLabel(p.layer);
      const sidePrefab = Number(p.side_friction_prefab ?? NaN);
      const sideDrilled = Number(p.side_friction_drilled ?? NaN);
      const endPrefab = Number(p.end_bearing_prefab ?? NaN);
      const endDrilled = Number(p.end_bearing_drilled ?? NaN);

      if (Number.isFinite(sidePrefab) && sidePrefab > 300) {
        invalidItems.push(`${layerLabel} 预制侧阻力(${sidePrefab})`);
      }
      if (Number.isFinite(sideDrilled) && sideDrilled > 300) {
        invalidItems.push(`${layerLabel} 灌注侧阻力(${sideDrilled})`);
      }
      if (Number.isFinite(endPrefab) && endPrefab > 10000) {
        invalidItems.push(`${layerLabel} 预制端承力(${endPrefab})`);
      }
      if (Number.isFinite(endDrilled) && endDrilled > 10000) {
        invalidItems.push(`${layerLabel} 灌注端承力(${endDrilled})`);
      }
      // 抗拔系数 λ 范围校验（0.5~0.8）
      const lambda = Number(p.uplift_coeff_lambda ?? NaN);
      if (Number.isFinite(lambda) && (lambda < 0.5 || lambda > 0.8)) {
        invalidItems.push(`${layerLabel} 抗拔系数λ(${lambda})不在0.5~0.8范围内`);
      }
      // 有侧阻力但缺少λ
      const hasSide = Number.isFinite(sidePrefab) || Number.isFinite(sideDrilled);
      if (hasSide && !Number.isFinite(lambda)) {
        invalidItems.push(`${layerLabel} 有侧阻力但缺少抗拔系数λ，请补充`);
      }
    });

    if (invalidItems.length > 0) {
      Alert.alert(
        '温馨提示',
        `以下数值超出常规范围（侧阻力≤300，端承力≤10000，λ∈[0.5,0.8]）：\n\n${invalidItems.join('\n')}`,
        [{ text: '知道了', style: 'default' }]
      );
      return;
    }

    if (bidId) {
      try { await pileComparisonApi.confirmParameters(bidId); } catch {}
    }
    onConfirm?.();
  };

  const handleUploadParameters = useCallback(async () => {
    try {
      const picked = await DocumentPicker.pickSingle({
        type: [
          DocumentPicker.types.images,
          DocumentPicker.types.xlsx,
          DocumentPicker.types.xls,
          DocumentPicker.types.csv,
        ],
      });

      if (!picked) return;

      const rawName = String(picked.name || '').trim();
      const rawType = String(picked.type || '').trim();
      const hasExt = /\.[a-z0-9]+$/i.test(rawName);
      let safeName = rawName;
      if (!safeName) {
        if (rawType.startsWith('image/')) safeName = 'parameters.jpg';
        else if (/csv/i.test(rawType)) safeName = 'parameters.csv';
        else safeName = 'parameters.xlsx';
      } else if (!hasExt) {
        if (rawType.startsWith('image/')) safeName = `${safeName}.jpg`;
        else if (/csv/i.test(rawType)) safeName = `${safeName}.csv`;
        else safeName = `${safeName}.xlsx`;
      }

      setLoading(true);
      onRecognizingChange?.(true);
      // 保存图片URI用于预览（仅图片类型）
      if (rawType.startsWith('image/')) {
        setImageUri(picked.uri);
      } else {
        setImageUri(null);
      }
      // 新一轮参数识别开始 = 新任务，清除所有步骤数据
      if (__DEV__) {
        console.log('[ParameterContent] processPickedFile - clearing soilLayers before:', soilLayers?.length);
      }
      setPileParameters([]);
      setSoilLayers([]);
      if (__DEV__) {
        console.log('[ParameterContent] processPickedFile - cleared soilLayers');
      }
      setProjectOverview(null);
      setProfileReviewStatus('pending');
      setProfileVersion(0);
      setProfilePatchCount(0);
      setBearingRecommendations([]);
      setBearingAdviceMarkdown('');
      setPlanResults([]);
      setAttachments((prev) => {
        const others = (prev || []).filter((a) => (a as any)?.kind !== 'parameters');
        return [...others, { uri: picked.uri, name: safeName || 'parameters.xlsx', type: picked.type, kind: 'parameters' } as any];
      });
      // 重新上传参数时，创建新的 bidId，避免历史数据干扰
      if (bidId) {
        // 清除旧的 bidId，让服务器创建新的项目
        setBidId(null);
        try { await AsyncStorage.removeItem('pile_comparison_last_bid_id'); } catch {}
      }
      
      // 使用 uploadParametersInit 创建新的 bidId
      if (typeof (pileComparisonApi as any).uploadParametersInit !== 'function') {
        devLog('[PileComparison][Parameter] uploadParametersInit missing', {
          keys: Object.keys(pileComparisonApi as any),
        });
        Alert.alert('上传失败', '当前App包/热更新未包含最新参数上传能力，请重新编译或重启打包服务后再试');
        setLoading(false);
        onRecognizingChange?.(false);
        return;
      }
      const res = await pileComparisonApi.uploadParametersInit(
        {
          uri: picked.uri,
          name: safeName,
          type: picked.type || 'application/octet-stream',
        },
        user?.id ?? 0
      );
      if (res?.bid_id) {
        setBidId(res.bid_id);
        try { await connectWebSocket(res.bid_id); } catch {}
      }
    } catch (err) {
      devLog('[PileComparison][Parameter] uploadParameters error', err);
      if (!DocumentPicker.isCancel(err)) {
        const msg = (err as any)?.message ? String((err as any).message) : '无法选择或上传文件';
        Alert.alert('上传失败', msg || '无法选择或上传文件');
      }
      setAttachments((prev) => (prev || []).filter((a) => (a as any)?.kind !== 'parameters'));
      setLoading(false);
      onRecognizingChange?.(false);
    }
  }, [bidId, setBidId, connectWebSocket, user?.id, setAttachments, setPileParameters, onRecognizingChange]);

  // 处理上传区域点击
  const handleUploadPress = useCallback(() => {
    if (onUploadPress) {
      onUploadPress();
    } else {
      handleUploadParameters();
    }
  }, [onUploadPress, handleUploadParameters]);

  // 从相册选择
  const pickFromGallery = useCallback(async () => {
    try {
      const picked = await DocumentPicker.pickSingle({
        type: [
          DocumentPicker.types.images,
          DocumentPicker.types.xlsx,
          DocumentPicker.types.xls,
          DocumentPicker.types.csv,
        ],
      });
      if (picked) {
        await processPickedFile(picked);
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('选择失败', '无法打开相册');
      }
    }
  }, []);

  // 拍照（暂用相册代替）
  const takePhoto = useCallback(async () => {
    Alert.alert('拍照', '相机模块未安装，暂用相册代替');
    await pickFromGallery();
  }, [pickFromGallery]);

  // 清理上传超时定时器
  const clearUploadTimeout = useCallback(() => {
    if (uploadTimeoutRef.current) {
      clearTimeout(uploadTimeoutRef.current);
      uploadTimeoutRef.current = null;
    }
  }, []);

  // 处理选择的文件
  const processPickedFile = async (picked: any) => {
    const rawName = String(picked.name || '').trim();
    const rawType = String(picked.type || '').trim();
    const hasExt = /\.[a-z0-9]+$/i.test(rawName);
    let safeName = rawName;
    if (!safeName) {
      if (rawType.startsWith('image/')) safeName = 'parameters.jpg';
      else if (/csv/i.test(rawType)) safeName = 'parameters.csv';
      else safeName = 'parameters.xlsx';
    } else if (!hasExt) {
      if (rawType.startsWith('image/')) safeName = `${safeName}.jpg`;
      else if (/csv/i.test(rawType)) safeName = `${safeName}.csv`;
      else safeName = `${safeName}.xlsx`;
    }

    setLoading(true);
    onRecognizingChange?.(true);
    // 重置参数数据
    setPileParameters([]);
    // 重新上传参数，也必须清空后续流程（剖面、持力层、方案）的数据以保证项目维度纯净
    setSoilLayers([]);
    setProjectOverview(null);
    setProfileReviewStatus('pending');
    setProfileVersion(0);
    setProfilePatchCount(0);
    setBearingRecommendations([]);
    setBearingAdviceMarkdown('');
    setPlanResults([]);

    // 保存图片URI用于预览（仅图片类型）
    if (rawType.startsWith('image/')) {
      setImageUri(picked.uri);
    } else {
      setImageUri(null);
    }
    setAttachments((prev) => {
      const others = (prev || []).filter((a) => (a as any)?.kind !== 'parameters');
      return [...others, { uri: picked.uri, name: safeName || 'parameters.xlsx', type: picked.type, kind: 'parameters' } as any];
    });

    // 设置上传超时保护：2分钟后如果还在识别中，强制关闭遮罩
    clearUploadTimeout();
    uploadTimeoutRef.current = setTimeout(() => {
      devLog('[ParameterContent] 上传识别超时保护触发，强制关闭遮罩');
      setLoading(false);
      onRecognizingChange?.(false);
      Alert.alert('识别超时', '参数识别超时（2分钟），请检查网络后重试');
    }, 120000); // 2分钟

    try {
      if (bidId) {
        try { await connectWebSocket(bidId); } catch {}
        await pileComparisonApi.uploadParameters(bidId, {
          uri: picked.uri,
          name: safeName,
          type: picked.type || 'application/octet-stream',
        });
      } else {
        const res = await (pileComparisonApi as any).uploadParametersInit({
          uri: picked.uri,
          name: safeName,
          type: picked.type || 'application/octet-stream',
        }, user?.id ?? 0);
        if (res?.bid_id) {
          setBidId(res.bid_id);
          await connectWebSocket(res.bid_id);
        }
      }
      // 上传成功，但识别状态由 WebSocket 事件控制
      // 如果服务器没有返回 bid_id 或上传失败，会在 catch 中处理
    } catch (err: any) {
      clearUploadTimeout();
      const msg = err?.message ? String(err.message) : '无法选择或上传文件';
      Alert.alert('上传失败', msg || '无法选择或上传文件');
      setAttachments((prev) => (prev || []).filter((a) => (a as any)?.kind !== 'parameters'));
      setLoading(false);
      onRecognizingChange?.(false);
    }
  };

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    pickFromGallery,
    takePhoto,
  }));

  // Debug log
  if (__DEV__) {
    console.log('[ParameterContent] render - soilLayers:', soilLayers?.length, 'loading:', loading);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {soilLayers && soilLayers.length > 0 && <Soil3DWebView />}

        {!loading && (!pileParameters || pileParameters.length === 0) ? (
          <TouchableOpacity style={styles.uploadArea} onPress={handleUploadPress} activeOpacity={0.8}>
            <View style={styles.uploadIcon}>
              <Upload size={48} color="#B20000" />
            </View>
            <Text style={styles.uploadTitle}>上传图片或参数表格文件</Text>
            <Text style={styles.uploadHint}>支持图片/Excel，用于识别土层编号、土层名称、桩参数等</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.card}>
            <View style={[styles.cardInnerPad, styles.cardHeader]}>
              <Text style={styles.cardTitle}>设计参数识别结果</Text>
              {!loading && pileParameters && pileParameters.length > 0 && (
                <>
                  {!editing ? (
                    <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn]} onPress={startEdit}>
                      <Text style={[styles.actionPrimaryText, { color: '#000000' }]}>进入纠错</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.actionsRight}>
                      <TouchableOpacity style={[styles.actionBtn, styles.saveBtn]} onPress={saveEdit}>
                        <Text style={styles.actionPrimaryText}>保存</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={cancelEdit}>
                        <Text style={styles.actionText}>取消</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
            {loading ? (
              <View style={styles.statusCard}>
                {imageUri && (
                  <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
                )}
                <View style={[styles.loadingRow, styles.cardInnerPad]}>
                  <ThinkingLoader />
                  <Text style={styles.loadingText}>识别中...</Text>
                </View>
              </View>
            ) : (
              <View style={styles.table}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={styles.tableScroll}>
                  <View style={styles.tableContent}>
                    <View style={[styles.tableHeader, styles.headerRow]}>
                      <View style={[styles.cellLayer, styles.headerCellCol]}>
                        <Text style={styles.headerText}>编号</Text>
                        <Text style={styles.headerSubText}>No.</Text>
                      </View>
                      <View style={[styles.cellName, styles.headerCellCol]}>
                        <Text style={styles.headerText}>名称</Text>
                        <Text style={styles.headerSubText}>name</Text>
                      </View>
                      <View style={[styles.cellValue, styles.headerCellCol]}>
                        <View style={styles.headerCellInline}>
                          <Text style={styles.headerText}>侧阻力</Text>
                          <View style={[styles.squeezeBadge, styles.squeezeBadgeJi]}>
                            <Text style={styles.squeezeBadgeText}>挤</Text>
                          </View>
                        </View>
                        <Text style={styles.headerSubText}>qₛᵢₐ</Text>
                      </View>
                      <View style={[styles.cellValue, styles.headerCellCol]}>
                        <View style={styles.headerCellInline}>
                          <Text style={styles.headerText}>端承力</Text>
                          <View style={[styles.squeezeBadge, styles.squeezeBadgeJi]}>
                            <Text style={styles.squeezeBadgeText}>挤</Text>
                          </View>
                        </View>
                        <Text style={styles.headerSubText}>qₚₐ</Text>
                      </View>
                      <View style={[styles.cellValue, styles.headerCellCol]}>
                        <View style={styles.headerCellInline}>
                          <Text style={styles.headerText}>侧阻力</Text>
                          <View style={[styles.squeezeBadge, styles.squeezeBadgeKong]}>
                            <Text style={styles.squeezeBadgeText}>孔</Text>
                          </View>
                        </View>
                        <Text style={styles.headerSubText}>qₛᵢₐ</Text>
                      </View>
                      <View style={[styles.cellValue, styles.headerCellCol]}>
                        <View style={styles.headerCellInline}>
                          <Text style={styles.headerText}>端承力</Text>
                          <View style={[styles.squeezeBadge, styles.squeezeBadgeKong]}>
                            <Text style={styles.squeezeBadgeText}>孔</Text>
                          </View>
                        </View>
                        <Text style={styles.headerSubText}>qₚₐ</Text>
                      </View>
                      <View style={[styles.cellLambda, styles.headerCellCol]}>
                        <Text style={styles.headerText}>抗拔系数</Text>
                        <Text style={styles.headerSubText}>λ</Text>
                      </View>
                    </View>
                    {(editing ? editableParams : pileParameters).map((p, idx) => (
                      <View key={idx} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowEven]}>
                        {editing ? (
                          <TextInput
                            style={[styles.input, styles.cellLayer]}
                            value={parseLayerToNumber(p.layer)}
                            onChangeText={(t) => {
                              setEditableParams(prev => prev.map((x, i) => i === idx ? { ...x, layer: t } : x));
                            }}
                          />
                        ) : (
                          <Text style={[styles.cell, styles.cellLayer]}>{formatLayerLabel(p.layer)}</Text>
                        )}
                        {editing ? (
                          <TextInput
                            style={[styles.input, styles.cellName]}
                            value={p.name || ''}
                            onChangeText={(t) => {
                              setEditableParams(prev => prev.map((x, i) => i === idx ? { ...x, name: t } : x));
                            }}
                          />
                        ) : (
                          <Text style={[styles.cell, styles.cellName]} numberOfLines={1}>{p.name || ''}</Text>
                        )}
                        {editing ? (
                          <TextInput
                            style={[styles.input, styles.cellValue]}
                            value={String(p.side_friction_prefab ?? '')}
                            keyboardType="numeric"
                            onChangeText={(t) => {
                              const v = Number(t);
                              setEditableParams(prev => prev.map((x, i) => i === idx ? { ...x, side_friction_prefab: isNaN(v) ? undefined : v } : x));
                            }}
                          />
                        ) : (
                          <Text style={[styles.cell, styles.cellValue]}>{p.side_friction_prefab ?? '-'}</Text>
                        )}
                        {editing ? (
                          <TextInput
                            style={[styles.input, styles.cellValue]}
                            value={String(p.end_bearing_prefab ?? '')}
                            keyboardType="numeric"
                            onChangeText={(t) => {
                              const v = Number(t);
                              setEditableParams(prev => prev.map((x, i) => i === idx ? { ...x, end_bearing_prefab: isNaN(v) ? undefined : v } : x));
                            }}
                          />
                        ) : (
                          <Text style={[styles.cell, styles.cellValue]}>{p.end_bearing_prefab ?? '-'}</Text>
                        )}
                        {editing ? (
                          <TextInput
                            style={[styles.input, styles.cellValue]}
                            value={String(p.side_friction_drilled ?? '')}
                            keyboardType="numeric"
                            onChangeText={(t) => {
                              const v = Number(t);
                              setEditableParams(prev => prev.map((x, i) => i === idx ? { ...x, side_friction_drilled: isNaN(v) ? undefined : v } : x));
                            }}
                          />
                        ) : (
                          <Text style={[styles.cell, styles.cellValue]}>{p.side_friction_drilled ?? '-'}</Text>
                        )}
                        {editing ? (
                          <TextInput
                            style={[styles.input, styles.cellValue]}
                            value={String(p.end_bearing_drilled ?? '')}
                            keyboardType="numeric"
                            onChangeText={(t) => {
                              const v = Number(t);
                              setEditableParams(prev => prev.map((x, i) => i === idx ? { ...x, end_bearing_drilled: isNaN(v) ? undefined : v } : x));
                            }}
                          />
                        ) : (
                          <Text style={[styles.cell, styles.cellValue]}>{p.end_bearing_drilled ?? '-'}</Text>
                        )}
                        {editing ? (
                          <TextInput
                            style={[styles.input, styles.cellLambda]}
                            value={String(p.uplift_coeff_lambda ?? '')}
                            keyboardType="numeric"
                            onChangeText={(t) => {
                              const raw = t.trim();
                              if (raw === '' || raw === '.') {
                                setEditableParams(prev => prev.map((x, i) => i === idx ? { ...x, uplift_coeff_lambda: undefined } : x));
                                // 如果该层有侧阻力，轻提示用户补充λ
                                const hasSide = Number.isFinite(Number(p.side_friction_prefab)) || Number.isFinite(Number(p.side_friction_drilled));
                                if (hasSide) {
                                  Alert.alert('提示', `${formatLayerLabel(p.layer)} 存在侧阻力值，抗拔系数λ不应为空，请补充（0.5~0.8）`, [{text: '知道了'}]);
                                }
                                return;
                              }
                              let v = Number(raw);
                              if (isNaN(v)) return;
                              // 不允许负数
                              if (v < 0) v = 0;
                              // 限定范围 0.5~0.8
                              if (v > 0.8) v = 0.8;
                              // 最多两位小数
                              v = Math.round(v * 100) / 100;
                              setEditableParams(prev => prev.map((x, i) => i === idx ? { ...x, uplift_coeff_lambda: v } : x));
                            }}
                          />
                        ) : (
                          <Text style={[styles.cell, styles.cellLambda]}>{p.uplift_coeff_lambda ?? '-'}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            
          </View>
        )}

        <ChatThread messages={chatThreads.parameter} />
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  contentContainer: { paddingBottom: 120 },
  card: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 16,
  },
  cardInnerPad: { paddingHorizontal: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 20 },
  uploadArea: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
  uploadTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 8 },
  uploadHint: { fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  table: { marginTop: 8 },
  tableScroll: { flexDirection: 'row' },
  tableContent: { width: 420 },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    paddingBottom: 8,
    marginBottom: 8,
  },
  headerRow: { marginBottom: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderRadius: 4 },
  tableRowEven: { backgroundColor: 'rgba(255,255,255,0.05)' },
  cell: { color: 'rgba(255,255,255,0.85)', fontSize: 12, textAlign: 'center' },
  headerText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700' },
  cellLayer: { width: 46, paddingRight: 6 },
  cellName: { width: 74, paddingRight: 6 },
  cellValue: { width: 58, paddingRight: 6 },
  cellLambda: { width: 50, paddingRight: 6 },
  headerCellInline: { flexDirection: 'row', alignItems: 'center' },
  headerCellCol: { alignItems: 'center', justifyContent: 'center' },
  headerSubText: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontStyle: 'italic', marginTop: 1 },
  squeezeBadge: { width: 10, height: 10, borderRadius: 5, alignItems: 'center', justifyContent: 'center', marginLeft: 3 },
  squeezeBadgeJi: { backgroundColor: '#006636' },
  squeezeBadgeKong: { backgroundColor: '#B20000' },
  squeezeBadgeText: { color: '#fff', fontSize: 8, fontWeight: '700', lineHeight: 9 },
  input: { paddingHorizontal: 6, paddingVertical: 0, borderRadius: 15, backgroundColor: '#fff', color: '#333', fontSize: 12, height: 26, includeFontPadding: false },
  actionsRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryBtn: { backgroundColor: '#FFFFFF', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5 },
  saveBtn: { backgroundColor: '#4CAF50', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5 },
  actionPrimaryText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  actionText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { color: 'rgba(255,255,255,0.8)', marginLeft: 8 },
  statusCard: {
    marginTop: 8,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
});

export default ParameterContent;
