import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BottomSheet from './BottomSheet';

type LayerItem = { key: string; label: string; name: string };

type Props = {
  visible: boolean;
  styles: Record<string, any>;
  layerMenuVisible: boolean;
  availableBearingLayers: LayerItem[];
  layerLabelText: string;
  enterDepthValue: string;
  enterDepthPlaceholder?: string;
  onChangeEnterDepth: (v: string) => void;
  onOpenLayerMenu: () => void;
  onDismissLayerMenu: () => void;
  onSelectLayerKey: (key: string) => void;
  onDismiss: () => void;
  onConfirm: () => void;
  confirmDisabled: boolean;
};

const BearingLayerDialog: React.FC<Props> = ({
  visible,
  availableBearingLayers,
  layerLabelText,
  enterDepthValue,
  enterDepthPlaceholder,
  onChangeEnterDepth,
  onSelectLayerKey,
  onDismiss,
  onConfirm,
  confirmDisabled,
}) => {
  const [showLayerList, setShowLayerList] = React.useState(false);
  const [selectedKey, setSelectedKey] = React.useState('');

  React.useEffect(() => {
    if (visible) {
      setShowLayerList(false);
      setSelectedKey('');
    }
  }, [visible]);

  const footer = (
    <View style={s.footerRow}>
      <TouchableOpacity style={s.cancelBtn} onPress={onDismiss} activeOpacity={0.8}>
        <Text style={s.cancelText}>取消</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.confirmBtn, confirmDisabled && s.confirmBtnDisabled]}
        onPress={onConfirm}
        activeOpacity={0.8}
        disabled={confirmDisabled}
      >
        <Text style={s.confirmText}>确认</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <BottomSheet visible={visible} title="统一持力层" onDismiss={onDismiss} footer={footer}>
      <View style={{ gap: 14 }}>
        {/* 持力层选择 */}
        <View style={{ gap: 6 }}>
          <Text style={s.label}>持力层</Text>
          <TouchableOpacity
            style={s.dropdownBtn}
            activeOpacity={0.7}
            onPress={() => setShowLayerList(!showLayerList)}
            disabled={availableBearingLayers.length === 0}
          >
            <Text style={s.dropdownText} numberOfLines={1}>{layerLabelText}</Text>
            <Text style={s.arrow}>{showLayerList ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showLayerList && (
            <View style={s.layerList}>
              {availableBearingLayers.map((it) => (
                <TouchableOpacity
                  key={it.key}
                  style={[s.layerRow, selectedKey === it.key && s.layerRowSelected]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedKey(it.key);
                    onSelectLayerKey(it.key);
                    setShowLayerList(false);
                  }}
                >
                  <Text style={[s.layerText, selectedKey === it.key && s.layerTextSelected]}>
                    {`${it.label} ${it.name || ''}`.trim()}
                  </Text>
                  {selectedKey === it.key && <Text style={s.checkMark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* 进入持力层深度 */}
        <View style={{ gap: 6 }}>
          <Text style={s.label}>进入持力层深度</Text>
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              value={enterDepthValue}
              onChangeText={onChangeEnterDepth}
              placeholder={enterDepthPlaceholder}
              placeholderTextColor="rgba(0,0,0,0.35)"
              keyboardType="numeric"
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
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    backgroundColor: '#fff',
  },
  dropdownText: { flex: 1, fontSize: 13, color: '#333' },
  arrow: { fontSize: 10, color: 'rgba(0,0,0,0.3)' },
  layerList: { borderRadius: 8, overflow: 'hidden' },
  layerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: '#F8F8F8',
  },
  layerRowSelected: { backgroundColor: 'rgba(178,0,0,0.06)' },
  layerText: { flex: 1, fontSize: 13, color: '#555' },
  layerTextSelected: { color: '#B20000' },
  checkMark: { fontSize: 13, color: '#B20000' },
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
  confirmBtnDisabled: { opacity: 0.4 },
  confirmText: { fontSize: 14, color: '#FFF' },
});

export default BearingLayerDialog;
