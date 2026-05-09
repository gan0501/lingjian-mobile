import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet from './BottomSheet';

type PilePickerKey = 'pile_type' | 'reference_standard' | 'strength_grade' | 'outer_diameter' | 'wall_thickness' | 'pile_model';

const FIELD_ORDER: PilePickerKey[] = [
  'pile_type', 'reference_standard', 'strength_grade',
  'outer_diameter', 'wall_thickness', 'pile_model',
];

const FIELD_TITLES: Record<PilePickerKey, string> = {
  pile_type: '桩型',
  reference_standard: '参考标准',
  strength_grade: '混凝土等级',
  outer_diameter: '外径',
  wall_thickness: '壁厚',
  pile_model: '型号',
};

type Props = {
  visible: boolean;
  styles: Record<string, any>;
  derivedSpecification?: string;
  pileModalDraft: any;
  pilePickerKey: PilePickerKey | null;
  pileOverlayTop: number;
  getDropdownOptions: (key: PilePickerKey) => string[];
  applyPileDraftSelection: (key: PilePickerKey, value: string) => void;
  onRequestClosePicker: () => void;
  onOpenPicker: (key: PilePickerKey) => void;
  onRegisterAnchorLayout: (key: PilePickerKey, y: number, height: number) => void;
  onDismiss: () => void;
  onDelete: () => void;
  onConfirm: () => void;
};

const PileTypeDialog: React.FC<Props> = ({
  visible,
  derivedSpecification,
  pileModalDraft,
  getDropdownOptions,
  applyPileDraftSelection,
  onDismiss,
  onDelete,
  onConfirm,
}) => {
  const [expandedField, setExpandedField] = useState<PilePickerKey | null>(null);
  const enabled = !!String(pileModalDraft?.pile_type ?? '').trim();

  const handleSelect = useCallback((key: PilePickerKey, value: string) => {
    applyPileDraftSelection(key, value);
    const idx = FIELD_ORDER.indexOf(key);
    if (idx >= 0 && idx < FIELD_ORDER.length - 1) {
      setExpandedField(FIELD_ORDER[idx + 1]);
    } else {
      setExpandedField(null);
    }
  }, [applyPileDraftSelection]);

  const renderField = (key: PilePickerKey) => {
    const isEnabled = key === 'pile_type' || enabled;
    const value = pileModalDraft?.[key] ?? '';
    const isExpanded = expandedField === key;
    const rawOptions = isExpanded && isEnabled ? getDropdownOptions(key) : [];
    const options = [...rawOptions].sort((a, b) => {
      const na = Number(a), nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });

    return (
      <View key={key}>
        <TouchableOpacity
          style={[s.fieldHeader, isExpanded && s.fieldHeaderActive]}
          activeOpacity={0.7}
          disabled={!isEnabled}
          onPress={() => setExpandedField(isExpanded ? null : key)}
        >
          <Text style={[s.fieldTitle, !isEnabled && s.fieldTitleDisabled]}>
            {FIELD_TITLES[key]}
          </Text>
          <Text style={[s.fieldValue, value ? s.fieldValueSelected : null]}>
            {value || '未选择'}
          </Text>
          <Text style={[s.arrow, !isEnabled && s.arrowDisabled]}>
            {isExpanded ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>

        {isExpanded && options.length > 0 && (
          <View style={s.optionsList}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[s.optionRow, value === opt && s.optionRowSelected]}
                activeOpacity={0.7}
                onPress={() => handleSelect(key, opt)}
              >
                <Text style={[s.optionText, value === opt && s.optionTextSelected]}>
                  {opt}
                </Text>
                {value === opt && <Text style={s.checkMark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={s.divider} />
      </View>
    );
  };

  const footer = (
    <View style={s.footerRow}>
      <TouchableOpacity onPress={onDelete} activeOpacity={0.7}>
        <Text style={s.deleteText}>删除桩型</Text>
      </TouchableOpacity>
      <View style={s.footerRight}>
        <TouchableOpacity style={s.cancelBtn} onPress={onDismiss} activeOpacity={0.8}>
          <Text style={s.cancelText}>取消</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.confirmBtn, !pileModalDraft?.pile_type && s.confirmBtnDisabled]}
          onPress={onConfirm}
          activeOpacity={0.8}
          disabled={!pileModalDraft?.pile_type}
        >
          <Text style={s.confirmText}>确认</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <BottomSheet visible={visible} title="选择桩型" onDismiss={onDismiss} footer={footer}>
      <Text style={s.specDesc}>{derivedSpecification || '请选择桩型规格'}</Text>
      <View style={{ height: 12 }} />
      <View style={s.divider} />
      {FIELD_ORDER.map(renderField)}
    </BottomSheet>
  );
};

const s = StyleSheet.create({
  specDesc: { fontSize: 12, color: 'rgba(0,0,0,0.4)' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)' },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 4,
  },
  fieldHeaderActive: { backgroundColor: '#FAFAFA' },
  fieldTitle: { flex: 1, fontSize: 14, fontWeight: '500', color: '#333' },
  fieldTitleDisabled: { color: 'rgba(0,0,0,0.25)' },
  fieldValue: { fontSize: 13, color: 'rgba(0,0,0,0.3)', marginRight: 6 },
  fieldValueSelected: { color: '#B20000' },
  arrow: { fontSize: 10, color: 'rgba(0,0,0,0.3)' },
  arrowDisabled: { color: 'rgba(0,0,0,0.12)' },
  optionsList: { },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 16,
    backgroundColor: '#F8F8F8',
  },
  optionRowSelected: { backgroundColor: 'rgba(178,0,0,0.06)' },
  optionText: { flex: 1, fontSize: 13, color: '#555' },
  optionTextSelected: { color: '#B20000' },
  checkMark: { fontSize: 13, color: '#B20000' },
  footerRow: { flexDirection: 'row', alignItems: 'center' },
  footerRight: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  deleteText: { fontSize: 13, color: '#FF6B6B' },
  cancelBtn: {
    backgroundColor: '#F5F5F5',
    height: 38,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: { fontSize: 14, color: '#666' },
  confirmBtn: {
    backgroundColor: '#B20000',
    height: 38,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmText: { fontSize: 14, color: '#FFF' },
});

export default PileTypeDialog;
