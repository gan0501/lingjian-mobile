import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Text,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import Soil3DWebView from '../components/Soil3DWebView';
import { usePileComparisonContext } from '../PileComparisonContext';
import { pileComparisonApi } from '../pileComparisonApi';
import { calcCompressionCapacityQuk, calcTensionCapacity, getPileShapeInfo } from '../utils/pileCapacityCalc';
import { buildCompressionDerivationBlock, buildTensionDerivationBlock, buildSegmentThicknessBlock } from '../utils/pileCapacityFormula';
import PlanFaceCard from './PlanFaceCard';
import PriceDialog, { PileCityItem, PilePriceItem } from './PriceDialog';
import { useMapStore } from '@/stores/useMapStore';
import BearingLayerDialog from './BearingLayerDialog';
import LengthDialog from './LengthDialog';
import PileTypeDialog from './PileTypeDialog';
import CalcValidateDialog from './CalcValidateDialog';
import LoadElevationDialog from './LoadElevationDialog';
import { useComparisonReportGeneration } from './useComparisonReportGeneration';

const PlanContent: React.FC = () => {
  const {
    bidId,
    planResults,
    pileParameters,
    soilLayers,
    bearingRecommendations,
    projectOverview,
    comparisonReportGenerating,
  } = usePileComparisonContext();

  const [calcValidateOpen, setCalcValidateOpen] = useState(false);
  const [faceLoading, setFaceLoading] = useState<Record<FaceId, boolean>>({ A: false, B: false, C: false, D: false });

  const soil3dShotRef = useRef<ViewShot>(null);
  const soil3dSnapshotByFaceRef = useRef<Partial<Record<FaceId, string>>>({});

  const sanitizeSignedDecimalInput = (raw: string) => {
    const s0 = String(raw ?? '');
    const trimmed = s0.trim();
    const sign = trimmed.startsWith('-') ? '-' : trimmed.startsWith('+') ? '+' : '';
    const body = trimmed.replace(/[+-]/g, '').replace(/[^0-9.]/g, '');
    return `${sign}${body}`;
  };

  const formatSignedElevationDisplay = (raw: string) => {
    const s = sanitizeSignedDecimalInput(raw);
    if (!s) return '';
    const n = Number(s);
    if (!Number.isFinite(n)) return s;
    const fixed = Math.abs(n).toFixed(2);
    if (n < 0) return `-${fixed}`;
    return `+${fixed}`;
  };

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
    if (/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/.test(s)) return s;
    const key = normalizeLayerKey(s);
    if (!key) return s;
    const parts = key.split('-');
    const n = Number(parts[0]);
    if (!Number.isFinite(n) || n <= 0 || n >= circledDigits.length) return s;
    const head = circledDigits[n];
    return parts.length > 1 ? `${head}-${parts.slice(1).join('-')}` : head;
  };

  const availableBearingLayers = useMemo(() => {
    const ps = Array.isArray(pileParameters) ? pileParameters : [];
    const sls = Array.isArray(soilLayers) ? soilLayers : [];

    const soilLayerByKey = new Map<string, any>();
    sls.forEach((l: any) => {
      const k1 = normalizeLayerKey(l.id);
      const k3 = normalizeLayerKey(l.layer_number);
      if (k1) soilLayerByKey.set(k1, l);
      if (k3 && k3 !== k1) soilLayerByKey.set(k3, l);
    });

    const items = ps
      .filter((p: any) => {
        const endPrefab = Number(p.end_bearing_prefab ?? NaN);
        const endDrilled = Number(p.end_bearing_drilled ?? NaN);
        const hasPrefab = Number.isFinite(endPrefab) && endPrefab > 0;
        const hasDrilled = Number.isFinite(endDrilled) && endDrilled > 0;
        return hasPrefab || hasDrilled;
      })
      .map((p: any) => {
        const key = normalizeLayerKey(p.layer);
        if (!key) return null;
        const soil = soilLayerByKey.get(key) || null;
        const layerLabel = formatLayerDisplay(p.layer);
        const soilName = String(p.name ?? soil?.name ?? soil?.layer_name ?? soil?.soil_name ?? '').trim();
        return {
          key,
          label: layerLabel,
          name: soilName,
        };
      })
      .filter(Boolean) as { key: string; label: string; name: string }[];

    const seen = new Set<string>();
    const uniq: { key: string; label: string; name: string }[] = [];
    items.forEach((it) => {
      if (seen.has(it.key)) return;
      seen.add(it.key);
      uniq.push(it);
    });
    return uniq;
  }, [pileParameters, soilLayers]);

  type FaceId = 'A' | 'B' | 'C' | 'D';
  type FaceConfig = { 
    face: FaceId; 
    layerKey?: string; 
    enterDepthM?: string; 
    pileTopElevation?: string;
    columnLoadCompression?: string;
    columnLoadTension?: string;
  };

  type CompareRow = {
    pileType?: string;
    spec?: string;
    unitCost?: string;
    unitCostCity?: string;
    enterDepthMOverride?: string;
    tensionLength?: number;
    Quk?: number;
    Qsk?: number;
    length?: number | string;
    prestressedSelection?: {
      pile_type?: string;
      reference_standard?: string;
      strength_grade?: string;
      outer_diameter?: string;
      wall_thickness?: string;
      pile_model?: string;
      specification?: string;
      reinforcement_image_url?: string;
      pile_connection_image_url?: string;
      platform_connection_image_url?: string;
    };
  };

  const [faces, setFaces] = useState<FaceConfig[]>([
    { face: 'A' },
    { face: 'B' },
    { face: 'C' },
    { face: 'D' },
  ]);

  const [compareVisible, setCompareVisible] = useState<Record<FaceId, boolean>>({ A: false, B: false, C: false, D: false });
  const [compareRows, setCompareRows] = useState<Record<FaceId, CompareRow[]>>({
    A: [],
    B: [],
    C: [],
    D: [],
  });
  const [calculatedTimestamps, setCalculatedTimestamps] = useState<Record<FaceId, number>>({ A: 0, B: 0, C: 0, D: 0 });

  const reportVisibleByFace = useMemo(() => {
    const out: Record<FaceId, boolean> = { A: false, B: false, C: false, D: false };
    (faces || []).forEach((f) => {
      const face = f.face;
      const rows = compareRows?.[face] || [];
      out[face] = (rows || []).some((r: any) => {
        const quk = Number((r as any)?.Quk);
        const qsk = Number((r as any)?.Qsk);
        return (Number.isFinite(quk) && quk > 0) || (Number.isFinite(qsk) && qsk > 0);
      });
    });
    return out;
  }, [compareRows, faces]);

  const [faceCollapsed, setFaceCollapsed] = useState<Record<FaceId, boolean>>({ A: false, B: false, C: false, D: false });
  const [pinnedFace, setPinnedFace] = useState<FaceId | null>(null);

  const recommendedLayerOrder = useMemo(() => {
    const recs = Array.isArray(bearingRecommendations) ? bearingRecommendations : [];
    const out: string[] = [];
    recs.forEach((r: any) => {
      const k = normalizeLayerKey(r?.layer);
      if (!k) return;
      if (out.includes(k)) return;
      out.push(k);
    });
    return out;
  }, [bearingRecommendations]);

  const facesSortedByRecommendation = useMemo(() => {
    const order = recommendedLayerOrder;
    if (!order || order.length === 0) return faces;

    const orderIndex = new Map<string, number>();
    order.forEach((k, idx) => orderIndex.set(String(k), idx));

    return [...faces].sort((a, b) => {
      const ak = String(a.layerKey ?? '').trim();
      const bk = String(b.layerKey ?? '').trim();
      const ai = orderIndex.has(ak) ? (orderIndex.get(ak) as number) : Number.POSITIVE_INFINITY;
      const bi = orderIndex.has(bk) ? (orderIndex.get(bk) as number) : Number.POSITIVE_INFINITY;
      if (ai !== bi) return ai - bi;
      return 0;
    });
  }, [faces, recommendedLayerOrder]);

  const orderedFaces = useMemo(() => {
    const base = facesSortedByRecommendation;
    if (!pinnedFace) return base;
    const idx = base.findIndex((x) => x.face === pinnedFace);
    if (idx < 0) return base;
    const pinned = base[idx];
    return [pinned, ...base.slice(0, idx), ...base.slice(idx + 1)];
  }, [facesSortedByRecommendation, pinnedFace]);

  const handleAddCompareRow = useCallback((face: FaceId) => {
    setCompareVisible((prev) => ({
      ...prev,
      [face]: true,
    }));
    setCompareRows((prev) => {
      const next = { ...prev };
      const arr = [...(next[face] || [])];
      if (arr.length >= 8) return prev;
      if (arr.length === 0) {
        next[face] = [{}];
        return next;
      }
      next[face] = [...arr, {}];
      return next;
    });
  }, []);

  const [prestressedRows, setPrestressedRows] = useState<
    Array<{
      reference_standard?: string;
      pile_type?: string;
      strength_grade?: string;
      outer_diameter?: number | string;
      wall_thickness?: number | string;
      pile_model?: string;
      specification?: string;
      reinforcement_image_url?: string;
      pile_connection_image_url?: string;
      platform_connection_image_url?: string;
    }>
  >([]);

  const [pileModalOpen, setPileModalOpen] = useState(false);
  const [pilePickerKey, setPilePickerKey] = useState<
    null | 'pile_type' | 'reference_standard' | 'strength_grade' | 'outer_diameter' | 'wall_thickness' | 'pile_model'
  >(null);
  const pileAnchorLayoutRef = React.useRef<
    Partial<Record<'pile_type' | 'reference_standard' | 'strength_grade' | 'outer_diameter' | 'wall_thickness' | 'pile_model', { y: number; height: number }>>
  >({});
  const [pileOverlayTop, setPileOverlayTop] = useState<number>(0);
  const [editingCompareCell, setEditingCompareCell] = useState<{ face: FaceId; rowIndex: number } | null>(null);
  const [pileModalDraft, setPileModalDraft] = useState<{
    pile_type?: string;
    reference_standard?: string;
    strength_grade?: string;
    outer_diameter?: string;
    wall_thickness?: string;
    pile_model?: string;
  }>({});

  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [editingPriceCell, setEditingPriceCell] = useState<{ face: FaceId; rowIndex: number } | null>(null);
  const [priceDraftMarket, setPriceDraftMarket] = useState<string>('');
  const [priceDraftCity, setPriceDraftCity] = useState<string>('');
  const [priceDraftCityCode, setPriceDraftCityCode] = useState<string>('');
  const [priceCityMenuVisible, setPriceCityMenuVisible] = useState(false);

  // 信息价城市列表 + 查询结果
  const [pileCities, setPileCities] = useState<PileCityItem[]>([]);
  const [infoPriceLoading, setInfoPriceLoading] = useState(false);
  const [infoPriceList, setInfoPriceList] = useState<PilePriceItem[]>([]);
  const [infoPricePeriod, setInfoPricePeriod] = useState<string>('');
  const { userCity } = useMapStore();

  // 启动时加载桩基信息价城市列表
  useEffect(() => {
    (async () => {
      try {
        const res = await pileComparisonApi.getPileCities();
        const cities = (res as any)?.result?.cities || (res as any)?.cities || [];
        setPileCities(cities);

        // 默认匹配用户定位城市
        if (userCity && cities.length > 0) {
          const match = cities.find((c: PileCityItem) => {
            const uc = (userCity || '').replace(/市$/, '');
            const cc = (c.city || '').replace(/市$/, '');
            return uc === cc || cc.includes(uc) || uc.includes(cc);
          });
          if (match) {
            setPriceDraftCity(match.city);
            setPriceDraftCityCode(match.city_code);
          }
        }
      } catch (e) {
        console.warn('[PlanContent] 加载桩基信息价城市失败:', e);
      }
    })();
  }, []);

  // 查询指定城市的桩基信息价
  const fetchPilePrice = useCallback(async (cityCode: string, cityName?: string) => {
    if (!cityCode && !cityName) return;
    setInfoPriceLoading(true);
    setInfoPriceList([]);
    setInfoPricePeriod('');
    try {
      const res = await pileComparisonApi.getPilePrice({ city_code: cityCode, city_name: cityName });
      const result = (res as any)?.result || (res as any) || {};
      setInfoPriceList(result.data || []);
      setInfoPricePeriod(result.actual_period || '');
    } catch (e) {
      console.warn('[PlanContent] 查询桩基信息价失败:', e);
    } finally {
      setInfoPriceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!availableBearingLayers || availableBearingLayers.length === 0) return;

    const availableKeys = new Set(availableBearingLayers.map((x) => x.key));
    const preferred = (recommendedLayerOrder || []).filter((k) => availableKeys.has(String(k)));
    const fallback = availableBearingLayers.map((x) => x.key).filter((k) => !preferred.includes(k));
    const orderedDefaultKeys = [...preferred, ...fallback];

    setFaces((prev) => {
      // 只在初次/空置时填充默认前4个，避免用户已选择时被覆盖
      const next = prev.map((x, idx) => {
        if (x.layerKey) return x;
        const key = orderedDefaultKeys[idx];
        if (!key) return x;
        return { ...x, layerKey: key };
      });
      return next;
    });
  }, [availableBearingLayers, recommendedLayerOrder]);

  const layerByKey = useMemo(() => {
    const map = new Map<string, { key: string; label: string; name: string }>();
    availableBearingLayers.forEach((x) => map.set(x.key, x));
    return map;
  }, [availableBearingLayers]);

  const soilLayerByKey = useMemo(() => {
    const sls = Array.isArray(soilLayers) ? soilLayers : [];
    const map = new Map<string, any>();
    sls.forEach((l: any) => {
      const k1 = normalizeLayerKey(l.id);
      const k3 = normalizeLayerKey(l.layer_number);
      if (k1) map.set(k1, l);
      if (k3 && k3 !== k1) map.set(k3, l);
    });
    return map;
  }, [soilLayers]);

  const soilParamsByLayerForCalc = useMemo(() => {
    const ps = Array.isArray(pileParameters) ? pileParameters : [];
    const out: Record<
      string,
      {
        layerKey: string;
        thicknessM: number;
        sideFrictionPrefabKpa?: number;
        sideFrictionDrilledKpa?: number;
        endBearingPrefabKpa?: number;
        endBearingDrilledKpa?: number;
        upliftCoeffLambda?: number;
      }
    > = {};

    ps.forEach((p: any) => {
      const key = normalizeLayerKey(p.layer);
      if (!key) return;
      const soil = soilLayerByKey.get(key);
      const top = Number(soil?.top_elevation);
      const bottom = Number(soil?.bottom_elevation);
      const thicknessM =
        Number.isFinite(Number(soil?.thickness))
          ? Number(soil?.thickness)
          : Number.isFinite(top) && Number.isFinite(bottom)
            ? Math.abs(top - bottom)
            : 0;

      out[key] = {
        layerKey: key,
        thicknessM,
        sideFrictionPrefabKpa: Number(p.side_friction_prefab ?? NaN),
        sideFrictionDrilledKpa: Number(p.side_friction_drilled ?? NaN),
        endBearingPrefabKpa: Number(p.end_bearing_prefab ?? NaN),
        endBearingDrilledKpa: Number(p.end_bearing_drilled ?? NaN),
        upliftCoeffLambda: Number(p.uplift_coeff_lambda ?? NaN),
      };
    });

    return out;
  }, [pileParameters, soilLayerByKey]);

  const calcSegmentThicknessByLayer = (pileTopElevation: number, pileTipElevation: number) => {
    const sls = Array.isArray(soilLayers) ? soilLayers : [];
    const segs: Array<{ layerKey: string; lengthM: number }> = [];
    sls.forEach((l: any) => {
      const key = normalizeLayerKey(l.id) || normalizeLayerKey(l.layer_number);
      if (!key) return;
      const top = Number(l.top_elevation);
      const bottom = Number(l.bottom_elevation);
      if (!Number.isFinite(top) || !Number.isFinite(bottom)) return;
      const layerHigh = Math.max(top, bottom);
      const layerLow = Math.min(top, bottom);

      const high = Math.min(layerHigh, pileTopElevation);
      const low = Math.max(layerLow, pileTipElevation);
      const len = high - low;
      if (Number.isFinite(len) && len > 0) segs.push({ layerKey: key, lengthM: len });
    });
    return segs;
  };

  // 根据抗拔长度计算分段厚度（从桩顶往下截取指定长度）
  const calcTensionSegments = (fullSegments: Array<{ layerKey: string; lengthM: number }>, tensionLength: number) => {
    if (!tensionLength || tensionLength <= 0) return fullSegments;
    const result: Array<{ layerKey: string; lengthM: number }> = [];
    let remaining = tensionLength;
    for (const seg of fullSegments) {
      if (remaining <= 0) break;
      const len = Math.min(seg.lengthM, remaining);
      result.push({ layerKey: seg.layerKey, lengthM: len });
      remaining -= len;
    }
    return result;
  };

  const groundElevation = useMemo(() => {
    const raw = projectOverview?.ground_elevation;
    if (raw == null) {
      if (Array.isArray(soilLayers) && soilLayers.length > 0) {
        // Fallback to the first soil layer's top elevation if ground_elevation is completely missing
        const firstLayerTop = soilLayers[0]?.top_elevation;
        if (firstLayerTop != null) {
          const n = parseFloat(String(firstLayerTop).replace(/,/g, ''));
          if (Number.isFinite(n)) return n;
        }
      }
      return undefined;
    }
    const s = String(raw).replace(/[^0-9.-]/g, ''); // Remove non-numeric chars like 'm', '米', ' '
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : undefined;
  }, [projectOverview, soilLayers]);
  const calcSegmentThicknessByLayerForReport = useCallback(
    (pileTopElevation: number, pileTipElevation: number) => {
      const segs = calcSegmentThicknessByLayer(pileTopElevation, pileTipElevation);
      const out: Record<string, number> = {};
      (segs || []).forEach((s) => {
        const k = String((s as any)?.layerKey ?? '').trim();
        const len = Number((s as any)?.lengthM);
        if (!k) return;
        if (!Number.isFinite(len) || len <= 0) return;
        out[k] = (out[k] || 0) + len;
      });
      return out;
    },
    [calcSegmentThicknessByLayer]
  );

  const isValidUnitCost = useCallback((v: any) => {
    const s = String(v ?? '').trim().replace(/,/g, '');
    if (!s) return false;
    const n = Number(s);
    return Number.isFinite(n) && n > 0;
  }, []);

  const validateBeforeOpenReportConfirm = useCallback(
    (face: FaceId) => {
      const cfg = (faces || []).find((x) => x.face === face);
      const c0 = String((cfg as any)?.columnLoadCompression ?? '').trim();
      const t0 = String((cfg as any)?.columnLoadTension ?? '').trim();
      const c = c0 && Number.isFinite(Number(c0));
      const t = t0 && Number.isFinite(Number(t0));
      if (!c && !t) {
        return '生成对比报告前，请先填写柱下荷载（抗压/抗拔至少一项）';
      }
      return null;
    },
    [faces]
  );

  const buildCompressionCalcSheetMd = useCallback((args: any) => {
    const schemeIndex = (args as any)?.schemeIndex;
    const face = (args as any)?.face;
    const rowIndex = (args as any)?.rowIndex;
    const pileType = String((args as any)?.pileType ?? '').trim();
    const spec = String((args as any)?.spec ?? '').trim();
    const outerDiameterMm = Number((args as any)?.outerDiameterMm);
    const pileTopElevation = Number((args as any)?.pileTopElevation);
    const pileTipElevation = Number((args as any)?.pileTipElevation);
    const layerKeyAtPileTip = String((args as any)?.layerKeyAtPileTip ?? '').trim();
    const segs = (args as any)?.segs;
    const soil3dSnapshotUri = String((args as any)?.soil3dSnapshotUri ?? '').trim();
    const compressionDetail = (args as any)?.compressionDetail;

    const segBlock = buildSegmentThicknessBlock(segs);
    const calcBlock = buildCompressionDerivationBlock(compressionDetail);

    return (
      `#### 方案${schemeIndex}（${String(face)}）对比桩型${Number(rowIndex) + 1}\n\n` +
      `- 桩型：${pileType || '（空）'}\n` +
      `- 规格：${spec || '（空）'}\n` +
      `- 外径：${Number.isFinite(outerDiameterMm) ? outerDiameterMm : '（空）'} mm\n` +
      `- 桩顶标高：${Number.isFinite(pileTopElevation) ? pileTopElevation : '（空）'}\n` +
      `- 桩端标高：${Number.isFinite(pileTipElevation) ? pileTipElevation : '（空）'}\n` +
      `- 持力层：${layerKeyAtPileTip || '（空）'}\n` +
      `- 3D土层面截图：\n` +
      (soil3dSnapshotUri ? `[[FIGURE:3D土层面（${String(face)}面）|url=${soil3dSnapshotUri}]]\n` : `【待补充：3D土层面截图】\n`) +
      `- 分层入土段：` +
      segBlock +
      `- 计算过程：` +
      calcBlock
    );
  }, []);

  // 构建抗拔计算书 Markdown
  const buildTensionCalcSheetMd = useCallback((args: any) => {
    const schemeIndex = (args as any)?.schemeIndex;
    const face = (args as any)?.face;
    const rowIndex = (args as any)?.rowIndex;
    const pileType = String((args as any)?.pileType ?? '').trim();
    const spec = String((args as any)?.spec ?? '').trim();
    const outerDiameterMm = Number((args as any)?.outerDiameterMm);
    const pileTopElevation = Number((args as any)?.pileTopElevation);
    const pileTipElevation = Number((args as any)?.pileTipElevation);
    const layerKeyAtPileTip = String((args as any)?.layerKeyAtPileTip ?? '').trim();
    const segs = (args as any)?.segs;
    const soil3dSnapshotUri = String((args as any)?.soil3dSnapshotUri ?? '').trim();
    const tensionLength = Number((args as any)?.tensionLength);
    const tensionDetail = (args as any)?.tensionDetail;
    
    const pileLength = Number.isFinite(pileTopElevation) && Number.isFinite(pileTipElevation)
      ? Math.abs(pileTopElevation - pileTipElevation)
      : NaN;
    const displayTensionLength = Number.isFinite(tensionLength) && tensionLength > 0
      ? tensionLength
      : pileLength;

    const segBlock = buildSegmentThicknessBlock(segs);
    const calcBlock = buildTensionDerivationBlock(tensionDetail);

    return (
      `#### 方案${schemeIndex}（${String(face)}）对比桩型${Number(rowIndex) + 1} - 抗拔计算\n\n` +
      `- 桩型：${pileType || '（空）'}\n` +
      `- 规格：${spec || '（空）'}\n` +
      `- 外径：${Number.isFinite(outerDiameterMm) ? outerDiameterMm : '（空）'} mm\n` +
      `- 桩顶标高：${Number.isFinite(pileTopElevation) ? pileTopElevation : '（空）'}\n` +
      `- 桩端标高：${Number.isFinite(pileTipElevation) ? pileTipElevation : '（空）'}\n` +
      `- 持力层：${layerKeyAtPileTip || '（空）'}\n` +
      `- 抗拔长度：${Number.isFinite(displayTensionLength) ? displayTensionLength.toFixed(2) + 'm' : '通长（桩长）'}\n` +
      `- 3D土层面截图：\n` +
      (soil3dSnapshotUri ? `[[FIGURE:3D土层面（${String(face)}面）|url=${soil3dSnapshotUri}]]\n` : `【待补充：3D土层面截图】\n`) +
      `- 分层入土段（抗拔段）：` +
      segBlock +
      `- 抗拔计算过程：` +
      calcBlock
    );
  }, []);

  const calcCompressionDetailForReport = useCallback(
    (args: { pileType: string; outerDiameterMm: number; layerKeyAtPileTip: string; segsByLayer: Record<string, number> }) => {
      const pileType = String(args?.pileType ?? '').trim();
      const outerDiameterMm = Number(args?.outerDiameterMm);
      const layerKeyAtPileTip = String(args?.layerKeyAtPileTip ?? '').trim();
      const segsByLayer = args?.segsByLayer && typeof args.segsByLayer === 'object' ? args.segsByLayer : {};
      if (!pileType || !Number.isFinite(outerDiameterMm) || outerDiameterMm <= 0 || !layerKeyAtPileTip) return null;

      const segArr = Object.entries(segsByLayer)
        .map(([k, v]) => {
          const layerKey = String(k ?? '').trim();
          const lengthM = Number(v);
          if (!layerKey) return null;
          if (!Number.isFinite(lengthM) || lengthM <= 0) return null;
          return { layerKey, lengthM };
        })
        .filter(Boolean) as Array<{ layerKey: string; lengthM: number }>;

      if (segArr.length === 0) return null;

      const res = calcCompressionCapacityQuk({
        pileType,
        outerDiameterMm,
        layerKeyAtPileTip,
        segmentThicknessByLayer: segArr,
        soilParamsByLayer: soilParamsByLayerForCalc,
      });

      if (!res) return null;

      const info = getPileShapeInfo(pileType);
      const tipParam = (soilParamsByLayerForCalc as any)?.[layerKeyAtPileTip];
      const qpk =
        info && tipParam
          ? info.category === 'prefab'
            ? Number(tipParam.endBearingPrefabKpa)
            : Number(tipParam.endBearingDrilledKpa)
          : NaN;
      const qpkSafe = Number.isFinite(qpk) && qpk > 0 ? qpk : 0;

      const sideContributions = segArr.map((seg) => {
        const p = (soilParamsByLayerForCalc as any)?.[seg.layerKey];
        const qsikRaw =
          info && p
            ? info.category === 'prefab'
              ? Number(p.sideFrictionPrefabKpa)
              : Number(p.sideFrictionDrilledKpa)
            : NaN;
        const qsik = Number.isFinite(qsikRaw) && qsikRaw > 0 ? qsikRaw : 0;
        const li = Number(seg.lengthM);
        const Qi = Number.isFinite(li) && li > 0 ? res.u * qsik * li : NaN;
        return { layerKey: seg.layerKey, li, qsik, Qi };
      });

      return {
        u: res.u,
        Ap: res.Ap,
        betaC: (res as any)?.betaC,
        qsikWeightedAvgKpa: (res as any)?.qsikWeightedAvgKpa,
        qpk: qpkSafe,
        Qpk: res.Qpk,
        Qsk: res.Qsk,
        Quk: res.Quk,
        sideContributions,
      };
    },
    [soilParamsByLayerForCalc]
  );

  const getSoil3dSnapshotUri = useCallback((face: FaceId) => {
    return String((soil3dSnapshotByFaceRef.current as any)?.[face] ?? '').trim();
  }, []);

  // 抗拔计算详细过程（Ta = Tsk + Gp = Σ(λi × qsik × u × li) + Gp）
  const calcTensionDetailForReport = useCallback(
    (args: { pileType: string; outerDiameterMm: number; segsByLayer: Record<string, number> }) => {
      const pileType = String(args?.pileType ?? '').trim();
      const outerDiameterMm = Number(args?.outerDiameterMm);
      const segsByLayer = args?.segsByLayer && typeof args.segsByLayer === 'object' ? args.segsByLayer : {};
      if (!pileType || !Number.isFinite(outerDiameterMm) || outerDiameterMm <= 0) return null;

      const segArr = Object.entries(segsByLayer)
        .map(([k, v]) => {
          const layerKey = String(k ?? '').trim();
          const lengthM = Number(v);
          if (!layerKey) return null;
          if (!Number.isFinite(lengthM) || lengthM <= 0) return null;
          return { layerKey, lengthM };
        })
        .filter(Boolean) as Array<{ layerKey: string; lengthM: number }>;

      if (segArr.length === 0) return null;

      const res = calcTensionCapacity({
        pileType,
        outerDiameterMm,
        layerKeyAtPileTip: '', // 抗拔不需要桩端阻力
        segmentThicknessByLayer: segArr,
        soilParamsByLayer: soilParamsByLayerForCalc,
      });

      if (!res) return null;

      return {
        u: res.u,
        Ap: res.Ap,
        totalLength: res.totalLength,
        Tsk: res.Tsk,
        Gp: res.Gp,
        Ta: res.Ta,
        lambdaValues: res.lambdaValues,
        ...(res.betaC != null ? { betaC: res.betaC, qsikWeightedAvgKpa: res.qsikWeightedAvgKpa } : null),
      };
    },
    [soilParamsByLayerForCalc]
  );

  const { generateComparisonReport } = useComparisonReportGeneration<FaceId, CompareRow, FaceConfig>({
    faces,
    compareRows,
    soilLayerByKey,
    groundElevation,
    calcSegmentThicknessByLayer: calcSegmentThicknessByLayerForReport,
    buildCompressionCalcSheetMd,
    buildTensionCalcSheetMd,
    isValidUnitCost,
    getSoil3dSnapshotUri,
    calcCompressionDetailForReport,
    calcTensionDetailForReport,
  });

  const captureSoil3dSnapshot = useCallback(async () => {
    const ref = soil3dShotRef.current as any;
    if (!ref?.capture) return '';
    try {
      const uri0 = await ref.capture();
      const raw = String(uri0 || '').trim();
      if (!raw) return '';
      if (/^(file|content|http|https):\/\//i.test(raw)) return raw;
      if (raw.startsWith('/')) return `file://${raw}`;
      return raw;
    } catch {
      return '';
    }
  }, []);

  const handleGenerateComparisonReport = useCallback(
    async (face: FaceId) => {
      const uri = await captureSoil3dSnapshot();
      if (uri) {
        soil3dSnapshotByFaceRef.current = { ...(soil3dSnapshotByFaceRef.current || {}), [face]: uri };
      }
      await generateComparisonReport(face);
    },
    [captureSoil3dSnapshot, generateComparisonReport]
  );

  const comparePilesFor3D = useMemo(() => {
    const byFace: Partial<Record<FaceId, Array<{ lengthM: number; diameterMm: number; pileTopElevation: number; pileType: string }>>> = {
      A: [],
      B: [],
      C: [],
      D: [],
    };

    (faces || []).forEach((f) => {
      const face = f.face;
      const rows = (compareRows as any)?.[face] as CompareRow[] | undefined;
      if (!Array.isArray(rows) || rows.length === 0) return;

      const layerKey = f.layerKey;
      const layer = layerKey ? soilLayerByKey.get(layerKey) : null;
      const topElevationRaw = layer?.top_elevation;
      const topElevation = topElevationRaw != null ? Number(topElevationRaw) : NaN;
      const pileTop = f.pileTopElevation ? Number(f.pileTopElevation) : groundElevation != null && !Number.isNaN(Number(groundElevation)) ? Number(groundElevation) : NaN;

      rows.forEach((r) => {
        const pileType = String(r?.prestressedSelection?.pile_type ?? r?.pileType ?? '').trim();
        if (!pileType) return;
        const d0 = r?.prestressedSelection?.outer_diameter;
        const diameterMm = Number(d0);
        if (!Number.isFinite(diameterMm) || diameterMm <= 0) return;
        if (!Number.isFinite(pileTop)) return;
        if (!Number.isFinite(topElevation)) return;

        const enterDepthRaw = String(r?.enterDepthMOverride ?? f.enterDepthM ?? '').trim();
        const enterDepth = enterDepthRaw ? Number(enterDepthRaw) : 0;
        const lengthM = Math.max(0, pileTop - topElevation + (Number.isFinite(enterDepth) ? enterDepth : 0));
        if (!Number.isFinite(lengthM) || lengthM <= 0) return;

        const tensionLengthM = r?.tensionLength != null && Number.isFinite(Number(r.tensionLength)) && Number(r.tensionLength) > 0 ? Number(r.tensionLength) : undefined;
        (byFace as any)[face].push({ lengthM, diameterMm, pileTopElevation: pileTop, pileType, tensionLengthM });
      });
    });

    return byFace;
  }, [compareRows, faces, groundElevation, soilLayerByKey]);

  const pileWarningsFor3D = useMemo(() => {
    const warnings: string[] = [];
    const allFaces: FaceId[] = ['A', 'B', 'C', 'D'];
    allFaces.forEach((face) => {
      const rows = (compareRows as any)?.[face] as CompareRow[] | undefined;
      if (!Array.isArray(rows)) return;
      const f = (faces || []).find((ff) => ff.face === face);
      if (!f) return;

      const layerKey = f.layerKey;
      const layer = layerKey ? soilLayerByKey.get(layerKey) : null;
      const topElevation = layer?.top_elevation != null ? Number(layer.top_elevation) : NaN;
      const pileTop = f.pileTopElevation ? Number(f.pileTopElevation) : groundElevation != null ? Number(groundElevation) : NaN;

      rows.forEach((r) => {
        const sel: any = r?.prestressedSelection || {};
        const pileType = String(sel?.pile_type ?? r?.pileType ?? '').trim();
        const diameterMm = Number(sel?.outer_diameter);
        const spec = String(r?.spec ?? '').trim();
        if (!pileType || !spec) return;

        const quk = typeof r?.Quk === 'number' && Number.isFinite(r.Quk) ? r.Quk : null;
        const qsk = typeof r?.Qsk === 'number' && Number.isFinite(r.Qsk) ? r.Qsk : null;

        const qukUpperRaw = sel?.axial_compression_characteristic ?? sel?.axialCompressionCharacteristic ?? sel?.axial_compression_characteristic_value;
        const qskUpperRaw = sel?.axial_tension_characteristic ?? sel?.axialTensionCharacteristic ?? sel?.axial_tension_characteristic_value;
        const qukUpper = Number(qukUpperRaw);
        const qskUpper = Number(qskUpperRaw);

        // Check 1: Quk exceeds upper limit
        if (quk != null && Number.isFinite(qukUpper) && qukUpper > 0 && quk >= qukUpper) {
          warnings.push(`${face}. ${spec}：抗压值已达桩身极限(${Math.round(qukUpper)}kN)`);
        }

        // Check 2: Qsk exceeds upper limit
        if (qsk != null && Number.isFinite(qskUpper) && qskUpper > 0 && qsk >= qskUpper) {
          warnings.push(`${face}. ${spec}：抗拔值已达桩身极限(${Math.round(qskUpper)}kN)`);
        }

        // Check 3: pile length > D/10 (长细比 1:100)
        if (Number.isFinite(pileTop) && Number.isFinite(topElevation) && Number.isFinite(diameterMm) && diameterMm > 0) {
          const enterDepthRaw = String(r?.enterDepthMOverride ?? f.enterDepthM ?? '').trim();
          const enterDepth = enterDepthRaw ? Number(enterDepthRaw) : 0;
          const lengthM = pileTop - topElevation + (Number.isFinite(enterDepth) ? enterDepth : 0);
          const maxLength = diameterMm / 10;
          if (Number.isFinite(lengthM) && lengthM > maxLength) {
            warnings.push(`${face}. ${spec}：桩长超出长细比(1:100)`);
          }
        }
      });
    });
    return warnings;
  }, [compareRows, faces, groundElevation, soilLayerByKey]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await pileComparisonApi.getPrestressedPileParams();
        if (canceled) return;
        if (res && (res as any).success && Array.isArray((res as any).rows)) {
          setPrestressedRows((res as any).rows);
        } else {
          setPrestressedRows([]);
        }
      } catch {
        if (!canceled) setPrestressedRows([]);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const normalizeOptionValue = (v: any) => {
    const s = String(v ?? '').trim();
    return s;
  };

  const filteredPrestressedRows = useMemo(() => {
    const rows = Array.isArray(prestressedRows) ? prestressedRows : [];
    const d = pileModalDraft;
    return rows.filter((r) => {
      const pile_type = normalizeOptionValue(r.pile_type);
      const reference_standard = normalizeOptionValue(r.reference_standard);
      const strength_grade = normalizeOptionValue(r.strength_grade);
      const outer_diameter = normalizeOptionValue(r.outer_diameter);
      const wall_thickness = normalizeOptionValue(r.wall_thickness);
      const pile_model = normalizeOptionValue(r.pile_model);

      if (d.pile_type && pile_type !== d.pile_type) return false;
      if (d.reference_standard && reference_standard !== d.reference_standard) return false;
      if (d.strength_grade && strength_grade !== d.strength_grade) return false;
      if (d.outer_diameter && outer_diameter !== d.outer_diameter) return false;
      if (d.wall_thickness && wall_thickness !== d.wall_thickness) return false;
      if (d.pile_model && pile_model !== d.pile_model) return false;
      return true;
    });
  }, [pileModalDraft, prestressedRows]);

  const derivedSpecification = useMemo(() => {
    const specs = Array.from(
      new Set(
        filteredPrestressedRows
          .map((r: any) => normalizeOptionValue(r.specification))
          .filter((x: any) => !!x)
      )
    );
    if (specs.length === 1) return specs[0];
    return '';
  }, [filteredPrestressedRows, pileModalDraft]);

  const isPileKeyEnabled = useCallback(
    (
      key: 'pile_type' | 'reference_standard' | 'strength_grade' | 'outer_diameter' | 'wall_thickness' | 'pile_model'
    ) => {
      if (key === 'pile_type') return true;
      return !!String((pileModalDraft as any)?.pile_type ?? '').trim();
    },
    [pileModalDraft]
  );

  const applyPileDraftSelection = useCallback(
    (
      key: 'pile_type' | 'reference_standard' | 'strength_grade' | 'outer_diameter' | 'wall_thickness' | 'pile_model',
      value: string
    ) => {
      // 修改上游字段时，清空下游字段，保证严格联动与列表收敛
      const v = String(value ?? '').trim();
      if (key === 'pile_type') {
        setPileModalDraft({ pile_type: v });
        return;
      }
      if (key === 'reference_standard') {
        setPileModalDraft((prev) => ({ pile_type: prev.pile_type, reference_standard: v }));
        return;
      }
      if (key === 'strength_grade') {
        setPileModalDraft((prev) => ({
          pile_type: prev.pile_type,
          reference_standard: prev.reference_standard,
          strength_grade: v,
        }));
        return;
      }
      if (key === 'outer_diameter') {
        setPileModalDraft((prev) => ({
          pile_type: prev.pile_type,
          reference_standard: prev.reference_standard,
          strength_grade: prev.strength_grade,
          outer_diameter: v,
        }));
        return;
      }
      if (key === 'wall_thickness') {
        setPileModalDraft((prev) => ({
          pile_type: prev.pile_type,
          reference_standard: prev.reference_standard,
          strength_grade: prev.strength_grade,
          outer_diameter: prev.outer_diameter,
          wall_thickness: v,
        }));
        return;
      }
      if (key === 'pile_model') {
        setPileModalDraft((prev) => ({
          ...prev,
          pile_model: v,
        }));
      }
    },
    []
  );

  const getDropdownOptions = useCallback(
    (
      key:
        | 'pile_type'
        | 'reference_standard'
        | 'strength_grade'
        | 'outer_diameter'
        | 'wall_thickness'
        | 'pile_model'
    ) => {
      const rows = Array.isArray(prestressedRows) ? prestressedRows : [];
      const d = pileModalDraft;

      if (key !== 'pile_type' && !String(d?.pile_type ?? '').trim()) return [];

      const optionFilterFields: Record<
        'pile_type' | 'reference_standard' | 'strength_grade' | 'outer_diameter' | 'wall_thickness' | 'pile_model',
        Array<'pile_type' | 'reference_standard' | 'strength_grade' | 'outer_diameter' | 'wall_thickness' | 'pile_model'>
      > = {
        pile_type: [],
        reference_standard: ['pile_type'],
        strength_grade: ['pile_type', 'reference_standard'],
        outer_diameter: ['pile_type', 'reference_standard', 'strength_grade'],
        wall_thickness: ['pile_type', 'reference_standard', 'strength_grade', 'outer_diameter'],
        pile_model: ['pile_type', 'reference_standard', 'strength_grade', 'outer_diameter', 'wall_thickness'],
      };

      const filtered = rows.filter((r: any) => {
        const row: any = {
          pile_type: normalizeOptionValue(r.pile_type),
          reference_standard: normalizeOptionValue(r.reference_standard),
          strength_grade: normalizeOptionValue(r.strength_grade),
          outer_diameter: normalizeOptionValue(r.outer_diameter),
          wall_thickness: normalizeOptionValue(r.wall_thickness),
          pile_model: normalizeOptionValue(r.pile_model),
        };

        const mustMatch = optionFilterFields[key] || [];
        for (const f of mustMatch) {
          const want = normalizeOptionValue((d as any)?.[f]);
          if (want && row[f] !== want) return false;
        }
        return true;
      });

      const uniq = Array.from(
        new Set(
          filtered
            .map((r: any) => normalizeOptionValue(r[key]))
            .filter((x: any) => !!x)
        )
      );
      return uniq;
    },
    [pileModalDraft, prestressedRows]
  );

  const openPilePicker = useCallback(
    (key: 'pile_type' | 'reference_standard' | 'strength_grade' | 'outer_diameter' | 'wall_thickness' | 'pile_model') => {
      if (!isPileKeyEnabled(key)) return;
      const lay = (pileAnchorLayoutRef.current as any)?.[key];
      if (lay && Number.isFinite(lay.y) && Number.isFinite(lay.height)) {
        setPileOverlayTop(Math.max(0, Number(lay.y) + Number(lay.height)));
      } else {
        setPileOverlayTop(46);
      }
      setPilePickerKey(key);
    },
    [isPileKeyEnabled]
  );

  const openPileModalForRow = useCallback(
    (face: FaceId, rowIndex: number) => {
      const row = compareRows[face]?.[rowIndex];
      const sel = row?.prestressedSelection;
      setEditingCompareCell({ face, rowIndex });
      setPileModalDraft({
        pile_type: sel?.pile_type,
        reference_standard: sel?.reference_standard,
        strength_grade: sel?.strength_grade,
        outer_diameter: sel?.outer_diameter != null ? String(sel.outer_diameter) : undefined,
        wall_thickness: sel?.wall_thickness != null ? String(sel.wall_thickness) : undefined,
        pile_model: sel?.pile_model,
      });
      setPilePickerKey(null);
      setPileModalOpen(true);
    },
    [compareRows]
  );

  const confirmPileModal = useCallback(() => {
    if (!editingCompareCell) {
      setPileModalOpen(false);
      return;
    }
    const { face, rowIndex } = editingCompareCell;

    const rowsAll = Array.isArray(prestressedRows) ? prestressedRows : [];
    const normalizeKey = (v: any) => String(v ?? '').trim();

    const getOptionsForDraft = (
      draft: any,
      key: 'pile_type' | 'reference_standard' | 'strength_grade' | 'outer_diameter' | 'wall_thickness' | 'pile_model'
    ) => {
      const optionFilterFields: Record<
        'pile_type' | 'reference_standard' | 'strength_grade' | 'outer_diameter' | 'wall_thickness' | 'pile_model',
        Array<'pile_type' | 'reference_standard' | 'strength_grade' | 'outer_diameter' | 'wall_thickness' | 'pile_model'>
      > = {
        pile_type: [],
        reference_standard: ['pile_type'],
        strength_grade: ['pile_type', 'reference_standard'],
        outer_diameter: ['pile_type', 'reference_standard', 'strength_grade'],
        wall_thickness: ['pile_type', 'reference_standard', 'strength_grade', 'outer_diameter'],
        pile_model: ['pile_type', 'reference_standard', 'strength_grade', 'outer_diameter', 'wall_thickness'],
      };

      const filtered = rowsAll.filter((r: any) => {
        const row: any = {
          pile_type: normalizeOptionValue(r.pile_type),
          reference_standard: normalizeOptionValue(r.reference_standard),
          strength_grade: normalizeOptionValue(r.strength_grade),
          outer_diameter: normalizeOptionValue(r.outer_diameter),
          wall_thickness: normalizeOptionValue(r.wall_thickness),
          pile_model: normalizeOptionValue(r.pile_model),
        };

        const mustMatch = optionFilterFields[key] || [];
        for (const f of mustMatch) {
          const want = normalizeOptionValue((draft as any)?.[f]);
          if (want && row[f] !== want) return false;
        }
        return true;
      });

      return Array.from(
        new Set(
          filtered
            .map((r: any) => normalizeOptionValue(r[key]))
            .filter((x: any) => !!x)
        )
      );
    };

    // 允许只选部分：按联动顺序用每个列表的第一个补齐
    const completedDraft: any = { ...(pileModalDraft as any) };
    const fillIfEmpty = (k: any) => {
      const cur = String(completedDraft?.[k] ?? '').trim();
      if (cur) return;
      const opts = getOptionsForDraft(completedDraft, k);
      if (opts.length > 0) completedDraft[k] = opts[0];
    };
    fillIfEmpty('pile_type');
    fillIfEmpty('reference_standard');
    fillIfEmpty('strength_grade');
    fillIfEmpty('outer_diameter');
    fillIfEmpty('wall_thickness');
    fillIfEmpty('pile_model');

    const matchedRows = rowsAll.filter((r: any) => {
      if (completedDraft.pile_type && normalizeKey(r.pile_type) !== normalizeKey(completedDraft.pile_type)) return false;
      if (completedDraft.reference_standard && normalizeKey(r.reference_standard) !== normalizeKey(completedDraft.reference_standard)) return false;
      if (completedDraft.strength_grade && normalizeKey(r.strength_grade) !== normalizeKey(completedDraft.strength_grade)) return false;
      if (completedDraft.outer_diameter && normalizeKey(r.outer_diameter) !== normalizeKey(completedDraft.outer_diameter)) return false;
      if (completedDraft.wall_thickness && normalizeKey(r.wall_thickness) !== normalizeKey(completedDraft.wall_thickness)) return false;
      if (completedDraft.pile_model && normalizeKey(r.pile_model) !== normalizeKey(completedDraft.pile_model)) return false;
      return true;
    });

    const specCandidates = Array.from(
      new Set(
        matchedRows
          .map((r: any) => normalizeKey((r as any)?.specification))
          .filter((x: any) => !!x)
      )
    );
    const spec = specCandidates[0] || '';
    const matched = matchedRows.find((r: any) => !spec || normalizeKey((r as any).specification) === normalizeKey(spec));
    setCompareRows((prev) => {
      const next = { ...prev };
      const arr = [...(next[face] || [])];
      const r0: CompareRow = { ...(arr[rowIndex] || {}) };
      r0.pileType = completedDraft.pile_type || '';
      r0.spec = spec || '';
      r0.prestressedSelection = {
        ...(matched ? (matched as any) : completedDraft),
        specification: spec || (matched as any)?.specification || '',
      };
      arr[rowIndex] = r0;
      next[face] = arr;
      return next;
    });
    setPileModalOpen(false);
  }, [editingCompareCell, pileModalDraft, prestressedRows, normalizeOptionValue]);

  const openPriceModalForRow = useCallback(
    (face: FaceId, rowIndex: number) => {
      const row = compareRows[face]?.[rowIndex];
      setEditingPriceCell({ face, rowIndex });
      setPriceDraftMarket(row?.unitCost || '');
      const savedCity = row?.unitCostCity || '';
      setPriceDraftCity(savedCity || priceDraftCity);
      setPriceCityMenuVisible(false);
      setPriceModalOpen(true);

      // 如果有已选城市，自动查询信息价
      const code = priceDraftCityCode;
      if (code) {
        fetchPilePrice(code);
      } else if (savedCity) {
        // 通过城市名匹配城市代码
        const match = pileCities.find(c => c.city === savedCity);
        if (match) {
          setPriceDraftCityCode(match.city_code);
          fetchPilePrice(match.city_code);
        }
      }
    },
    [compareRows, priceDraftCity, priceDraftCityCode, pileCities, fetchPilePrice]
  );

  const confirmPriceModal = useCallback(() => {
    if (!editingPriceCell) {
      setPriceModalOpen(false);
      return;
    }
    const { face, rowIndex } = editingPriceCell;
    setCompareRows((prev) => {
      const next = { ...prev };
      const arr = [...(next[face] || [])];
      const r0: CompareRow = { ...(arr[rowIndex] || {}) };
      r0.unitCost = priceDraftMarket;
      r0.unitCostCity = priceDraftCity;
      arr[rowIndex] = r0;
      next[face] = arr;
      return next;
    });
    setPriceModalOpen(false);
  }, [editingPriceCell, priceDraftCity, priceDraftMarket]);

  const [layerMenuVisible, setLayerMenuVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFace, setEditingFace] = useState<FaceId>('A');
  const [draftLayerKey, setDraftLayerKey] = useState<string>('');
  const [draftEnterDepthM, setDraftEnterDepthM] = useState<string>('');
  const [layerEnterDepthMultiple, setLayerEnterDepthMultiple] = useState(false);

  const [lengthModalOpen, setLengthModalOpen] = useState(false);
  const [loadElevationModalOpen, setLoadElevationModalOpen] = useState(false);
  const [editingLoadElevationFace, setEditingLoadElevationFace] = useState<FaceId | null>(null);
  const [draftLoadElevationTop, setDraftLoadElevationTop] = useState<string>('');
  const [draftLoadElevationCompression, setDraftLoadElevationCompression] = useState<string>('');
  const [draftLoadElevationTension, setDraftLoadElevationTension] = useState<string>('');
  const [editingLengthCell, setEditingLengthCell] = useState<{ face: FaceId; rowIndex: number } | null>(null);
  const [draftTensionLength, setDraftTensionLength] = useState<string>('');
  const [draftLengthEnterDepthM, setDraftLengthEnterDepthM] = useState<string>('');
  const [maxTensionLengthForDialog, setMaxTensionLengthForDialog] = useState<number>(0);

  const openLayerModal = useCallback(
    (face: FaceId) => {
      setEditingFace(face);
      const cfg = faces.find((x) => x.face === face);
      setDraftLayerKey(cfg?.layerKey || '');
      const baseEnter = cfg?.enterDepthM || '';
      const rows = compareRows[face] || [];
      const values = new Set<string>();
      rows.forEach((r) => {
        values.add(String(r.enterDepthMOverride ?? baseEnter ?? '').trim());
      });
      if (rows.length === 0) values.add(String(baseEnter ?? '').trim());
      const uniq = Array.from(values);
      const isMultiple = uniq.length > 1;
      setLayerEnterDepthMultiple(isMultiple);
      setDraftEnterDepthM(isMultiple ? '' : String(uniq[0] ?? '').trim());
      setLayerMenuVisible(false);
      setModalOpen(true);
    },
    [compareRows, faces]
  );

  const confirmLayerModal = useCallback(() => {
    const nextEnter = String(draftEnterDepthM ?? '').trim();
    const shouldApplyEnterDepth = nextEnter !== '';
    setFaces((prev) =>
      prev.map((x) =>
        x.face === editingFace
          ? {
              ...x,
              layerKey: draftLayerKey || undefined,
              ...(shouldApplyEnterDepth ? { enterDepthM: nextEnter } : null),
            }
          : x
      )
    );
    if (shouldApplyEnterDepth) {
      setCompareRows((prev) => {
        const next = { ...prev };
        next[editingFace] = (next[editingFace] || []).map((r) => ({ ...r, enterDepthMOverride: undefined }));
        return next;
      });
    }
    setModalOpen(false);
  }, [draftEnterDepthM, draftLayerKey, editingFace]);

  const openLengthModal = useCallback(
    (face: FaceId, rowIndex: number) => {
      setEditingLengthCell({ face, rowIndex });
      const cfg = faces.find((x) => x.face === face);
      const row = compareRows[face]?.[rowIndex];
      
      // 计算桩长作为最大抗拔长度
      const layerKey = cfg?.layerKey;
      const layer = layerKey ? soilLayerByKey.get(layerKey) : null;
      const topElevationRaw = layer?.top_elevation;
      const topElevation = topElevationRaw != null ? Number(topElevationRaw) : NaN;
      const pileTop = cfg?.pileTopElevation ? Number(cfg.pileTopElevation) : groundElevation != null && !Number.isNaN(Number(groundElevation)) ? Number(groundElevation) : NaN;
      const enterDepthRaw = String(row?.enterDepthMOverride ?? cfg?.enterDepthM ?? '').trim();
      const enterDepth = enterDepthRaw ? Number(enterDepthRaw) : 0;
      const pileLength = Number.isFinite(pileTop) && Number.isFinite(topElevation)
        ? Math.max(0, pileTop - topElevation + (Number.isFinite(enterDepth) ? enterDepth : 0))
        : 0;
      setMaxTensionLengthForDialog(pileLength);
      
      // 设置抗拔长度默认值（如果有）
      const tensionLen = row?.tensionLength;
      setDraftTensionLength(tensionLen != null && Number.isFinite(tensionLen) ? String(tensionLen) : '');
      setDraftLengthEnterDepthM(String(row?.enterDepthMOverride ?? cfg?.enterDepthM ?? ''));
      setLengthModalOpen(true);
    },
    [compareRows, faces, groundElevation, soilLayerByKey]
  );

  const confirmLengthModal = useCallback(() => {
    if (!editingLengthCell) {
      setLengthModalOpen(false);
      return;
    }
    const { face, rowIndex } = editingLengthCell;
    let tensionLenStr = String(draftTensionLength ?? '').trim();
    let enter = String(draftLengthEnterDepthM ?? '').trim();

    const cfg = faces.find((x) => x.face === face);
    const layerKey = cfg?.layerKey;
    const layer = layerKey ? soilLayerByKey.get(layerKey) : null;
    const topElevation = layer?.top_elevation != null ? Number(layer.top_elevation) : NaN;
    const bottomElevation = layer?.bottom_elevation != null ? Number(layer.bottom_elevation) : NaN;
    const thicknessRaw =
      typeof layer?.thickness === 'number'
        ? layer.thickness
        : Number.isFinite(topElevation) && Number.isFinite(bottomElevation)
          ? Math.abs(topElevation - bottomElevation)
          : null;
    const enterNum = enter ? Number(enter) : NaN;
    if (thicknessRaw != null && Number.isFinite(enterNum) && enterNum > thicknessRaw) {
      enter = String(thicknessRaw);
    }

    // 计算当前桩长
    const pileTop = cfg?.pileTopElevation ? Number(cfg.pileTopElevation) : groundElevation != null && !Number.isNaN(Number(groundElevation)) ? Number(groundElevation) : NaN;
    const enterDepth = enter ? Number(enter) : 0;
    const pileLength = Number.isFinite(pileTop) && Number.isFinite(topElevation)
      ? Math.max(0, pileTop - topElevation + (Number.isFinite(enterDepth) ? enterDepth : 0))
      : 0;

    // 校验抗拔长度不能超过桩长
    let tensionLenNum = tensionLenStr ? Number(tensionLenStr) : NaN;
    if (Number.isFinite(tensionLenNum)) {
      if (tensionLenNum > pileLength) {
        tensionLenNum = pileLength;
      }
      if (tensionLenNum <= 0) {
        tensionLenNum = NaN;
      }
    }

    setCompareRows((prev) => {
      const next = { ...prev };
      const arr = [...(next[face] || [])];
      const r0: CompareRow = { ...(arr[rowIndex] || {}) };
      const baseEnter = String(cfg?.enterDepthM ?? '').trim();
      r0.enterDepthMOverride = enter && enter !== baseEnter ? enter : undefined;
      // 存储抗拔长度，为空则表示使用默认值（通长）
      r0.tensionLength = Number.isFinite(tensionLenNum) ? tensionLenNum : undefined;
      arr[rowIndex] = r0;
      next[face] = arr;
      return next;
    });
    setLengthModalOpen(false);
  }, [draftLengthEnterDepthM, draftTensionLength, editingLengthCell, faces, groundElevation, soilLayerByKey]);

  const openLoadElevationModal = useCallback(
    (face: FaceId) => {
      setEditingLoadElevationFace(face);
      const cfg = faces.find((x) => x.face === face);
      const ge = groundElevation != null && !Number.isNaN(Number(groundElevation)) ? Number(groundElevation) : undefined;
      const defaultTop = cfg?.pileTopElevation ?? (ge != null ? String(ge) : '');
      setDraftLoadElevationTop(formatSignedElevationDisplay(defaultTop));
      setDraftLoadElevationCompression(cfg?.columnLoadCompression ?? '');
      setDraftLoadElevationTension(cfg?.columnLoadTension ?? '');
      setLoadElevationModalOpen(true);
    },
    [faces, formatSignedElevationDisplay, groundElevation]
  );

  const confirmLoadElevationModal = useCallback(() => {
    if (!editingLoadElevationFace) {
      setLoadElevationModalOpen(false);
      return;
    }
    const face = editingLoadElevationFace;
    const top = formatSignedElevationDisplay(sanitizeSignedDecimalInput(draftLoadElevationTop));
    const compression = draftLoadElevationCompression.trim();
    const tension = draftLoadElevationTension.trim();

    setFaces((prev) =>
      prev.map((x) =>
        x.face === face
          ? {
              ...x,
              pileTopElevation: top,
              columnLoadCompression: compression || undefined,
              columnLoadTension: tension || undefined,
            }
          : x
      )
    );
    setLoadElevationModalOpen(false);
  }, [draftLoadElevationCompression, draftLoadElevationTension, draftLoadElevationTop, editingLoadElevationFace, formatSignedElevationDisplay, sanitizeSignedDecimalInput]);

  const confirmLoadElevationModalWithPayload = useCallback(
    (payload: { pileTopElevationValue: string; columnLoadCompression: string; columnLoadTension: string }) => {
      if (!editingLoadElevationFace) {
        setLoadElevationModalOpen(false);
        return;
      }
      const face = editingLoadElevationFace;
      const top = formatSignedElevationDisplay(sanitizeSignedDecimalInput(payload.pileTopElevationValue));
      const compression = String(payload.columnLoadCompression || '').trim();
      const tension = String(payload.columnLoadTension || '').trim();

      setFaces((prev) =>
        prev.map((x) =>
          x.face === face
            ? {
                ...x,
                pileTopElevation: top,
                columnLoadCompression: compression || undefined,
                columnLoadTension: tension || undefined,
              }
            : x
        )
      );
      setLoadElevationModalOpen(false);
    },
    [editingLoadElevationFace, formatSignedElevationDisplay, sanitizeSignedDecimalInput]
  );

  const handleStartCalculation = useCallback(async (face: FaceId) => {
    if (!bidId) return;

    const hasAnyCompleteRow = Object.values(compareRows || {}).some((rows) =>
      (rows || []).some((r) => {
        const pileType = String(r?.pileType ?? '').trim();
        const spec = String(r?.spec ?? '').trim();
        return !!pileType && !!spec;
      })
    );

    if (!hasAnyCompleteRow) {
      setCalcValidateOpen(true);
      return;
    }

    setCompareRows((prev) => {
      const next: any = { ...prev };
      (faces || []).forEach((f) => {
        const face = f.face;
        const layerKey = String(f.layerKey ?? '').trim();
        if (!layerKey) return;
        const layer = soilLayerByKey.get(layerKey);
        const topElevation = Number(layer?.top_elevation);
        if (!Number.isFinite(topElevation)) return;

        const pileTop = f.pileTopElevation ? Number(f.pileTopElevation) : groundElevation != null && !Number.isNaN(Number(groundElevation)) ? Number(groundElevation) : NaN;
        if (!Number.isFinite(pileTop)) return;

        const arr = [...(next[face] || [])];
        arr.forEach((r: CompareRow, rowIndex: number) => {
          const pileType = String(r?.prestressedSelection?.pile_type ?? r?.pileType ?? '').trim();
          const spec = String(r?.spec ?? '').trim();
          if (!pileType || !spec) {
            arr[rowIndex] = { ...(arr[rowIndex] || {}), Quk: undefined, Qsk: undefined };
            return;
          }

          const shapeInfo = getPileShapeInfo(pileType);
          if (!shapeInfo) {
            arr[rowIndex] = { ...(arr[rowIndex] || {}), Quk: undefined, Qsk: undefined };
            return;
          }

          const d0 = r?.prestressedSelection?.outer_diameter;
          const outerDiameterMm = Number(d0);
          if (!Number.isFinite(outerDiameterMm) || outerDiameterMm <= 0) {
            arr[rowIndex] = { ...(arr[rowIndex] || {}), Quk: undefined, Qsk: undefined };
            return;
          }

          const enterDepthRaw = String(r?.enterDepthMOverride ?? f.enterDepthM ?? '').trim();
          const enterDepth = enterDepthRaw ? Number(enterDepthRaw) : 0;
          const pileTipElevation = topElevation - (Number.isFinite(enterDepth) ? enterDepth : 0);
          const segs = calcSegmentThicknessByLayer(pileTop, pileTipElevation);

          const res = calcCompressionCapacityQuk({
            pileType,
            outerDiameterMm,
            layerKeyAtPileTip: layerKey,
            segmentThicknessByLayer: segs,
            soilParamsByLayer: soilParamsByLayerForCalc,
          });

          let Quk = res && Number.isFinite(res.Quk) ? res.Quk : undefined;
          // 抗拔值 Qsk 计算：使用 calcTensionCapacity（含λ抗拔系数）
          // 公式：Ta = Tsk + Gp = Σ(λi × qsik × u × li) + Gp
          let Qsk: number | undefined;
          const userTensionLength = r?.tensionLength;
          const tensionSegsForCalc = (Number.isFinite(userTensionLength) && (userTensionLength as number) > 0)
            ? calcTensionSegments(segs, userTensionLength as number)
            : segs;
          const tensionRes = calcTensionCapacity({
            pileType,
            outerDiameterMm,
            layerKeyAtPileTip: layerKey,
            segmentThicknessByLayer: tensionSegsForCalc,
            soilParamsByLayer: soilParamsByLayerForCalc,
          });
          Qsk = tensionRes && Number.isFinite(tensionRes.Ta) ? tensionRes.Ta : undefined;

          const sel: any = r?.prestressedSelection || {};
          const qukUpperRaw =
            sel?.axial_compression_characteristic ??
            sel?.axialCompressionCharacteristic ??
            sel?.axial_compression_characteristic_value ??
            sel?.axialCompressionCharacteristicValue;
          const qskUpperRaw =
            sel?.axial_tension_characteristic ??
            sel?.axialTensionCharacteristic ??
            sel?.axial_tension_characteristic_value ??
            sel?.axialTensionCharacteristicValue;

          const qukUpper = Number(qukUpperRaw);
          const qskUpper = Number(qskUpperRaw);

          if (Quk != null && Number.isFinite(qukUpper) && qukUpper > 0) {
            Quk = Math.min(Quk, qukUpper);
          }
          if (Qsk != null && Number.isFinite(qskUpper) && qskUpper > 0) {
            Qsk = Math.min(Qsk, qskUpper);
          }

          arr[rowIndex] = { ...(arr[rowIndex] || {}), Quk, Qsk };
        });
        next[face] = arr;
      });
      return next;
    });

    const now = Date.now();
    setCalculatedTimestamps({ A: now, B: now, C: now, D: now });
    setFaceLoading((prev) => ({ ...prev, [face]: true }));
    try {
      await pileComparisonApi.startPileCalculation(bidId);
    } catch (e: any) {
      const errorMsg = e?.message || '计算失败';
      console.error('启动计算失败:', e);
      Alert.alert('计算失败', '请重试');
    } finally {
      setTimeout(() => setFaceLoading((prev) => ({ ...prev, [face]: false })), 1200);
    }
  }, [bidId, compareRows, faces, groundElevation, soilLayerByKey, soilParamsByLayerForCalc]);
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <ViewShot ref={soil3dShotRef} options={{ format: 'png', quality: 0.92 }}>
          <Soil3DWebView comparePiles={comparePilesFor3D} pileWarnings={pileWarningsFor3D} showBearingMarkers showLayerLabels={false} />
        </ViewShot>

        <View style={{ gap: 10 }}>
          {orderedFaces.map((f, index) => {
            const layer = f.layerKey ? layerByKey.get(f.layerKey) : undefined;
            const layerText = layer ? `${layer.label} ${layer.name ? ` ${layer.name}` : ''}`.trim() : '未选择持力层';
            const collapsed = !!faceCollapsed[f.face];
            const schemeIndex = Math.max(0, faces.findIndex((x) => x.face === f.face)) + 1;
            const isPinned = index === 0;
            return (
              <View key={f.face}>
                <PlanFaceCard<FaceId, FaceConfig, CompareRow>
                  faceConfig={f}
                  layerText={layerText}
                  collapsed={collapsed}
                  schemeIndex={schemeIndex}
                  isPinned={isPinned}
                  planResults={planResults}
                  compareVisible={!!compareVisible[f.face]}
                  reportVisible={!!reportVisibleByFace[f.face]}
                  compareRows={compareRows[f.face] || []}
                  soilLayerByKey={soilLayerByKey}
                  groundElevation={groundElevation}
                  loading={faceLoading[f.face] || false}
                  styles={styles}
                  formatSignedElevationDisplay={formatSignedElevationDisplay}
                  comparisonReportGenerating={comparisonReportGenerating}
                  isValidUnitCost={isValidUnitCost}
                  onGenerateComparisonReport={handleGenerateComparisonReport}
                  validateBeforeOpenReportConfirm={validateBeforeOpenReportConfirm}
                  onTogglePin={(face) => setPinnedFace((prev) => (prev === face ? null : face))}
                  onOpenLayerModal={openLayerModal}
                  onToggleCollapsed={(face) =>
                    setFaceCollapsed((prev) => ({
                      ...prev,
                      [face]: !prev[face],
                    }))
                  }
                  onAddCompareRow={handleAddCompareRow}
                  onStartCalculation={() => handleStartCalculation(f.face)}
                  onPressPile={openPileModalForRow}
                  onPressLength={openLengthModal}
                  onPressUnitCost={openPriceModalForRow}
                  onOpenLoadElevationModal={openLoadElevationModal}
                  lastCalculatedAt={calculatedTimestamps[f.face]}
                />
              </View>
            );
          })}
        </View>

        <BearingLayerDialog
          visible={modalOpen}
          styles={styles}
          layerMenuVisible={layerMenuVisible}
          availableBearingLayers={availableBearingLayers}
          layerLabelText={
            draftLayerKey && layerByKey.get(draftLayerKey)
              ? `${layerByKey.get(draftLayerKey)?.label} ${layerByKey.get(draftLayerKey)?.name || ''}`.trim()
              : availableBearingLayers.length === 0
                ? '暂无可用持力层'
                : '请选择持力层'
          }
          enterDepthValue={draftEnterDepthM}
          enterDepthPlaceholder={layerEnterDepthMultiple ? '多个数值' : undefined}
          onChangeEnterDepth={(t) => setDraftEnterDepthM(t.replace(/[^0-9.]/g, ''))}
          onOpenLayerMenu={() => setLayerMenuVisible(true)}
          onDismissLayerMenu={() => setLayerMenuVisible(false)}
          onSelectLayerKey={(key) => setDraftLayerKey(key)}
          onDismiss={() => setModalOpen(false)}
          onConfirm={confirmLayerModal}
          confirmDisabled={availableBearingLayers.length > 0 && !draftLayerKey}
        />

        <LengthDialog
          visible={lengthModalOpen}
          styles={styles}
          tensionLengthValue={draftTensionLength}
          enterDepthValue={draftLengthEnterDepthM}
          maxTensionLength={maxTensionLengthForDialog}
          onChangeTensionLength={(t) => {
            // 只允许输入数字和小数点
            const filtered = t.replace(/[^0-9.]/g, '');
            // 限制不能超过桩长
            const num = filtered ? Number(filtered) : NaN;
            if (Number.isFinite(num) && num > maxTensionLengthForDialog) {
              setDraftTensionLength(String(maxTensionLengthForDialog));
            } else {
              setDraftTensionLength(filtered);
            }
          }}
          onChangeEnterDepth={(t) => setDraftLengthEnterDepthM(t.replace(/[^0-9.]/g, ''))}
          onDismiss={() => setLengthModalOpen(false)}
          onConfirm={confirmLengthModal}
        />

        <PileTypeDialog
          visible={pileModalOpen}
          styles={styles}
          derivedSpecification={derivedSpecification}
          pileModalDraft={pileModalDraft}
          pilePickerKey={pilePickerKey as any}
          pileOverlayTop={pileOverlayTop}
          getDropdownOptions={getDropdownOptions as any}
          applyPileDraftSelection={applyPileDraftSelection as any}
          onRequestClosePicker={() => setPilePickerKey(null)}
          onOpenPicker={openPilePicker as any}
          onRegisterAnchorLayout={(key, y, height) => {
            (pileAnchorLayoutRef.current as any)[key] = { y, height };
          }}
          onDismiss={() => setPileModalOpen(false)}
          onDelete={() => {
            if (!editingCompareCell) {
              setPileModalOpen(false);
              return;
            }
            const { face, rowIndex } = editingCompareCell;
            setCompareRows((prev) => {
              const next = { ...prev };
              const arr = [...(next[face] || [])];
              if (rowIndex < 0 || rowIndex >= arr.length) return prev;
              arr.splice(rowIndex, 1);
              next[face] = arr;
              if (arr.length === 0) {
                setCompareVisible((v) => ({ ...v, [face]: false }));
              }
              return next;
            });
            setPileModalOpen(false);
          }}
          onConfirm={confirmPileModal}
        />

        <PriceDialog
          visible={priceModalOpen}
          styles={styles}
          marketValue={priceDraftMarket}
          cityValue={priceDraftCity}
          cityMenuVisible={priceCityMenuVisible}
          cityOptions={pileCities}
          infoPriceLoading={infoPriceLoading}
          infoPricePeriod={infoPricePeriod}
          infoPriceList={infoPriceList}
          onChangeMarket={(t) => setPriceDraftMarket(t.replace(/[^0-9.]/g, ''))}
          onOpenCityMenu={() => setPriceCityMenuVisible(true)}
          onDismissCityMenu={() => setPriceCityMenuVisible(false)}
          onSelectCity={(cityName, cityCode) => {
            setPriceDraftCity(cityName);
            setPriceDraftCityCode(cityCode);
            fetchPilePrice(cityCode);
          }}
          onSelectPriceItem={(price) => {
            setPriceDraftMarket(price);
          }}
          onDismiss={() => setPriceModalOpen(false)}
          onConfirm={confirmPriceModal}
        />

        <CalcValidateDialog visible={calcValidateOpen} styles={styles} onDismiss={() => setCalcValidateOpen(false)} />

        <LoadElevationDialog
          visible={loadElevationModalOpen}
          styles={styles}
          pileTopElevationValue={draftLoadElevationTop}
          columnLoadCompression={draftLoadElevationCompression}
          columnLoadTension={draftLoadElevationTension}
          groundElevation={groundElevation}
          onDismiss={() => setLoadElevationModalOpen(false)}
          onConfirm={confirmLoadElevationModalWithPayload}
        />

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  contentContainer: { paddingBottom: 120 },
  card: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardHeaderRowCollapsed: { marginBottom: 0 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cardText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 20 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  pinBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinEmoji: { color: '#fff', fontSize: 14, lineHeight: 16 },
  pinEmojiActive: { color: '#000' },
  pinIcon: { width: 18, height: 18, resizeMode: 'contain' as const },
  layerChipHeader: {
    maxWidth: 180,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  layerChipHeaderText: { color: '#fff', fontSize: 10, fontWeight: '400' },
  faceBadge: { backgroundColor: '#000', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
  faceBadgeCollapsed: { backgroundColor: '#CCCCCC' },
  faceBadgeText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  faceBadgeTextCollapsed: { color: '#000' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  rowLeftGroup: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  centerInfoGroup: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  leftGroupWithInfo: { flexDirection: 'row', alignItems: 'center', gap: 0, flexShrink: 1 },
  infoStack: { flexDirection: 'column', justifyContent: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 1 },
  topElevationText: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '400', flexShrink: 1 },
  columnLoadText: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '400', flexShrink: 1 },
  rightAlignedBtn: { marginRight: 0 },
  actionBtn: {
    backgroundColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 10,
  },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  addCompareBtn: { backgroundColor: '#CCCCCC', borderRadius: 4, paddingHorizontal: 8 },
  addCompareBtnText: { color: '#000', fontSize: 10 },
  primaryBtn: { backgroundColor: '#B20000' },
  actionPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  genAdviceBtn: { marginRight: 0 },
  genAdviceBtnDisabled: { opacity: 0.6 },
  dangerBtn: { backgroundColor: '#B20000' },
  dangerText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  modalCard: { backgroundColor: '#fff' },
  modalTitle: { color: '#111' },
  confirmModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmModal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  confirmModalTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 6 },
  confirmModalSubtitle: { fontSize: 12, fontWeight: '600', color: 'rgba(0,0,0,0.6)', marginBottom: 12 },
  confirmCheckList: { gap: 10, marginBottom: 14 },
  confirmCheckItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  confirmCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  confirmCheckboxChecked: { backgroundColor: '#B20000', borderColor: '#B20000' },
  confirmCheckText: { fontSize: 12, fontWeight: '600', color: '#111', flexShrink: 1 },
  confirmModalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  confirmModalCancelBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F2F2F2' },
  confirmModalCancelText: { fontSize: 12, fontWeight: '700', color: '#111' },
  confirmModalConfirmBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#B20000' },
  confirmModalConfirmBtnDisabled: { opacity: 0.45 },
  confirmModalConfirmText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  confirmModalConfirmTextDisabled: { color: 'rgba(255,255,255,0.95)' },
  dropdownAnchor: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  dropdownText: { color: '#111', fontSize: 13, fontWeight: '700' },
  dropdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownArrow: { color: 'rgba(0,0,0,0.55)', fontSize: 12, marginLeft: 10 },
  menuContent: { maxHeight: 320 },
  pileModalDesc: { color: '#111', fontSize: 13, fontWeight: '700' },
  pileModalActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 },
  pileModalActionsRight: { flexDirection: 'row', alignItems: 'center' },
  pileDialogContentHost: {
    position: 'relative',
    minHeight: 320,
  },
  dropdownAnchorCompact: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  dropdownAnchorDisabled: {
    opacity: 0.45,
  },
  pileOverlayBackdrop: {
    position: 'absolute',
    left: -24,
    right: -24,
    top: -24,
    bottom: -24,
    backgroundColor: 'transparent',
    zIndex: 9,
  },
  pileOverlayPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(70,70,70,0.98)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 6,
    zIndex: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  pileOverlayScroll: {
    maxHeight: 280,
  },
  pilePickItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  pilePickDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  pilePickText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  compactInput: {
    backgroundColor: '#fff',
    height: 38,
  },
  priceSectionTitle: { color: '#111', fontSize: 12, fontWeight: '800' },
  compareWrap: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  compareHeaderRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  compareHeaderCell: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.12)',
  },
  compareDataRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  compareCell: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.10)',
    minHeight: 34,
    justifyContent: 'center',
  },
  compareCellText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  cellType: { flex: 0.9 },
  cellSpec: { flex: 1.2 },
  cellLen: { flex: 0.72 },
  cellCost: { flex: 0.585 },
  cellCheck: { flex: 1.0935, borderRightWidth: 0 },
});

export default PlanContent;
