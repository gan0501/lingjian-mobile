import { Loading } from '@/components/common/Loading';
import React from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import CompareTable from './CompareTable';
import ComparisonReportControls from './ComparisonReportControls';
import { usePileComparisonContext } from '../PileComparisonContext';

type Props<FaceId extends string = string, FaceConfig = any, CompareRow = any> = {
  faceConfig: FaceConfig;
  layerText: string;
  collapsed: boolean;
  schemeIndex: number;
  isPinned: boolean;
  pinnedEmojiText?: string;
  planResults?: any[];
  compareVisible: boolean;
  reportVisible?: boolean;
  compareRows: CompareRow[];
  soilLayerByKey: Map<string, any>;
  groundElevation?: number;
  loading: boolean;
  styles: Record<string, any>;
  formatSignedElevationDisplay: (raw: string) => string;
  onTogglePin: (face: FaceId) => void;
  onOpenLayerModal: (face: FaceId) => void;
  onToggleCollapsed: (face: FaceId) => void;
  onAddCompareRow: (face: FaceId) => void;
  onStartCalculation: () => void;
  onPressPile: (face: FaceId, rowIndex: number) => void;
  onPressLength: (face: FaceId, rowIndex: number) => void;
  onPressUnitCost: (face: FaceId, rowIndex: number) => void;
  onOpenLoadElevationModal?: (face: FaceId) => void;

  comparisonReportGenerating: boolean;
  isValidUnitCost: (v: any) => boolean;
  onGenerateComparisonReport: (face: FaceId) => void;
  validateBeforeOpenReportConfirm?: (face: FaceId) => string | null | undefined;
  lastCalculatedAt?: number;
};

