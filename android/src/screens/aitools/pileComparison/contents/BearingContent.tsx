import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import type { RootStackScreenProps } from '@/navigation/types';
import Soil3DWebView from '../components/Soil3DWebView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePileComparisonContext } from '../PileComparisonContext';
import { pileComparisonApi } from '../pileComparisonApi';
import ChatThread, { MarkdownAssistant, ThinkingLoader } from '../components/ChatThread';

type Props = {
  navigation: RootStackScreenProps<'PileComparison'>['navigation'];
  onConfirm?: () => void;
  onAdviceReadyChange?: (ready: boolean) => void;
  onAdviceLoadingChange?: (loading: boolean) => void;
};

const BearingContent: React.FC<Props> = ({ navigation, onConfirm, onAdviceReadyChange, onAdviceLoadingChange }) => {
  useSafeAreaInsets();
  const {
    bidId,
    pileParameters,
    soilLayers,
    bearingRecommendations,
    setBearingRecommendations,
    bearingAdviceMarkdown,
    setBearingAdviceMarkdown,
  } = usePileComparisonContext();
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceReady, setAdviceReady] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const [adviceExpanded, setAdviceExpanded] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState(0);

  const adviceReadyRef = useRef(false);
  const adviceRequestRef = useRef<string | null>(null);

  const normalizeLayerKey = (v: any) => {
    const circledToNum: Record<string, string> = {
      '⓪': '0',
      '①': '1',
      '②': '2',
      '③': '3',
      '④': '4',
      '⑤': '5',
      '⑥': '6',
      '⑦': '7',
      '⑧': '8',
      '⑨': '9',
      '⑩': '10',
      '⑪': '11',
      '⑫': '12',
      '⑬': '13',
      '⑭': '14',
      '⑮': '15',
      '⑯': '16',
      '⑰': '17',
      '⑱': '18',
      '⑲': '19',
      '⑳': '20',
    };

    const s0 = String(v ?? '').trim();
    const s = s0.replace(/[⓪①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/g, (m) => circledToNum[m] ?? m);
    if (!s) return '';
    const m = s.match(/[0-9]+(?:-[0-9]+)?/g);
    if (m && m[0]) return m[0];
    return s;
  };

  const circledDigits = ['⓪', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];
  const formatLayerDisplay = (raw: any) => {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    // 已经包含圈号则直接返回（尽量不二次转换）
    if (/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/.test(s)) return s;
    const key = normalizeLayerKey(s);
    if (!key) return s;
    const parts = key.split('-');
    const n = Number(parts[0]);
    if (!Number.isFinite(n) || n <= 0 || n >= circledDigits.length) return s;
    const head = circledDigits[n];
    return parts.length > 1 ? `${head}-${parts.slice(1).join('-')}` : head;
  };

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
        // 即使剖面中未匹配到对应土层，也保留该参数（用户可能已在 Step 2 纠错补充）
        // soil 为 null 时，显示和计算会降级处理
        return {
          key,
          param: p,
          soil: sl,
        };
      })
      .filter(Boolean) as Array<{ key: string; param: any; soil: any }>;
  }, [pileParameters, soilLayerByKey]);

  // 处理推荐方案：AI生成的推荐方案，超过3项取前3项，不达3项按实际取
  const displayRecommendations = useMemo(() => {
    if (!bearingRecommendations || bearingRecommendations.length === 0) return [];
    // 取前3项
    return bearingRecommendations.slice(0, 3);
  }, [bearingRecommendations]);

  const bearingMarkerLines = useMemo(() => {
    const items = candidateLayers
      .map((x) => {
        const soil = (x as any)?.soil || ((x as any)?.key ? soilLayerByKey.get((x as any).key) : null);
        const elevation = Number(soil?.top_elevation);
        if (!Number.isFinite(elevation)) return null;

        const endPrefab = Number((x as any)?.param?.end_bearing_prefab ?? NaN);
        const endDrilled = Number((x as any)?.param?.end_bearing_drilled ?? NaN);
        const hasPrefab = Number.isFinite(endPrefab) && endPrefab > 0;
        const hasDrilled = Number.isFinite(endDrilled) && endDrilled > 0;

        const mode = hasPrefab && hasDrilled ? 'both' : hasPrefab ? 'prefab' : hasDrilled ? 'drilled' : null;
        if (!mode) return null;

        const layerId = formatLayerDisplay((x as any)?.param?.layer);
        const name = soil?.name || (x as any)?.param?.name || '';
        const label = name ? `${layerId}. ${name}` : layerId;
        return { elevation, mode, label };
      })
      .filter(Boolean) as { elevation: number; mode: 'prefab' | 'drilled' | 'both'; label: string }[];

    // 去重：同标高优先 both，其次 prefab/drilled
    const merged = new Map<number, { mode: 'prefab' | 'drilled' | 'both'; label: string }>();
    items.forEach((it) => {
      const prev = merged.get(it.elevation);
      if (!prev) {
        merged.set(it.elevation, { mode: it.mode, label: it.label });
        return;
      }
      if (prev.mode === 'both' || it.mode === prev.mode) return;
      merged.set(it.elevation, { mode: 'both', label: prev.label || it.label });
    });

    // 让标签按高程从高到低（从上到下）稳定排列
    return Array.from(merged.entries())
      .map(([elevation, v]) => ({ elevation, mode: v.mode, label: v.label }))
      .sort((a, b) => b.elevation - a.elevation);
  }, [candidateLayers, soilLayerByKey]);

  // 通知父组件分析加载状态变化
  useEffect(() => {
    onAdviceLoadingChange?.(adviceLoading);
  }, [adviceLoading, onAdviceLoadingChange]);

  useEffect(() => {
    if (!bidId) {
      setAdviceLoading(false);
      setAdviceReady(false);
      setAdviceError(null);
      adviceReadyRef.current = false;
      onAdviceReadyChange?.(false);
      return;
    }

    const hasCandidates = Array.isArray(candidateLayers) && candidateLayers.length > 0;
    if (!hasCandidates) {
      setAdviceLoading(false);
      setAdviceReady(false);
      setAdviceError(null);
      adviceReadyRef.current = false;
      onAdviceReadyChange?.(false);
      return;
    }

    if (typeof bearingAdviceMarkdown === 'string' && bearingAdviceMarkdown.trim()) {
      setAdviceLoading(false);
      setAdviceReady(true);
      setAdviceError(null);
      adviceReadyRef.current = true;
      onAdviceReadyChange?.(true);
      return;
    }

    if (adviceRequestRef.current === bidId) {
      setAdviceLoading(true);
      return;
    }
    adviceRequestRef.current = bidId;
    setAdviceLoading(true);
    setAdviceReady(false);
    setAdviceError(null);
    adviceReadyRef.current = false;
    onAdviceReadyChange?.(false);

    // 构建 candidate_layers 参数，传递给后端 AI
    const candidateLayersPayload = candidateLayers.map(cl => ({
      key: cl.key,
      layer: cl.param?.layer || '',
      name: cl.param?.name || (cl.soil as any)?.name || (cl.soil as any)?.layer_name || '',
      thickness: cl.soil?.thickness,
      end_bearing_prefab: cl.param?.end_bearing_prefab,
      end_bearing_drilled: cl.param?.end_bearing_drilled,
    }));

    void pileComparisonApi
      .generateBearingAdvice(bidId, { candidate_layers: candidateLayersPayload })
      .then((res) => {
        if (typeof res?.advice_markdown === 'string' && res.advice_markdown.trim()) {
          setBearingAdviceMarkdown(res.advice_markdown);
          // 同时处理推荐方案（后端现在也在API响应中返回recommendations）
          if (Array.isArray((res as any)?.recommendations) && (res as any).recommendations.length > 0) {
            setBearingRecommendations((res as any).recommendations);
          }
        } else {
          adviceRequestRef.current = null;
          setAdviceLoading(false);
          setAdviceReady(false);
          setAdviceError('初步建议生成失败（返回为空），请稍后重试');
          adviceReadyRef.current = false;
          onAdviceReadyChange?.(false);
        }
      })
      .catch((e) => {
        console.warn('[PileComparison][bearing_advice_generate_failed]', e);
        adviceRequestRef.current = null;
        setAdviceLoading(false);
        setAdviceReady(false);
        setAdviceError('初步建议生成失败，请检查后端/Key配置后重试');
        adviceReadyRef.current = false;
        onAdviceReadyChange?.(false);
      });
  }, [bidId, candidateLayers, bearingAdviceMarkdown, onAdviceReadyChange, setBearingAdviceMarkdown]);

  const retryGenerateAdvice = useCallback(() => {
    adviceRequestRef.current = null;
    setAdviceError(null);
    if (!bidId) return;
    setAdviceLoading(true);

    // 构建 candidate_layers 参数，传递给后端 AI
    const candidateLayersPayload = candidateLayers.map(cl => ({
      key: cl.key,
      layer: cl.param?.layer || '',
      name: cl.param?.name || (cl.soil as any)?.name || (cl.soil as any)?.layer_name || '',
      thickness: cl.soil?.thickness,
      end_bearing_prefab: cl.param?.end_bearing_prefab,
      end_bearing_drilled: cl.param?.end_bearing_drilled,
    }));

    void pileComparisonApi
      .generateBearingAdvice(bidId, { candidate_layers: candidateLayersPayload })
      .then((res) => {
        if (typeof res?.advice_markdown === 'string' && res.advice_markdown.trim()) {
          setBearingAdviceMarkdown(res.advice_markdown);
          if (Array.isArray((res as any)?.recommendations) && (res as any).recommendations.length > 0) {
            setBearingRecommendations((res as any).recommendations);
          }
        } else {
          setAdviceLoading(false);
          setAdviceError('初步建议生成失败（返回为空），请稍后重试');
        }
      })
      .catch((e) => {
        console.warn('[PileComparison][bearing_advice_generate_failed]', e);
        setAdviceLoading(false);
        setAdviceError('初步建议生成失败，请检查后端/Key配置后重试');
      });
  }, [bidId, candidateLayers, setBearingAdviceMarkdown]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Soil3DWebView markerLines={bearingMarkerLines} showBearingMarkers={true} showLayerLabels={false} />
        
        {/* 持力层列表卡片 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>持力层列表</Text>

          <View style={styles.table}>
            <View style={[styles.tableHeader, styles.headerRow]}>
              <Text style={[styles.cell, styles.cellColor, styles.headerText]}>层色</Text>
              <Text style={[styles.cell, styles.cellLayer, styles.headerText]}>编号</Text>
              <Text style={[styles.cell, styles.cellName, styles.headerText]}>名称</Text>
              <Text style={[styles.cell, styles.cellThickness, styles.headerText]}>厚度</Text>
              <View style={[styles.cell, styles.cellValue, styles.headerCellInline]}>
                <Text style={styles.headerText}>端阻力</Text>
                <View style={[styles.squeezeBadge, styles.squeezeBadgeJi]}>
                  <Text style={styles.squeezeBadgeText}>挤</Text>
                </View>
              </View>
              <View style={[styles.cell, styles.cellValue, styles.headerCellInline]}>
                <Text style={styles.headerText}>端阻力</Text>
                <View style={[styles.squeezeBadge, styles.squeezeBadgeKong]}>
                  <Text style={styles.squeezeBadgeText}>孔</Text>
                </View>
              </View>
            </View>

            {candidateLayers.length > 0 ? (
              candidateLayers.map(({ param, soil }, idx) => (
                <View key={`${param.layer}-${idx}`} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowEven]}>
                  <View style={[styles.cell, styles.cellColor]}>
                    <View style={[styles.colorDot, { backgroundColor: soil?.color || '#8B4513' }]} />
                  </View>
                  <Text style={[styles.cell, styles.cellLayer]}>{formatLayerDisplay(param.layer)}</Text>
                  <Text style={[styles.cell, styles.cellName]} numberOfLines={1}>
                    {String(
                      param.name ??
                        (soil as any)?.name ??
                        (soil as any)?.layer_name ??
                        (soil as any)?.soil_name ??
                        ''
                    )}
                  </Text>
                  <Text style={[styles.cell, styles.cellThickness]}>
                    {soil?.thickness == null
                      ? '-'
                      : (typeof soil.thickness === 'number' || typeof soil.thickness === 'string')
                        ? `${soil.thickness}`
                        : '-'}
                  </Text>
                  <Text style={[styles.cell, styles.cellValue]}>{param.end_bearing_prefab ?? '-'}</Text>
                  <Text style={[styles.cell, styles.cellValue]}>{param.end_bearing_drilled ?? '-'}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.cardText}>设计参数表中未发现端承力有值的土层。</Text>
            )}
          </View>
        </View>

        {/* 分隔线 */}
        <View style={styles.sectionDivider} />

        {/* 生成过程中显示加载状态 */}
        {adviceLoading ? (
          <View style={styles.adviceLoadingRow}>
            <ThinkingLoader />
            <Text style={styles.cardText}>AI正在分析并生成推荐方案...</Text>
          </View>
        ) : adviceError ? (
          /* 生成出错 */
          <View style={{ gap: 8 }}>
            <Text style={styles.cardText}>{adviceError}</Text>
            <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn]} onPress={retryGenerateAdvice}>
              <Text style={styles.actionPrimaryText}>重试生成</Text>
            </TouchableOpacity>
          </View>
        ) : displayRecommendations && displayRecommendations.length > 0 && bearingAdviceMarkdown?.trim() ? (
          /* 推荐方案和初步建议都生成完成后一起显示 */
          <View style={styles.card}>
            {/* 推荐方案 */}
            <Text style={styles.cardTitle}>推荐方案</Text>
            
            {displayRecommendations.map((rec, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.schemeCard,
                  selectedScheme === idx && styles.schemeCardSelected
                ]}
                onPress={() => setSelectedScheme(idx)}
              >
                <View style={styles.schemeHeader}>
                  <Text style={styles.schemeLayer}>{rec.display || formatLayerDisplay(rec.layer)}</Text>
                  <View style={styles.schemeScoreContainer}>
                    <Text style={styles.schemeScoreLabel}>端阻力:</Text>
                    {rec.end_bearing_prefab != null && (
                      <View style={styles.schemeScoreItem}>
                        <Text style={styles.schemeScoreValue}>{rec.end_bearing_prefab}</Text>
                        <View style={[styles.squeezeBadge, styles.squeezeBadgeJi]}>
                          <Text style={styles.squeezeBadgeText}>挤</Text>
                        </View>
                      </View>
                    )}
                    {rec.end_bearing_prefab != null && rec.end_bearing_drilled != null && (
                      <Text style={styles.schemeScoreDivider}>/</Text>
                    )}
                    {rec.end_bearing_drilled != null && (
                      <View style={styles.schemeScoreItem}>
                        <Text style={styles.schemeScoreValue}>{rec.end_bearing_drilled}</Text>
                        <View style={[styles.squeezeBadge, styles.squeezeBadgeKong]}>
                          <Text style={styles.squeezeBadgeText}>孔</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={styles.schemeReason}>{rec.reason || ''}</Text>
                <View style={styles.complianceTags}>
                  {(rec.tips || []).map((c: string, i: number) => (
                    <View key={i} style={styles.complianceTag}>
                      <Text style={styles.complianceTagText}>{c}</Text>
                    </View>
                  ))}
                </View>
                {rec.warning ? (
                  <View style={styles.warningTag}>
                    <Text style={styles.warningTagText}>注意: {rec.warning}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}

            {/* 初步建议（可展开/收起，默认收起） */}
            <View style={styles.adviceSection}>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  adviceExpanded ? null : styles.primaryBtn,
                  { marginTop: 16 }
                ]}
                onPress={() => setAdviceExpanded(v => !v)}
              >
                <Text style={adviceExpanded ? styles.actionText : styles.actionPrimaryText}>
                  {adviceExpanded ? '收起初步建议' : '展开初步建议'}
                </Text>
              </TouchableOpacity>

              {adviceExpanded && (
                <MarkdownAssistant
                  markdown={bearingAdviceMarkdown}
                  baseStyle={{ fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.90)' }}
                />
              )}
            </View>
          </View>
        ) : displayRecommendations && displayRecommendations.length > 0 ? (
          /* 只有推荐方案，没有初步建议（异常情况） */
          <View style={styles.card}>
            <Text style={styles.cardTitle}>推荐方案</Text>
            
            {displayRecommendations.map((rec, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.schemeCard,
                  selectedScheme === idx && styles.schemeCardSelected
                ]}
                onPress={() => setSelectedScheme(idx)}
              >
                <View style={styles.schemeHeader}>
                  <Text style={styles.schemeLayer}>{rec.display || formatLayerDisplay(rec.layer)}</Text>
                  <View style={styles.schemeScoreContainer}>
                    <Text style={styles.schemeScoreLabel}>端阻力:</Text>
                    {rec.end_bearing_prefab != null && (
                      <View style={styles.schemeScoreItem}>
                        <Text style={styles.schemeScoreValue}>{rec.end_bearing_prefab}</Text>
                        <View style={[styles.squeezeBadge, styles.squeezeBadgeJi]}>
                          <Text style={styles.squeezeBadgeText}>挤</Text>
                        </View>
                      </View>
                    )}
                    {rec.end_bearing_prefab != null && rec.end_bearing_drilled != null && (
                      <Text style={styles.schemeScoreDivider}>/</Text>
                    )}
                    {rec.end_bearing_drilled != null && (
                      <View style={styles.schemeScoreItem}>
                        <Text style={styles.schemeScoreValue}>{rec.end_bearing_drilled}</Text>
                        <View style={[styles.squeezeBadge, styles.squeezeBadgeKong]}>
                          <Text style={styles.squeezeBadgeText}>孔</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={styles.schemeReason}>{rec.reason || ''}</Text>
                <View style={styles.complianceTags}>
                  {(rec.tips || []).map((c: string, i: number) => (
                    <View key={i} style={styles.complianceTag}>
                      <Text style={styles.complianceTagText}>{c}</Text>
                    </View>
                  ))}
                </View>
                {rec.warning ? (
                  <View style={styles.warningTag}>
                    <Text style={styles.warningTagText}>注意: {rec.warning}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        ) : adviceReady && bearingAdviceMarkdown?.trim() ? (
          /* 初步建议已生成但推荐方案列表为空 - 直接展示建议 */
          <View style={styles.card}>
            <Text style={styles.cardTitle}>初步建议</Text>
            <MarkdownAssistant
              markdown={bearingAdviceMarkdown}
              baseStyle={{ fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.90)' }}
            />
          </View>
        ) : (
          <Text style={styles.cardText}>等待生成推荐方案。</Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  contentContainer: { paddingBottom: 120 },
  card: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 16,
  },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  cardText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 20 },
  adviceLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  actionBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionText: { color: '#fff', fontSize: 12 },
  primaryBtn: { backgroundColor: '#000000' },
  actionPrimaryText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  sectionDivider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 14,
    marginBottom: 14,
  },

  // 表格样式
  table: { marginTop: 8 },
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
  cellColor: { width: 24 },
  cellLayer: { width: 50 },
  cellName: { width: 80 },
  cellThickness: { width: 50 },
  cellValue: { width: 70 },
  headerText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700' },
  headerCellInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignSelf: 'center',
  },
  squeezeBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  squeezeBadgeJi: { backgroundColor: '#006636' },
  squeezeBadgeKong: { backgroundColor: '#B20000' },
  squeezeBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  // 方案卡片样式
  schemeCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  schemeCardSelected: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  schemeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  schemeLayer: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  schemeScore: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
  },
  schemeScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  schemeScoreLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    marginRight: 4,
  },
  schemeScoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  schemeScoreValue: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    marginRight: 2,
  },
  schemeScoreDivider: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    marginHorizontal: 4,
  },
  schemeReason: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  complianceTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  complianceTag: {
    backgroundColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  complianceTagText: {
    color: '#fff',
    fontSize: 11,
  },
  warningTag: {
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.5)',
    alignSelf: 'flex-start',
  },
  warningTagText: {
    color: '#FFC107',
    fontSize: 11,
  },

  // 初步建议样式
  adviceSection: {
    marginTop: 8,
  },
  adviceText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
});

export default BearingContent;
