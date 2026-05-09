import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BottomSheet from './BottomSheet';

type Props = {
  visible: boolean;
  styles: Record<string, any>;
  tensionLengthValue: string;
  enterDepthValue: string;
  maxTensionLength: number;
  onChangeTensionLength: (v: string) => void;
  onChangeEnterDepth: (v: string) => void;
  onDismiss: () => void;
  onConfirm: () => void;
};

const LengthDialog: React.FC<Props> = ({
  visible,
  tensionLengthValue,
  enterDepthValue,
  maxTensionLength,
  onChangeTensionLength,
  onChangeEnterDepth,
  onDismiss,
  onConfirm,
}) => {
  const footer = (
    <View style={s.footerRow}>
      <TouchableOpacity style={s.cancelBtn} onPress={onDismiss} activeOpacity={0.8}>
        <Text style={s.cancelText}>取消</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.confirmBtn} onPress={onConfirm} activeOpacity={0.8}>
        <Text style={s.confirmText}>确认</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <BottomSheet visible={visible} title="单项进入深度" onDismiss={onDismiss} footer={footer}>
      <View style={{ gap: 14 }}>
        {/* 抗拔长度 */}
        <View style={{ gap: 6 }}>
          <Text style={s.label}>抗拔长度</Text>
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              placeholder="默认通长计算"
              placeholderTextColor="rgba(0,0,0,0.35)"
              keyboardType="numeric"
              value={tensionLengthValue}
              onChangeText={onChangeTensionLength}
            />
            <Text style={s.suffix}>m</Text>
          </View>
          <Text style={s.hint}>最大可输入: {maxTensionLength.toFixed(2)}m（桩长）</Text>
        </View>

        {/* 进入持力层深度 */}
        <View style={{ gap: 6 }}>
          <Text style={s.label}>进入持力层深度</Text>
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              placeholder="请输入"
              placeholderTextColor="rgba(0,0,0,0.35)"
              keyboardType="numeric"
              value={enterDepthValue}
              onChangeText={onChangeEnterDepth}
            />
            <Text style={s.suffix}>m</Text>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

const s = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', color: '#111' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    height: 40,
  },
  input: { flex: 1, fontSize: 13, color: '#111', padding: 0 },
  suffix: { fontSize: 13, color: '#999', marginLeft: 6 },
  hint: { fontSize: 11, color: '#666' },
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

export default LengthDialog;
