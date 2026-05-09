export type PileCategory = 'prefab' | 'drilled';
export type SectionShape = 'circular' | 'square';

export type PileShapeInfo = {
  category: PileCategory;
  shape: SectionShape;
};

export const getPileShapeInfo = (pileTypeRaw: string): PileShapeInfo | null => {
  const pileType = String(pileTypeRaw ?? '').trim();
  if (!pileType) return null;

  const prefabCircular = new Set(['管桩', '竹节桩']);
  const prefabSquare = new Set(['空心方桩', '实心方桩', '异型空心方桩', '异型实心方桩', '螺锁方桩']);

  const drilledCircular = new Set(['钻孔灌注桩', '静钻根植桩', '劲性复合桩']);

  if (prefabCircular.has(pileType)) return { category: 'prefab', shape: 'circular' };
  if (prefabSquare.has(pileType)) return { category: 'prefab', shape: 'square' };
  if (drilledCircular.has(pileType)) return { category: 'drilled', shape: 'circular' };

  return null;
};

export const mmToM = (mm: number) => mm / 1000;

export const calcPerimeterU = (shape: SectionShape, outerDiameterMm: number): number | null => {
  if (!Number.isFinite(outerDiameterMm) || outerDiameterMm <= 0) return null;
  const d = mmToM(outerDiameterMm);
  if (shape === 'circular') return Math.PI * d;
  return 4 * d;
};

export const calcAreaAp = (shape: SectionShape, outerDiameterMm: number): number | null => {
  if (!Number.isFinite(outerDiameterMm) || outerDiameterMm <= 0) return null;
  const d = mmToM(outerDiameterMm);
  if (shape === 'circular') return (Math.PI * d * d) / 4;
  return d * d;
};

export type SoilLayerParam = {
  layerKey: string;
  thicknessM: number;
  sideFrictionPrefabKpa?: number;
  sideFrictionDrilledKpa?: number;
  endBearingPrefabKpa?: number;
  endBearingDrilledKpa?: number;
  upliftCoeffLambda?: number; // 抗拔侧阻系数 λ（JGJ 94-2008）
};

export type CompressionCapacityInput = {
  pileType: string;
  outerDiameterMm: number;
  layerKeyAtPileTip: string;
  segmentThicknessByLayer: Array<{ layerKey: string; lengthM: number }>;
  soilParamsByLayer: Record<string, SoilLayerParam>;
};

export type CompressionCapacityResult = {
  Quk: number;
  Qsk: number;
  Qpk: number;
  u: number;
  Ap: number;
  betaC?: number;
  qsikWeightedAvgKpa?: number;
};

