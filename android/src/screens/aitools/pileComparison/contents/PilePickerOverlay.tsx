import React from 'react';
import { Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';

type PilePickerKey = 'pile_type' | 'reference_standard' | 'strength_grade' | 'outer_diameter' | 'wall_thickness' | 'pile_model';

type Props = {
  visible: boolean;
  pickerKey: PilePickerKey | null;
  top: number;
  styles: Record<string, any>;
  getOptions: (key: PilePickerKey) => string[];
  onSelect: (key: PilePickerKey, value: string) => void;
  onRequestClose: () => void;
};

const PilePickerOverlay: React.FC<Props> = ({
  visible,
  pickerKey,
  top,
  styles,
  getOptions,
  onSelect,
  onRequestClose,
}) => {
  if (!visible || !pickerKey) return null;

  const options = getOptions(pickerKey) || [];

  return (
    <>
      <Pressable style={styles.pileOverlayBackdrop} onPress={onRequestClose} />
      <View style={[styles.pileOverlayPanel, { top }]}>
        <ScrollView style={styles.pileOverlayScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {options.map((v: string, idx: number) => (
            <TouchableOpacity
              key={`${pickerKey}-${v}-${idx}`}
              style={[styles.pilePickItem, idx < options.length - 1 ? styles.pilePickDivider : null]}
              activeOpacity={0.85}
              onPress={() => onSelect(pickerKey, v)}
            >
              <Text style={styles.pilePickText} numberOfLines={2}>
                {v}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </>
  );
};

export default PilePickerOverlay;