const PlanFaceCard = <FaceId extends string = string, FaceConfig extends { face: FaceId } = any, CompareRow = any>({
  faceConfig,
  layerText,
  collapsed,
  schemeIndex,
  isPinned,
  pinnedEmojiText = '\u{1F51D}',
  planResults,
  compareVisible,
  reportVisible,
  compareRows,
  soilLayerByKey,
  groundElevation,
  loading,
  styles,
  formatSignedElevationDisplay,
  onTogglePin,
  onOpenLayerModal,
  onToggleCollapsed,
  onAddCompareRow,
  onStartCalculation,
  onPressPile,
  onPressLength,
  onPressUnitCost,
  onOpenLoadElevationModal,
  comparisonReportGenerating,
  isValidUnitCost,
  onGenerateComparisonReport,
  validateBeforeOpenReportConfirm,
  lastCalculatedAt,
}: Props<FaceId, FaceConfig, CompareRow>) => {
  const face = (faceConfig as any).face as FaceId;
  const { comparisonReports } = usePileComparisonContext();
  const latestDoneReportId = React.useMemo(() => {
    const list = Array.isArray(comparisonReports) ? comparisonReports : [];
    const done = list.filter((x: any) => x && x.status === 'done' && String(x.id || '').trim());
    if (done.length === 0) return '';
    done.sort((a: any, b: any) => {
      const ta = new Date(String(a.updated_at || a.created_at || 0)).getTime();
      const tb = new Date(String(b.updated_at || b.created_at || 0)).getTime();
      return tb - ta;
    });
    
    const latest = done[0];
    if (latest && lastCalculatedAt) {
      const latestTime = new Date(String(latest.updated_at || latest.created_at || 0)).getTime();
      // Use 1-second margin to avoid minor clock sync mismatch, though Date.now() should suffice locally
      if (latestTime < lastCalculatedAt) {
        return '';
      }
    }
    
    return String(latest?.id || '').trim();
  }, [comparisonReports, lastCalculatedAt]);

  return (
    <View style={styles.card}>
      <View style={[styles.cardHeaderRow, collapsed ? styles.cardHeaderRowCollapsed : null]}>
        <View style={styles.cardTitleRow}>
          <TouchableOpacity style={styles.pinBtn} activeOpacity={0.8} onPress={() => onTogglePin(face)}>
            <Image
              source={isPinned ? require('@/assets/images/up_on.png') : require('@/assets/images/up_of.png')}
              style={styles.pinIcon}
            />
          </TouchableOpacity>
          <Text style={styles.cardTitle}>{`计算方案${schemeIndex}`}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.layerChipHeader} onPress={() => onOpenLayerModal(face)} activeOpacity={0.85}>
            <Text style={styles.layerChipHeaderText} numberOfLines={1}>
              {layerText}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.faceBadge, collapsed ? styles.faceBadgeCollapsed : null]}
            activeOpacity={0.8}
            onPress={() => onToggleCollapsed(face)}
          >
            <Text style={[styles.faceBadgeText, collapsed ? styles.faceBadgeTextCollapsed : null]}>{String(face)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!collapsed && (
        <>
          {planResults && planResults.length > 0 ? (
            <View style={{ gap: 8, marginTop: 10 }}>
              {planResults.map((r, idx) => (
                <View key={idx} style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={styles.cardText}>{(r as any).rank ?? idx + 1}</Text>
                  <Text style={styles.cardText}>{(r as any).pile_type}</Text>
                  <Text style={styles.cardText}>{(r as any).spec}</Text>
                  <Text style={styles.cardText}>{(r as any).length}m</Text>
                  <Text style={styles.cardText}>{(r as any).design_capacity}kN</Text>
                  <Text style={styles.cardText}>{(r as any).total_cost ? `¥${(r as any).total_cost}` : '-'}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.cardText, { marginTop: 10 }]}>
              根据选定持力层与桩型规格，按单桩承载力公式计算极限值与设计值，联动信息价进行经济性对比，输出最终方案列表。
            </Text>
          )}

          <View style={styles.rowBetween}>
            <View style={styles.leftGroupWithInfo}>
              <TouchableOpacity style={[styles.actionBtn, styles.addCompareBtn]} onPress={() => onAddCompareRow(face)}>
                <Text style={[styles.actionText, styles.addCompareBtnText]}>增加对比桩型</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.infoStack}
                activeOpacity={0.7}
                onPress={() => onOpenLoadElevationModal?.(face)}
              >
                <View style={styles.infoRow}>
                  <Text style={styles.topElevationText} numberOfLines={1}>
                    桩顶标高{' '}
                    {(() => {
                      const val = formatSignedElevationDisplay(
                        (faceConfig as any).pileTopElevation || (groundElevation != null && !Number.isNaN(Number(groundElevation)) ? String(Number(groundElevation)) : '')
                      );
                      if (val) return val;
                      return (
                        <Text style={{ color: '#FFC107' }}>
                          <Text>⚠️</Text>
                          <Text style={{ marginLeft: 3 }}>待补充</Text>
                        </Text>
                      );
                    })()}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.columnLoadText} numberOfLines={1}>
                    柱下荷载{' '}
                    {(() => {
                      const compression = (faceConfig as any).columnLoadCompression;
                      const tension = (faceConfig as any).columnLoadTension;
                      if (compression && tension) return `${compression}KN(压) ${tension}KN(拔)`;
                      if (compression) return `${compression}KN(压)`;
                      if (tension) return `${tension}KN(拔)`;
                      return (
                        <Text style={{ color: '#FFC107' }}>
                          <Text>⚠️</Text>
                          <Text style={{ marginLeft: 3 }}>待补充</Text>
                        </Text>
                      );
                    })()}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn, styles.rightAlignedBtn]} onPress={onStartCalculation}>
              <View style={{ width: 64, height: 18, alignItems: 'center', justifyContent: 'center' }}>
                {loading ? <Loading size="small" color="#fff" /> : <Text style={styles.actionPrimaryText}>开始计算</Text>}
              </View>
            </TouchableOpacity>
          </View>

          <CompareTable<FaceId, CompareRow, FaceConfig>
            face={face}
            faceConfig={faceConfig}
            visible={compareVisible}
            rows={compareRows || []}
            soilLayerByKey={soilLayerByKey}
            groundElevation={groundElevation}
            styles={styles}
            onPressPile={onPressPile}
            onPressLength={onPressLength}
            onPressUnitCost={onPressUnitCost}
          />

          {!!reportVisible && (
            <ComparisonReportControls<FaceId, CompareRow>
              face={face}
              rows={compareRows || []}
              isValidUnitCost={isValidUnitCost}
              disabled={comparisonReportGenerating}
              onGenerate={onGenerateComparisonReport}
              validateBeforeOpenConfirm={validateBeforeOpenReportConfirm}
              styles={styles}
              containerStyle={{ marginTop: 10 }}
              reportId={latestDoneReportId}
            />
          )}
        </>
      )}
    </View>
  );
};

export default PlanFaceCard;
