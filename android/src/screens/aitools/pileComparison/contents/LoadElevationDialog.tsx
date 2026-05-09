import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BottomSheet from './BottomSheet';

type Props = {
  visible: boolean;
  styles: Record<string, any>;
  pileTopElevationValue: string;
  columnLoadCompression: string;
  columnLoadTension: string;
  groundElevation?: number;
  onDismiss: () => void;
  onConfirm: (payload: { pileTopElevationValue: string; columnLoadCompression: string; columnLoadTension: string }) => void;
};

const LoadElevationDialog: React.FC<Props> = ({
  visible,
  pileTopElevationValue,
  columnLoadCompression,
  columnLoadTension,
  groundElevation,
  onDismiss,
  onConfirm,
}) => {
  const [localPileTop, setLocalPileTop] = useState(pileTopElevationValue);
  const [localCompression, setLocalCompression] = useState(columnLoadCompression);
  const [localTension, setLocalTension] = useState(columnLoadTension);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setLocalPileTop(pileTopElevationValue);
      setLocalCompression(columnLoadCompression);
      setLocalTension(columnLoadTension);
      setErrorMsg(null);
    }
  }, [visible, pileTopElevationValue, columnLoadCompression, columnLoadTension]);

  const elevationPlaceholder = useMemo(() => {
    return groundElevation != null && !Number.isNaN(Number(groundElevation)) ? String(Number(groundElevation)) : '';
  }, [groundElevation]);

  const sanitizeSignedDecimal = (input: string): string => {
    let s = input.trim();
    if (s === '' || s === '+' || s === '-') return s;
    const sign = s.startsWith('-') ? '-' : s.startsWith('+') ? '+' : '';
    const body = s.replace(/[+-]/g, '');
    const sanitized = body.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    const limited = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;
    return `${sign}${limited}`;
  };

  const sanitizeNumber = (input: string): string => {
    let s = input.trim();
    if (s === '') return '';
    const sanitized = s.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    return parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;
  };

  const validateAndConfirm = () => {
    const c = localCompression.trim();
    const t = localTension.trim();
    if (!c && !t) { setErrorMsg('抗压或抗拔至少填写一项'); return; }
    if (c && isNaN(Number(c))) { setErrorMsg('抗压荷载必须为数值'); return; }
    if (t && isNaN(Number(t))) { setErrorMsg('抗拔荷载必须为数值'); return; }
    setErrorMsg(null);
    onConfirm({ pileTopElevationValue: localPileTop, columnLoadCompression: localCompression, columnLoadTension: localTension });
  };

  const footer = (
    <View style={s.footerRow}>
      <TouchableOpacity style={s.cancelBtn} onPress={onDismiss} activeOpacity={0.8}>
        <Text style={s.cancelText}>取消</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.confirmBtn} onPress={validateAndConfirm} activeOpacity={0.8}>
        <Text style={s.confirmText}>确认</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <BottomSheet visible={visible} title="桩顶标高与柱下荷载" onDismiss={onDismiss} footer={footer}>
      <View style={{ gap: 14 }}>
        {/* 桩顶标高 */}
        <View style={{ gap: 6 }}>
          <Text style={s.label}>桩顶标高</Text>
          <TextInput
            style={s.input}
            placeholder={elevationPlaceholder}
            placeholderTextColor="rgba(0,0,0,0.35)"
            keyboardType="default"
            value={localPileTop}
            onChangeText={(t) => {
              const v = sanitizeSignedDecimal(t);
              let sign = v.startsWith('-') ? '-' : v.startsWith('+') ? '+' : '';
              const body = v.replace(/[+-]/g, '');
              if (!sign && body) sign = '+';
              setLocalPileTop(`${sign}${body}`);
            }}
          />
        </View>

        {/* 柱下荷载 */}
        <View style={{ gap: 6 }}>
          <Text style={s.label}>柱下荷载</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.subLabel}>抗压（kN）</Text>
              <TextInput
                style={s.input}
                placeholder="0"
                placeholderTextColor="rgba(0,0,0,0.35)"
                keyboardType="numeric"
                value={localCompression}
                onChangeText={(t) => setLocalCompression(sanitizeNumber(t))}
              />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.subLabel}>抗拔（kN）</Text>
              <TextInput
                style={s.input}
                placeholder="0"
                placeholderTextColor="rgba(0,0,0,0.35)"
                keyboardType="numeric"
                value={localTension}
                onChangeText={(t) => setLocalTension(sanitizeNumber(t))}
              />
            </View>
          </View>
        </View>

        {errorMsg ? <Text style={s.error}>{errorMsg}</Text> : null}
      </View>
    </BottomSheet>
  );
};

const s = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', color: '#111' },
  subLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(0,0,0,0.6)' },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    fontSize: 13,
    color: '#111',
    backgroundColor: '#fff',
  },
  error: { fontSize: 11, color: '#B20000', fontWeight: '600' },
  footerRow: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: { fontSize: 14, color: '#666' },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#B20000',
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmText: { fontSize: 14, color: '#FFF' },
});

export default LoadElevationDialog;
