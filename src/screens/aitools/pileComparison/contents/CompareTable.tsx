import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

type Props<FaceId extends string = string, CompareRow = any, FaceConfig = any> = {
  face: FaceId;
  faceConfig: FaceConfig;
  visible: boolean;
  rows: CompareRow[];
  soilLayerByKey: Map<string, any>;
  groundElevation?: number;
  styles: Record<string, any>;
  onPressPile: (face: FaceId, rowIndex: number) => void;
  onPressLength: (face: FaceId, rowIndex: number) => void;
  onPressUnitCost: (face: FaceId, rowIndex: number) => void;
};

const CompareTable = <FaceId extends string = string, CompareRow = any, FaceConfig = any>({
  face,
  faceConfig,
  visible,
  rows,
  soilLayerByKey,
  groundElevation,
  styles,
  onPressPile,
  onPressLength,
  onPressUnitCost,
}: Props<FaceId, CompareRow, FaceConfig>) => {
  if (!visible) return null;

  return (
    <View style={styles.compareWrap}>
      <View style={styles.compareHeaderRow}>
        <Text style={[styles.compareHeaderCell, styles.cellType]}>桩型</Text>
        <Text style={[styles.compareHeaderCell, styles.cellSpec]}>规格</Text>
        <Text style={[styles.compareHeaderCell, styles.cellLen]}>桩长</Text>
        <Text style={[styles.compareHeaderCell, styles.cellCost]}>单价</Text>
        <Text style={[styles.compareHeaderCell, styles.cellCheck]}>校验</Text>
      </View>

      {(rows || []).map((row: any, rowIndex: number) => {
        const layerKey = (faceConfig as any)?.layerKey;
        const layer = layerKey ? soilLayerByKey.get(layerKey) : null;
        const topElevationRaw = layer?.top_elevation;
        const topElevation = topElevationRaw != null ? Number(topElevationRaw) : NaN;
        const pileTop = (faceConfig as any)?.pileTopElevation
          ? Number((faceConfig as any).pileTopElevation)
          : groundElevation != null && !Number.isNaN(Number(groundElevation))
            ? Number(groundElevation)
            : NaN;
        const enterDepthRaw = String(row?.enterDepthMOverride ?? (faceConfig as any)?.enterDepthM ?? '').trim();
        const enterDepth = enterDepthRaw ? Number(enterDepthRaw) : 0;
        const lengthVal =
          Number.isFinite(pileTop) && Number.isFinite(topElevation)
            ? Math.max(0, pileTop - topElevation + (Number.isFinite(enterDepth) ? enterDepth : 0))
            : null;
        const lengthText = lengthVal == null ? '--' : `${lengthVal.toFixed(2)}`;

        return (
          <View key={rowIndex} style={styles.compareDataRow}>
            <TouchableOpacity
              style={[styles.compareCell, styles.cellType]}
              activeOpacity={0.85}
              onPress={() => onPressPile(face, rowIndex)}
            >
              <Text style={[styles.compareCellText, !row.pileType && { opacity: 0.35 }]} numberOfLines={1}>
                {row.pileType || '点击选择'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.compareCell, styles.cellSpec]}
              activeOpacity={0.85}
              onPress={() => onPressPile(face, rowIndex)}
            >
              <Text style={[styles.compareCellText, !row.spec && { opacity: 0.35 }]} numberOfLines={1}>
                {row.spec || '--'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.compareCell, styles.cellLen]}
              activeOpacity={0.85}
              onPress={() => onPressLength(face, rowIndex)}
            >
              <Text style={styles.compareCellText}>{lengthText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.compareCell, styles.cellCost]}
              activeOpacity={0.85}
              onPress={() => onPressUnitCost(face, rowIndex)}
            >
              <Text style={[styles.compareCellText, !row.unitCost && { opacity: 0.35 }]} numberOfLines={1}>
                {row.unitCost || '--'}
              </Text>
            </TouchableOpacity>

            <View style={[styles.compareCell, styles.cellCheck, { alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={styles.compareCellText} numberOfLines={1}>
                {(() => {
                  const quk = typeof row?.Quk === 'number' && Number.isFinite(row.Quk) ? row.Quk : null;
                  const qsk = typeof row?.Qsk === 'number' && Number.isFinite(row.Qsk) ? row.Qsk : null;
                  if (quk == null && qsk == null) return '--';
                  if (quk != null && qsk == null) return `${quk.toFixed(0)}`;
                  if (quk == null && qsk != null) return `${qsk.toFixed(0)}`;
                  return `${(quk as number).toFixed(0)}/${(qsk as number).toFixed(0)}`;
                })()}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default CompareTable;
