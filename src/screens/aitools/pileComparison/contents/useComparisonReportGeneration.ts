import { useCallback } from 'react';
import { Alert } from 'react-native';
import { API_CONFIG } from '@/constants';
import { foregroundService } from '@/services/foregroundService';
import { usePileComparisonContext } from '../PileComparisonContext';
import { pileComparisonApi } from '../pileComparisonApi';
import { isLikelyFullComparisonReport } from '../utils/reportValidation';
import { useAgentTaskStore } from '@/stores/useAgentTaskStore';
import RNFS from 'react-native-fs';

type Params<FaceId extends string = string, CompareRow = any, FaceConfig = any> = {
  faces: FaceConfig[];
  compareRows: Record<FaceId, CompareRow[]>;
  soilLayerByKey: Map<string, any>;
  groundElevation?: number;
  calcSegmentThicknessByLayer: (pileTopElevation: number, pileTipElevation: number) => Record<string, number>;
  buildCompressionCalcSheetMd: (args: any) => string;
  buildTensionCalcSheetMd?: (args: any) => string;
  isValidUnitCost: (v: any) => boolean;
  getSoil3dSnapshotUri?: (face: FaceId) => string;
  calcCompressionDetailForReport?: (args: {
    pileType: string;
    outerDiameterMm: number;
    layerKeyAtPileTip: string;
    segsByLayer: Record<string, number>;
  }) => any;
  calcTensionDetailForReport?: (args: {
    pileType: string;
    outerDiameterMm: number;
    segsByLayer: Record<string, number>;
  }) => any;
};