const isBetaCPile = (pileTypeRaw: string) => {
  const t = String(pileTypeRaw ?? '').trim();
  return t === '螺锁方桩' || t === '竹节桩';
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// βc 取值规则（按模板描述实现为分段+线性插值）：
// - 当加权平均 qsik ≤ 7 kPa：βc=1.1
// - 当加权平均 qsik ≥ 30 kPa：βc=1.3
// - 7~30 kPa 区间：线性插值
const calcBetaC = (qsikWeightedAvgKpa: number) => {
  const q = Number(qsikWeightedAvgKpa);
  if (!Number.isFinite(q)) return 1;
  if (q <= 7) return 1.1;
  if (q >= 30) return 1.3;
  const t = (q - 7) / (30 - 7);
  return clamp(1.1 + t * (1.3 - 1.1), 1.1, 1.3);
};

export const calcCompressionCapacityQuk = (input: CompressionCapacityInput): CompressionCapacityResult | null => {
  const info = getPileShapeInfo(input.pileType);
  if (!info) return null;

  const u = calcPerimeterU(info.shape, input.outerDiameterMm);
  const Ap = calcAreaAp(info.shape, input.outerDiameterMm);
  if (u == null || Ap == null) return null;

  const getQsik = (layerKey: string) => {
    const p = input.soilParamsByLayer[layerKey];
    if (!p) return null;
    const v = info.category === 'prefab' ? Number(p.sideFrictionPrefabKpa) : Number(p.sideFrictionDrilledKpa);
    return Number.isFinite(v) && v > 0 ? v : 0;
  };

  let sumLi = 0;
  let sumQsikLi = 0;
  const Qsk0 = input.segmentThicknessByLayer.reduce((acc, seg) => {
    const qsik = getQsik(seg.layerKey);
    if (qsik == null) return acc;
    const li = Number(seg.lengthM);
    if (!Number.isFinite(li) || li <= 0) return acc;
    sumLi += li;
    sumQsikLi += qsik * li;
    return acc + u * qsik * li;
  }, 0);

  const qsikWeightedAvgKpa = sumLi > 0 ? sumQsikLi / sumLi : NaN;
  const betaC = isBetaCPile(input.pileType) ? calcBetaC(qsikWeightedAvgKpa) : 1;
  const Qsk = betaC !== 1 ? betaC * Qsk0 : Qsk0;

  const tipParam = input.soilParamsByLayer[input.layerKeyAtPileTip];
  if (!tipParam) return null;
  const qpk = info.category === 'prefab' ? Number(tipParam.endBearingPrefabKpa) : Number(tipParam.endBearingDrilledKpa);
  const qpkSafe = Number.isFinite(qpk) && qpk > 0 ? qpk : 0;

  const Qpk = qpkSafe * Ap;
  const Quk = Qsk + Qpk;

  return {
    Quk,
    Qsk,
    Qpk,
    u,
    Ap,
    ...(betaC !== 1 ? { betaC, qsikWeightedAvgKpa } : null),
  };
};

// 抗拔承载力计算结果
export type TensionCapacityResult = {
  Ta: number;  // 单桩竖向抗拔承载力特征值 (kN) = 侧阻力特征值 + 桩身自重
  Tsk: number; // 侧阻力特征值总和 (kN)
  Gp: number;  // 桩身自重 (kN)
  u: number;   // 桩身周长 (m)
  Ap: number;  // 桩身截面积 (m²)
  totalLength: number; // 桩总长度 (m)
  lambdaValues: Array<{ layerKey: string; lambda: number; qsik: number; li: number; contribution: number }>;
  betaC?: number; // 异型桩侧阻力修正系数（竹节桩/螺锁方桩）
  qsikWeightedAvgKpa?: number; // 加权平均侧阻力
};

// 混凝土重度 (含钢筋)，单位 kN/m³
const GAMMA_CONCRETE = 25;

// 计算单桩竖向抗拔承载力
// 公式：Ta = βc × Σ(λi × qsik × u × li) + Gp（异型桩乘βc）
// 其中：
//   - qsik 为参数表中侧阻力特征值（已除以安全系数）
//   - Gp = γc × Ap × L 为桩身自重
//   - βc 为异型桩（竹节桩/螺锁方桩）侧阻力修正系数
// 注意：参数表中的侧阻力已经是特征值，不需要再除以 K
export const calcTensionCapacity = (input: CompressionCapacityInput): TensionCapacityResult | null => {
  const info = getPileShapeInfo(input.pileType);
  if (!info) return null;

  const u = calcPerimeterU(info.shape, input.outerDiameterMm);
  const Ap = calcAreaAp(info.shape, input.outerDiameterMm);
  if (u == null || Ap == null) return null;

  const getQsik = (layerKey: string) => {
    const p = input.soilParamsByLayer[layerKey];
    if (!p) return null;
    const v = info.category === 'prefab' ? Number(p.sideFrictionPrefabKpa) : Number(p.sideFrictionDrilledKpa);
    return Number.isFinite(v) && v > 0 ? v : 0;
  };

  // 获取抗拔系数 λ，默认值：黏性土取0.7，砂土取0.55
  const getLambda = (layerKey: string): number => {
    const p = input.soilParamsByLayer[layerKey];
    if (!p) return 0.7; // 默认值
    const lambda = Number(p.upliftCoeffLambda);
    if (Number.isFinite(lambda) && lambda > 0 && lambda <= 1) {
      return lambda;
    }
    // 如果没有指定λ，返回默认值
    return 0.7;
  };

  const lambdaValues: Array<{ layerKey: string; lambda: number; qsik: number; li: number; contribution: number }> = [];
  let totalLength = 0;
  let sumQsikLi = 0;
  
  // Tsk0 = Σ(λi × qsik × u × li)，qsik 为特征值
  const Tsk0 = input.segmentThicknessByLayer.reduce((acc, seg) => {
    const qsik = getQsik(seg.layerKey);
    if (qsik == null) return acc;
    const li = Number(seg.lengthM);
    if (!Number.isFinite(li) || li <= 0) return acc;
    
    totalLength += li;
    sumQsikLi += qsik * li;
    const lambda = getLambda(seg.layerKey);
    const contribution = lambda * qsik * u * li;
    
    lambdaValues.push({
      layerKey: seg.layerKey,
      lambda,
      qsik,
      li,
      contribution,
    });
    
    return acc + contribution;
  }, 0);

  // 异型桩（竹节桩/螺锁方桩）抗拔侧阻力也需乘 βc
  const qsikWeightedAvgKpa = totalLength > 0 ? sumQsikLi / totalLength : NaN;
  const betaC = isBetaCPile(input.pileType) ? calcBetaC(qsikWeightedAvgKpa) : 1;
  const Tsk = betaC !== 1 ? betaC * Tsk0 : Tsk0;

  // 桩身自重 Gp = γc × Ap × L
  const Gp = GAMMA_CONCRETE * Ap * totalLength;

  // 抗拔承载力特征值 Ta = 侧阻力特征值 + 桩身自重
  const Ta = Tsk + Gp;

  return {
    Ta,
    Tsk,
    Gp,
    u,
    Ap,
    totalLength,
    lambdaValues,
    ...(betaC !== 1 ? { betaC, qsikWeightedAvgKpa } : null),
  };
};
