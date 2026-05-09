import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, StyleProp, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Check } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

type Props<FaceId extends string = string, CompareRow = any> = {
  face: FaceId;
  rows: CompareRow[];
  isValidUnitCost: (v: any) => boolean;
  disabled: boolean;
  onGenerate: (face: FaceId) => void;
  validateBeforeOpenConfirm?: (face: FaceId) => string | null | undefined;
  styles: Record<string, any>;
  containerStyle?: StyleProp<ViewStyle>;
  reportId?: string;
  onViewReport?: (reportId: string) => void;
};

const ComparisonReportControls = <FaceId extends string, CompareRow = any>({
  face,
  rows,
  isValidUnitCost,
  disabled,
  onGenerate,
  validateBeforeOpenConfirm,
  styles,
  containerStyle,
  reportId,
  onViewReport,
}: Props<FaceId, CompareRow>) => {
  const navigation = useNavigation<any>();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [checks, setChecks] = useState({ understandLongTime: false, allowBackground: false });

  const openConfirm = useCallback(() => {
    if (disabled) {
      Alert.alert('提示', '对比报告正在生成中，请稍候…');
      return;
    }

    const blockMsg = validateBeforeOpenConfirm?.(face);
    if (blockMsg) {
      Alert.alert('提示', blockMsg);
      return;
    }

    const meaningfulRows = (rows || []).filter((r: any) => {
      const pileType = String(r?.pileType ?? '').trim();
      const spec = String(r?.spec ?? '').trim();
      const qukOk = typeof r?.Quk === 'number' && Number.isFinite(r.Quk);
      return !!pileType || !!spec || qukOk;
    });

    if (meaningfulRows.length === 0) {
      Alert.alert('提示', '请先添加对比桩型并填写单价，再生成对比报告');
      return;
    }

    const missingPrice = meaningfulRows.some((r: any) => !isValidUnitCost(r?.unitCost));
    if (missingPrice) {
      Alert.alert('提示', '生成对比报告前，请先为所有对比桩型填写单价');
      return;
    }

    setChecks({ understandLongTime: false, allowBackground: false });
    setConfirmVisible(true);
  }, [disabled, face, rows, isValidUnitCost, validateBeforeOpenConfirm]);

  const confirm = useCallback(() => {
    const ok = checks.understandLongTime && checks.allowBackground;
    if (!ok) return;
    setConfirmVisible(false);
    onGenerate(face);
  }, [checks.allowBackground, checks.understandLongTime, face, onGenerate]);

  const hasViewBtn = !!reportId && !disabled;

  return (
    <>
      <View style={containerStyle}>
        <View style={{ flexDirection: 'row', gap: 10, justifyContent: hasViewBtn ? 'flex-start' : 'center' }}>
          <Pressable
            style={[
              styles.actionBtn,
              styles.primaryBtn,
              styles.genAdviceBtn,
              {
                flex: hasViewBtn ? 1 : undefined,
                justifyContent: 'center',
                alignItems: 'center',
                alignSelf: hasViewBtn ? undefined : 'center',
              },
              disabled && styles.genAdviceBtnDisabled,
            ]}
            android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
            hitSlop={10}
            disabled={disabled}
            onPress={openConfirm}
          >
            <Text style={[styles.actionPrimaryText, { textAlign: 'center' }]}>{disabled ? '报告生成中...' : '生成对比报告'}</Text>
          </Pressable>

          {hasViewBtn && (
            <Pressable
              style={[
                styles.actionBtn,
                {
                  flex: 2,
                  backgroundColor: '#CCCCCC',
                  borderRadius: 8,
                  height: 42,
                  justifyContent: 'center',
                  alignItems: 'center',
                },
              ]}
              android_ripple={{ color: 'rgba(0,0,0,0.10)' }}
              hitSlop={10}
              onPress={() => {
                const rid = String(reportId || '').trim();
                if (!rid) return;
                if (onViewReport) {
                  onViewReport(rid);
                } else {
                  navigation.navigate('ReportViewer', { reportId: rid });
                }
              }}
            >
              <Text style={{ color: '#000', fontWeight: '700', textAlign: 'center' }}>查看报告</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmModalTitle}>生成前确认</Text>
            <Text style={styles.confirmModalSubtitle}>对比报告可能生成超过5分钟</Text>

            <View style={styles.confirmCheckList}>
              <TouchableOpacity
                style={styles.confirmCheckItem}
                onPress={() => setChecks((prev) => ({ ...prev, understandLongTime: !prev.understandLongTime }))}
              >
                <View style={[styles.confirmCheckbox, checks.understandLongTime && styles.confirmCheckboxChecked]}>
                  {checks.understandLongTime && <Check size={14} color="#fff" />}
                </View>
                <Text style={styles.confirmCheckText}>我已知晓生成时间较长</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmCheckItem}
                onPress={() => setChecks((prev) => ({ ...prev, allowBackground: !prev.allowBackground }))}
              >
                <View style={[styles.confirmCheckbox, checks.allowBackground && styles.confirmCheckboxChecked]}>
                  {checks.allowBackground && <Check size={14} color="#fff" />}
                </View>
                <Text style={styles.confirmCheckText}>生成会在后台进行，可切换到桌面</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.confirmModalButtons}>
              <TouchableOpacity style={styles.confirmModalCancelBtn} onPress={() => setConfirmVisible(false)}>
                <Text style={styles.confirmModalCancelText}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmModalConfirmBtn,
                  !(checks.understandLongTime && checks.allowBackground) && styles.confirmModalConfirmBtnDisabled,
                ]}
                onPress={confirm}
                disabled={!(checks.understandLongTime && checks.allowBackground)}
              >
                <Text
                  style={[
                    styles.confirmModalConfirmText,
                    !(checks.understandLongTime && checks.allowBackground) && styles.confirmModalConfirmTextDisabled,
                  ]}
                >
                  开始生成
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default ComparisonReportControls;