const devLog = (...args: any[]) => {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

export const useComparisonReportGeneration = <FaceId extends string = string, CompareRow = any, FaceConfig = any>({
  faces,
  compareRows,
  soilLayerByKey,
  groundElevation,
  calcSegmentThicknessByLayer,
  buildCompressionCalcSheetMd,
  buildTensionCalcSheetMd,
  isValidUnitCost,
  getSoil3dSnapshotUri,
  calcCompressionDetailForReport,
  calcTensionDetailForReport,
}: Params<FaceId, CompareRow, FaceConfig>) => {
  const {
    bidId,
    appendChatMessage,
    updateChatMessage,
    setComparisonReportAppendixMarkdown,
    comparisonReportGenerating,
    setComparisonReportGenerating,
    comparisonReportGeneratingId,
    setComparisonReportGeneratingId,
    upsertComparisonReport,
    updateComparisonReport,
    wsConnected,
    connectWebSocket,
    attachments,
  } = usePileComparisonContext();

  const generateComparisonReport = useCallback(
    async (face: FaceId) => {
      try {
        const toNum = (v: any) => {
          const n = Number(String(v ?? '').trim());
          return Number.isFinite(n) ? n : NaN;
        };

        const fmtCapacity = (quk: any, qsk: any) => {
          const qukN = typeof quk === 'number' && Number.isFinite(quk) ? quk : null;
          const qskN = typeof qsk === 'number' && Number.isFinite(qsk) ? qsk : null;
          if (qukN == null && qskN == null) return '--';
          if (qukN != null && qskN == null) return `${qukN.toFixed(0)}`;
          if (qukN == null && qskN != null) return `${qskN.toFixed(0)}`;
          return `${(qukN as number).toFixed(0)}/${(qskN as number).toFixed(0)}`;
        };

        const ceilInt = (x: number) => {
          if (!Number.isFinite(x)) return NaN;
          if (x <= 0) return 0;
          return Math.ceil(x);
        };

        const computeRowLengthM = (cfg: any, row: any) => {
          const layerKey = String(cfg?.layerKey ?? '').trim();
          const layer = layerKey ? soilLayerByKey.get(layerKey) : null;
          const topElevationRaw = layer?.top_elevation;
          const topElevation = topElevationRaw != null ? Number(topElevationRaw) : NaN;
          const pileTop = cfg?.pileTopElevation
            ? toNum(cfg.pileTopElevation)
            : groundElevation != null && !Number.isNaN(Number(groundElevation))
              ? Number(groundElevation)
              : NaN;
          const enterDepthRaw = String(row?.enterDepthMOverride ?? cfg?.enterDepthM ?? '').trim();
          const enterDepth = enterDepthRaw ? toNum(enterDepthRaw) : 0;
          if (!Number.isFinite(pileTop)) return NaN;
          if (!Number.isFinite(topElevation)) return NaN;
          const len = Math.max(0, pileTop - topElevation + (Number.isFinite(enterDepth) ? enterDepth : 0));
          return Number.isFinite(len) ? len : NaN;
        };

        const computePileCount = (cfg: any, row: any) => {
          const loadC = toNum(cfg?.columnLoadCompression);
          const loadT = toNum(cfg?.columnLoadTension);
          const hasC = Number.isFinite(loadC) && loadC > 0;
          const hasT = Number.isFinite(loadT) && loadT > 0;

          const quk = typeof row?.Quk === 'number' && Number.isFinite(row.Quk) ? row.Quk : NaN;
          const qsk = typeof row?.Qsk === 'number' && Number.isFinite(row.Qsk) ? row.Qsk : NaN;

          let nC = 0;
          let nT = 0;
          if (hasC) {
            if (!Number.isFinite(quk) || quk <= 0) return NaN;
            nC = ceilInt(loadC / quk);
          }
          if (hasT) {
            if (!Number.isFinite(qsk) || qsk <= 0) return NaN;
            nT = ceilInt(loadT / qsk);
          }
          const n = Math.max(nC, nT, 0);
          return Number.isFinite(n) ? n : NaN;
        };

        const now = new Date();
        const pad2 = (n: number) => String(n).padStart(2, '0');
        const todayIsoLocal = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
        const todayZh = `${now.getFullYear()}年${pad2(now.getMonth() + 1)}月${pad2(now.getDate())}日`;

        if (!bidId) {
          Alert.alert('提示', '请先完成本次比选任务创建/上传，再生成对比报告');
          return;
        }

        const rows = compareRows?.[face] || [];
        const cfg = (faces || []).find((x: any) => x.face === face) as any;
        const loadC = toNum(cfg?.columnLoadCompression);
        const loadT = toNum(cfg?.columnLoadTension);
        const hasLoadC = Number.isFinite(loadC) && loadC > 0;
        const hasLoadT = Number.isFinite(loadT) && loadT > 0;

        const meaningfulRows = rows.filter((r: any) => {
          const pileType = String(r?.pileType ?? '').trim();
          const spec = String(r?.spec ?? '').trim();
          const qukOk = typeof r?.Quk === 'number' && Number.isFinite(r.Quk);
          const qskOk = typeof r?.Qsk === 'number' && Number.isFinite(r.Qsk);
          return !!pileType || !!spec || qukOk || qskOk;
        });

        const validRows = rows.filter((r: any) => {
          const hasAnyCapacity =
            (typeof r?.Quk === 'number' && Number.isFinite(r.Quk) && r.Quk > 0) ||
            (typeof r?.Qsk === 'number' && Number.isFinite(r.Qsk) && r.Qsk > 0);
          if (!hasAnyCapacity) return false;
          if (hasLoadC) {
            if (!(typeof r?.Quk === 'number' && Number.isFinite(r.Quk) && r.Quk > 0)) return false;
          }
          if (hasLoadT) {
            if (!(typeof r?.Qsk === 'number' && Number.isFinite(r.Qsk) && r.Qsk > 0)) return false;
          }
          return true;
        });
        if (validRows.length === 0) {
          const need = hasLoadC && hasLoadT ? 'Quk/Qsk' : hasLoadC ? 'Quk' : hasLoadT ? 'Qsk' : 'Quk/Qsk';
          Alert.alert('提示', `生成对比报告前，请先点击“开始计算”，并确保至少一行桩型已计算出校验值(${need})`);
          return;
        }

        const missingPriceRows = meaningfulRows.map((r: any, idx: number) => ({ r, idx })).filter(({ r }) => !isValidUnitCost(r?.unitCost));
        if (missingPriceRows.length > 0) {
          Alert.alert('提示', '生成对比报告前，请先为所有对比桩型填写单价');
          return;
        }

        if (comparisonReportGenerating || comparisonReportGeneratingId) {
          Alert.alert('提示', '对比报告正在生成中，请稍候…');
          return;
        }

        setComparisonReportGenerating(true);
        // 通知全局 Store：对比报告生成开始
        useAgentTaskStore.getState().markWorking('pile_compare', '正在生成对比报告...', bidId);

        const schemeIndex = Math.max(0, (faces || []).findIndex((x: any) => x.face === face)) + 1;
        const requestId = `solution|gen_plan_advice|${String(face)}|${Date.now()}`;

        // 抗压计算书
        const calcSheets = validRows
          .map((r: any, rowIndex: number) => {
            const pileType = String(r?.prestressedSelection?.pile_type ?? r?.pileType ?? '').trim();
            const spec = String(r?.spec ?? '').trim();
            const d0 = r?.prestressedSelection?.outer_diameter;
            const outerDiameterMm = Number(d0);
            if (!pileType || !spec) return '';
            if (!Number.isFinite(outerDiameterMm) || outerDiameterMm <= 0) return '';

            const cfg = (faces || []).find((x: any) => x.face === face) as any;
            const layerKey = String(cfg?.layerKey ?? '').trim();
            if (!layerKey) return '';
            const layer = soilLayerByKey.get(layerKey);
            const bearingTopElevation = Number(layer?.top_elevation);
            if (!Number.isFinite(bearingTopElevation)) return '';

            const pileTopElevationRaw = cfg?.pileTopElevation
              ? Number(cfg.pileTopElevation)
              : groundElevation != null && !Number.isNaN(Number(groundElevation))
                ? Number(groundElevation)
                : NaN;
            if (!Number.isFinite(pileTopElevationRaw)) return '';

            const enterDepthRaw = String(r?.enterDepthMOverride ?? cfg?.enterDepthM ?? '').trim();
            const enterDepth = enterDepthRaw ? Number(enterDepthRaw) : 0;
            const pileTipElevation = bearingTopElevation - (Number.isFinite(enterDepth) ? enterDepth : 0);
            const segs = calcSegmentThicknessByLayer(pileTopElevationRaw, pileTipElevation);
            const snapshotUri = getSoil3dSnapshotUri ? String(getSoil3dSnapshotUri(face) || '').trim() : '';
            const compressionDetail = calcCompressionDetailForReport
              ? calcCompressionDetailForReport({
                  pileType,
                  outerDiameterMm,
                  layerKeyAtPileTip: layerKey,
                  segsByLayer: segs,
                })
              : null;

            return buildCompressionCalcSheetMd({
              schemeIndex,
              face,
              rowIndex,
              pileType,
              spec,
              outerDiameterMm,
              pileTopElevation: pileTopElevationRaw,
              pileTipElevation,
              layerKeyAtPileTip: layerKey,
              segs,
              soil3dSnapshotUri: snapshotUri,
              compressionDetail,
            });
          })
          .filter(Boolean)
          .join('\n\n');

        // 抗拔计算书
        const tensionCalcSheets = buildTensionCalcSheetMd
          ? validRows
              .map((r: any, rowIndex: number) => {
                const pileType = String(r?.prestressedSelection?.pile_type ?? r?.pileType ?? '').trim();
                const spec = String(r?.spec ?? '').trim();
                const d0 = r?.prestressedSelection?.outer_diameter;
                const outerDiameterMm = Number(d0);
                if (!pileType || !spec) return '';
                if (!Number.isFinite(outerDiameterMm) || outerDiameterMm <= 0) return '';

                const cfg = (faces || []).find((x: any) => x.face === face) as any;
                const layerKey = String(cfg?.layerKey ?? '').trim();
                if (!layerKey) return '';
                const layer = soilLayerByKey.get(layerKey);
                const bearingTopElevation = Number(layer?.top_elevation);
                if (!Number.isFinite(bearingTopElevation)) return '';

                const pileTopElevationRaw = cfg?.pileTopElevation
                  ? Number(cfg.pileTopElevation)
                  : groundElevation != null && !Number.isNaN(Number(groundElevation))
                    ? Number(groundElevation)
                    : NaN;
                if (!Number.isFinite(pileTopElevationRaw)) return '';

                const enterDepthRaw = String(r?.enterDepthMOverride ?? cfg?.enterDepthM ?? '').trim();
                const enterDepth = enterDepthRaw ? Number(enterDepthRaw) : 0;
                const pileTipElevation = bearingTopElevation - (Number.isFinite(enterDepth) ? enterDepth : 0);

                // 获取用户输入的抗拔长度
                const tensionLength = r?.tensionLength;
                const hasTensionLength = Number.isFinite(tensionLength) && (tensionLength as number) > 0;

                // 根据抗拔长度计算分段
                const fullSegs = calcSegmentThicknessByLayer(pileTopElevationRaw, pileTipElevation);
                const tensionSegs = hasTensionLength
                  ? calcSegmentThicknessByLayer(pileTopElevationRaw, pileTopElevationRaw - (tensionLength as number))
                  : fullSegs;

                const snapshotUri = getSoil3dSnapshotUri ? String(getSoil3dSnapshotUri(face) || '').trim() : '';

                // 计算抗拔详细过程（使用 calcTensionCapacity，含λ系数）
                const tensionDetail = calcTensionDetailForReport
                  ? calcTensionDetailForReport({
                      pileType,
                      outerDiameterMm,
                      segsByLayer: tensionSegs,
                    })
                  : null;

                return buildTensionCalcSheetMd!({
                  schemeIndex,
                  face,
                  rowIndex,
                  pileType,
                  spec,
                  outerDiameterMm,
                  pileTopElevation: pileTopElevationRaw,
                  pileTipElevation,
                  layerKeyAtPileTip: layerKey,
                  segs: tensionSegs,
                  soil3dSnapshotUri: snapshotUri,
                  tensionLength: hasTensionLength ? tensionLength : null,
                  tensionDetail,
                });
              })
              .filter(Boolean)
              .join('\n\n')
          : '';

        const pickRecommendedRow = (rowsIn: any[]) => {
          const rows0 = Array.isArray(rowsIn) ? rowsIn : [];
          const parseMoney = (v: any) => {
            const s = String(v ?? '').trim().replace(/,/g, '');
            const n = Number(s);
            return Number.isFinite(n) ? n : NaN;
          };
          const scored = rows0
            .map((r) => {
              const unit = parseMoney((r as any).unitCost);
              const len = cfg ? computeRowLengthM(cfg, r) : NaN;
              const cnt = cfg ? computePileCount(cfg, r) : NaN;
              const total =
                Number.isFinite(unit) && unit > 0 && Number.isFinite(len) && len > 0 && Number.isFinite(cnt) && cnt > 0
                  ? unit * len * cnt
                  : NaN;
              return { r, unit, total };
            })
            .filter((x) => Number.isFinite(x.unit) && x.unit > 0);
          if (scored.length === 0) return null;
          const hasTotal = scored.some((x) => Number.isFinite(x.total) && x.total > 0);
          scored.sort((a, b) => {
            if (hasTotal) {
              const ta = Number.isFinite(a.total) ? a.total : Number.POSITIVE_INFINITY;
              const tb = Number.isFinite(b.total) ? b.total : Number.POSITIVE_INFINITY;
              if (ta !== tb) return ta - tb;
            }
            return a.unit - b.unit;
          });
          return scored[0]?.r || null;
        };

        const recommended = pickRecommendedRow(validRows as any);
        const recSel: any = recommended?.prestressedSelection || {};
        const recLabel =
          `${String(recSel?.pile_type || recommended?.pileType || '').trim()} ${String(recSel?.specification || recommended?.spec || '').trim()}`
            .trim() || '（未选择）';

        devLog('[ComparisonReport] Recommended row:', {
          hasRecommended: !!recommended,
          recSelKeys: Object.keys(recSel || {}),
          recSelSpec: recSel?.specification,
          recSelReinUrl: recSel?.reinforcement_image_url,
          recSelPileConnUrl: recSel?.pile_connection_image_url,
          recSelPlatConnUrl: recSel?.platform_connection_image_url,
          recommendedSpec: recommended?.spec,
        });

        let reinUrl0 = '';
        let pileConnUrl0 = '';
        let platConnUrl0 = '';

        try {
          const rawSpec = String(recSel?.specification || recommended?.spec || '').trim();
          devLog('[ComparisonReport] Spec for DB query:', { rawSpec });

          if (rawSpec) {
            const res = await pileComparisonApi.getPrestressedPileParams();
            const rows = (res as any)?.rows || [];
            devLog('[ComparisonReport] DB rows count:', rows.length);
            
            const normalizeSpec = (s: string) => String(s || '').replace(/[\(\)\[\]\-_ ]/g, '').trim().toUpperCase();
            const targetNorm = normalizeSpec(rawSpec);

            const matched = rows.find((r: any) => {
              const rSpec = String(r?.specification || '').trim();
              if (rSpec === rawSpec) return true;
              return normalizeSpec(rSpec) === targetNorm;
            });

            if (matched) {
              reinUrl0 = String(matched?.reinforcement_image_url || '').trim();
              pileConnUrl0 = String(matched?.pile_connection_image_url || '').trim();
              platConnUrl0 = String(matched?.platform_connection_image_url || '').trim();
              devLog('[ComparisonReport] Pile images from DB:', { spec: rawSpec, matchedSpec: matched?.specification, rein: reinUrl0, pileConn: pileConnUrl0, platConn: platConnUrl0 });
            } else {
              devLog('[ComparisonReport] No matching pile param for spec:', rawSpec, 'targetNorm:', targetNorm);
              const sampleSpecs = rows.slice(0, 5).map((r: any) => r?.specification);
              devLog('[ComparisonReport] Sample specs in DB:', sampleSpecs);
            }
          } else {
            devLog('[ComparisonReport] rawSpec is empty, skipping DB query');
          }

          if (!reinUrl0 && recSel?.reinforcement_image_url) {
            reinUrl0 = String(recSel.reinforcement_image_url).trim();
          }
          if (!pileConnUrl0 && recSel?.pile_connection_image_url) {
            pileConnUrl0 = String(recSel.pile_connection_image_url).trim();
          }
          if (!platConnUrl0 && recSel?.platform_connection_image_url) {
            platConnUrl0 = String(recSel.platform_connection_image_url).trim();
          }

          if (!reinUrl0 || !pileConnUrl0 || !platConnUrl0) {
            for (const vr of validRows as any[]) {
              const sel = vr?.prestressedSelection || {};
              if (!reinUrl0 && sel?.reinforcement_image_url) reinUrl0 = String(sel.reinforcement_image_url).trim();
              if (!pileConnUrl0 && sel?.pile_connection_image_url) pileConnUrl0 = String(sel.pile_connection_image_url).trim();
              if (!platConnUrl0 && sel?.platform_connection_image_url) platConnUrl0 = String(sel.platform_connection_image_url).trim();
              if (reinUrl0 && pileConnUrl0 && platConnUrl0) break;
            }
          }
        } catch (e) {
          devLog('[ComparisonReport] Failed to fetch pile images:', e);
        }

        devLog('[ComparisonReport] Image URLs from DB:', { reinUrl0, pileConnUrl0, platConnUrl0 });

        // Sign Supabase storage URLs (matching HarmonyOS implementation)
        const signOne = async (u: string): Promise<string> => {
          const raw = String(u || '').trim();
          if (!raw) return '';
          // Already signed
          if (/\/storage\/v1\/object\/sign\//i.test(raw)) return raw;
          // Only sign Supabase storage URLs
          if (!/supabase|storage\/v1/i.test(raw)) return raw;
          try {
            const res = await pileComparisonApi.createStorageSignedUrl({ url: raw, bucket: 'pile-images', expires_in: 3600 });
            return (res as any)?.signed_url || raw;
          } catch {
            return raw;
          }
        };

        const [reinUrl, pileConnUrl, platConnUrl] = await Promise.all([
          signOne(reinUrl0),
          signOne(pileConnUrl0),
          signOne(platConnUrl0),
        ]);
        
        const debugInfo = `\n\n<!-- DEBUG: recSelKeys=${Object.keys(recSel || {}).join(',')} | reinUrl0=${reinUrl0 ? '有' : '无'} | pileConnUrl0=${pileConnUrl0 ? '有' : '无'} | platConnUrl0=${platConnUrl0 ? '有' : '无'} | signed=${reinUrl !== reinUrl0 ? 'yes' : 'no'} -->\n\n`;
        
        const pileDrawingsMd =
          `### 附录5 桩型截面及配筋图（${recLabel}）\n\n` +
          `[[FIGURE:桩型截面及配筋图（${recLabel}）|url=${reinUrl || ''}]]\n\n` +
          `### 附录6 桩连接图（${recLabel}）\n\n` +
          `[[FIGURE:桩连接图（${recLabel}）|url=${pileConnUrl || ''}]]\n\n` +
          `### 附录7 承台连接图（${recLabel}）\n\n` +
          `[[FIGURE:承台连接图（${recLabel}）|url=${platConnUrl || ''}]]\n\n` +
          debugInfo;

        // Resolve profile/parameters attachment URIs at generation time
        // Convert local file URIs to base64 data URIs (same approach as HarmonyOS)
        const resolveAttachmentDataUri = async (kind: string): Promise<string> => {
          const attArr = Array.isArray(attachments) ? attachments : [];
          const att = attArr.find((a: any) => a?.kind === kind);
          if (!att) return '';
          // Already has base64
          if ((att as any)?._base64) {
            return `data:image/jpeg;base64,${(att as any)._base64}`;
          }
          let uri = att.uri || '';
          if (!uri) return '';
          // If it's already a data URI, return as-is
          if (uri.startsWith('data:')) return uri;
          // If it's a remote URL, return as-is
          if (uri.startsWith('http')) return uri;
          // Local file: read and convert to base64 data URI
          try {
            const filePath = uri.replace(/^file:\/\//, '');
            const exists = await RNFS.exists(filePath);
            if (!exists) {
              devLog(`[ComparisonReport] File not found: ${filePath}`);
              return '';
            }
            const base64 = await RNFS.readFile(filePath, 'base64');
            const lower = filePath.toLowerCase();
            let mime = 'image/jpeg';
            if (lower.endsWith('.png')) mime = 'image/png';
            else if (lower.endsWith('.webp')) mime = 'image/webp';
            return `data:${mime};base64,${base64}`;
          } catch (e) {
            devLog(`[ComparisonReport] Failed to read file as base64:`, e);
            return `file://${uri}`;
          }
        };
        const [profileUri, parametersUri] = await Promise.all([
          resolveAttachmentDataUri('profile'),
          resolveAttachmentDataUri('parameters'),
        ]);

        const appendixMd =
          `## 附录\n\n` +
          `### 附录1 钻孔柱状图（剖面）\n\n` +
          (profileUri
            ? `[[FIGURE:钻孔柱状图（剖面）|url=${profileUri}]]\n\n`
            : `[[FIGURE:钻孔柱状图（剖面）|kind=profile]]\n\n`) +
          `### 附录2 土层物理力学参数表（参数）\n\n` +
          (parametersUri
            ? `[[FIGURE:土层物理力学参数表（参数）|url=${parametersUri}]]\n\n`
            : `[[FIGURE:土层物理力学参数表（参数）|kind=parameters]]\n\n`) +
          `### 附录3 单桩竖向抗压承载力计算书\n\n` +
          `${calcSheets || '（无）'}\n\n` +
          `### 附录4 单桩竖向抗拔承载力计算书\n\n` +
          `${tensionCalcSheets || '（无）'}\n\n` +
          `${pileDrawingsMd}`;

        setComparisonReportAppendixMarkdown(appendixMd);

        const md =
          `你是一名岩土/桩基方案工程师，请生成一份《桩基选型方案报告》（Markdown）。\n` +
          `模板文件：src/screens/aitools/pileComparison/strategy/对比报告模板.md\n\n` +
          `写作要求（非常重要）：\n` +
          `- 必须输出：封面、目录、以及“一~五章”的完整结构（章节标题与小节组织严格参考模板）。\n` +
          `- 第1~4章：必须强约束按模板的章节/小节组织内容，尽量填写项目强相关信息（缺失信息可以用“待补充：xxx/____”标注，但不要编造）。\n` +
          `- 封面字段（例如：项目名称/工程编号等）如信息缺失：冒号后请留空，不要写“待补充:____/待补充：____/____”。\n` +
          `- 封面“编制日期”必须使用今天的日期（禁止自行猜测历史日期）。\n` +
          `  - 今日（ISO）：${todayIsoLocal}\n` +
          `  - 今日（中文）：${todayZh}\n` +
          `- 第4章“方案对比”中【桩基材料对比表】的表头列名必须包含且按顺序输出：桩型、规格、桩长(m)、单桩承载力（抗压/抗拔）(kN)、根数、单价（元/m）、总价（元）。\n` +
          `  - 禁止使用“极限/特征值”等表头措辞，必须使用“抗压/抗拔”。\n` +
          `- 第5章：在前四章基础上输出“比选总结/建议方案/补充说明”，内容要可落地、可执行。\n` +
          `- **绝对不要输出任何附录（如附录1~附录7等）的内容！附录与图表将由系统自动在报告末尾追加！**\n` +
          `- 直接输出最终报告正文（Markdown），不要输出“已收到/请补充/请指出需要核对”等对话式确认语句，不要向我提问。\n` +
          `- 语言风格：工程报告体，条理清晰，尽量使用表格/分点。\n\n` +
          `本次需要基于“计算方案${schemeIndex}”的对比桩型计算结果，完成第4章“桩基方案”的方案对比与推荐。\n` +
          `如信息不足，请在相应章节明确列出需要补充的关键参数。\n\n` +
          `对比桩型数据（用于第4章，并可在第5章引用结论）：\n` +
          validRows
            .map((r: any, i: number) => {
              const pileType = String(r?.prestressedSelection?.pile_type ?? r?.pileType ?? '').trim();
              const spec = String(r?.spec ?? '').trim();
              const len = cfg ? computeRowLengthM(cfg, r) : NaN;
              const lenText = Number.isFinite(len) ? len.toFixed(2) : '';
              const top = cfg?.pileTopElevation ?? '';
              const cost = r?.unitCost ?? '';
              const city = r?.unitCostCity ?? '';
              const capText = fmtCapacity(r?.Quk, r?.Qsk);
              const cnt = cfg ? computePileCount(cfg, r) : NaN;
              const cntText = Number.isFinite(cnt) && cnt > 0 ? String(cnt) : '';

              const unit = Number(String(cost ?? '').trim().replace(/,/g, ''));
              const total =
                Number.isFinite(unit) && unit > 0 && Number.isFinite(len) && len > 0 && Number.isFinite(cnt) && cnt > 0
                  ? unit * len * cnt
                  : NaN;
              const totalText = Number.isFinite(total) && total > 0 ? total.toFixed(0) : '';

              const loadHint =
                hasLoadC || hasLoadT
                  ? `；柱下荷载=${hasLoadC ? `${loadC.toFixed(0)}KN(压)` : ''}${hasLoadC && hasLoadT ? ' ' : ''}${hasLoadT ? `${loadT.toFixed(0)}KN(拔)` : ''}`
                  : '';

              return `- ${i + 1}. 桩型=${pileType}；规格=${spec}；桩长(m)=${lenText}；桩顶标高=${top}；单桩承载力（抗压/抗拔）(kN)=${capText}；根数=${cntText}${loadHint}；单价（元/m）=${cost}${city ? `（${city}信息价）` : ''}；总价（元）=${totalText}`;
            })
            .join('\n');

        appendChatMessage('solution', {
          id: `user|${requestId}`,
          role: 'user',
          content: '生成对比方案及报价建议',
          status: 'done',
          createdAt: Date.now(),
        });
        appendChatMessage('solution', {
          id: requestId,
          role: 'assistant',
          content: '',
          status: 'streaming',
          createdAt: Date.now(),
        });

        // 状态已被提前设置，这里只连接 WebSocket
        let wsOk = wsConnected;
        if (bidId && !wsOk) {
          try {
            await connectWebSocket(bidId);
            wsOk = true;
          } catch {
            wsOk = false;
          }
        }

        const nowIso = new Date().toISOString();
        const reportSchemeIndex = Math.max(0, (faces || []).findIndex((x: any) => x.face === face)) + 1;
        const reportTitle = `对比报告（方案${reportSchemeIndex}）`;
        upsertComparisonReport({
          id: requestId,
          title: reportTitle,
          status: 'generating',
          created_at: nowIso,
          updated_at: nowIso,
        });
        setComparisonReportGeneratingId(requestId);

        if (wsOk) {
          void foregroundService.startService(reportTitle, 4);
          void foregroundService.updateProgress(0, 4);
        }

        try {
          const timeoutMs = 600000;
          const chatRes = await pileComparisonApi.chat(bidId, { message: md, request_id: requestId }, { timeoutMs });
          devLog('[ComparisonReport] gen report chatRes:', chatRes);

          // 兜底：即使 WS 已连接，也处理 HTTP 响应作为保障
          // 当 WS 的 chat_done 事件已经处理完毕时，updateComparisonReport 是幂等的，不会冲突
          // 这避免了 WS 断开时报告永远卡在 generating 状态，导致牛马视窗机器人不回位
          const extracted =
            typeof chatRes === 'string'
              ? chatRes
              : String(
                  (chatRes as any)?.assistant_message ??
                    (chatRes as any)?.assistantMessage ??
                    (chatRes as any)?.content ??
                    (chatRes as any)?.data ??
                    (chatRes as any)?.message ??
                    ''
                );

          const assistantText = String(extracted || '').trim();
          if (assistantText && isLikelyFullComparisonReport(assistantText)) {
            const combined = `${assistantText}\n\n${appendixMd}\n`;
            updateChatMessage('solution', requestId, { content: combined, status: 'done' });
            setComparisonReportGenerating(false);
            setComparisonReportGeneratingId('');
            updateComparisonReport(requestId, {
              status: 'done',
              updated_at: new Date().toISOString(),
              markdown: combined,
            });
            if (wsOk) {
              void foregroundService.completeService(combined.length);
            }
            return;
          }

          if (assistantText && !isLikelyFullComparisonReport(assistantText)) {
            updateChatMessage('solution', requestId, {
              content: `生成失败：未生成完整对比报告正文（可能只返回了确认语/片段）。\n\n请重试。`,
              status: 'done',
            });
            setComparisonReportGenerating(false);
            setComparisonReportGeneratingId('');
            updateComparisonReport(requestId, {
              status: 'failed',
              updated_at: new Date().toISOString(),
              error: '报告正文缺失或格式不完整',
            });
            if (wsOk) {
              void foregroundService.failService('对比报告生成失败：报告正文缺失或格式不完整');
            }
            Alert.alert('提示', '对比报告生成失败：未生成完整正文（只返回了确认语/片段）。请重试。');
            return;
          }

          const safeKeys = chatRes && typeof chatRes === 'object' ? Object.keys(chatRes).slice(0, 20).join(', ') : '';
          let raw = '';
          try {
            raw = typeof chatRes === 'string' ? chatRes : JSON.stringify(chatRes);
          } catch {
            raw = String(chatRes);
          }
          const rawShort = String(raw || '').slice(0, 420);

          let rawStatus = '';
          let rawKeys = '';
          let rawBodyShort = '';
          try {
            const rawRes = await pileComparisonApi.chatRaw(bidId, { message: md, request_id: requestId });
            rawStatus = String(rawRes?.status ?? '');
            rawKeys = rawRes?.data && typeof rawRes.data === 'object' ? Object.keys(rawRes.data).slice(0, 30).join(', ') : '';
            let rawBody = '';
            try {
              rawBody = typeof rawRes?.data === 'string' ? rawRes.data : JSON.stringify(rawRes?.data);
            } catch {
              rawBody = String(rawRes?.data);
            }
            rawBodyShort = String(rawBody || '').slice(0, 800);
            devLog('[ComparisonReport] gen report rawRes:', rawRes);
          } catch (rawErr: any) {
            devLog('[ComparisonReport] gen report chatRaw failed:', rawErr);
            rawBodyShort = `chatRaw failed: ${String(rawErr?.message || rawErr || '')}`.slice(0, 260);
          }

          updateChatMessage('solution', requestId, {
            content:
              `生成失败：服务返回空内容\n\n调试信息：\n- parsed keys: ${safeKeys || '(none)'}\n- parsed raw: ${rawShort || '(empty)'}\n- http status(raw): ${rawStatus || '(unknown)'}\n- raw keys: ${rawKeys || '(none)'}\n- raw body: ${rawBodyShort || '(empty)'}`,
            status: 'done',
          });
          setComparisonReportGenerating(false);
          setComparisonReportGeneratingId('');
          updateComparisonReport(requestId, {
            status: 'failed',
            updated_at: new Date().toISOString(),
            error: '服务返回空内容',
          });
          if (wsOk) {
            void foregroundService.failService('对比报告生成失败：服务返回空内容');
          }
          Alert.alert('提示', '生成失败：服务返回空内容（请检查后端 /chat 接口返回字段或LLM生成状态）');
        } catch (e: any) {
          const msg = String(e?.message || '请求失败');
          if (msg.startsWith('timeout:')) {
            updateChatMessage('solution', requestId, { content: '生成超时：请检查网络或稍后重试', status: 'done' });
            setComparisonReportGenerating(false);
            setComparisonReportGeneratingId('');
            updateComparisonReport(requestId, {
              status: 'failed',
              updated_at: new Date().toISOString(),
              error: '生成超时',
            });
            if (wsOk) {
              void foregroundService.failService('对比报告生成超时：请检查网络或稍后重试');
            }
            Alert.alert('提示', '生成超时：请检查网络或稍后重试');
          } else {
            const base = API_CONFIG.BASE_URL;
            const msg2 = msg ? `${msg}\n\nBASE_URL: ${base}` : `生成失败\n\nBASE_URL: ${base}`;
            updateChatMessage('solution', requestId, { content: `生成失败：${msg2}`, status: 'done' });
            setComparisonReportGenerating(false);
            setComparisonReportGeneratingId('');
            updateComparisonReport(requestId, {
              status: 'failed',
              updated_at: new Date().toISOString(),
              error: msg,
            });
            if (wsOk) {
              void foregroundService.failService(`对比报告生成失败：${msg}`);
            }
            Alert.alert('提示', msg2 || '生成失败');
          }
        }
      } catch (outerErr: any) {
        setComparisonReportGenerating(false);
        setComparisonReportGeneratingId('');
        // 通知全局 Store：对比报告生成失败
        useAgentTaskStore.getState().markIdle('pile_compare');
        if (bidId) {
          void foregroundService.failService(String(outerErr?.message || '对比报告生成失败'));
        }
        Alert.alert('提示', outerErr?.message || '生成失败');
      }
    },
    [
      bidId,
      compareRows,
      faces,
      soilLayerByKey,
      groundElevation,
      calcSegmentThicknessByLayer,
      buildCompressionCalcSheetMd,
      isValidUnitCost,
      getSoil3dSnapshotUri,
      calcCompressionDetailForReport,
      calcTensionDetailForReport,
      appendChatMessage,
      updateChatMessage,
      setComparisonReportAppendixMarkdown,
      comparisonReportGenerating,
      setComparisonReportGenerating,
      comparisonReportGeneratingId,
      setComparisonReportGeneratingId,
      upsertComparisonReport,
      updateComparisonReport,
      wsConnected,
      connectWebSocket,
      attachments,
    ]
  );

  return { generateComparisonReport };
};
