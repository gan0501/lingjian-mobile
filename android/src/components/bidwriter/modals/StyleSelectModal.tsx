import React, { FC, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { X, Check } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';

interface CoverOption {
  id: string;
  name: string;
  image: any;
}

interface LayoutOption {
  id: string;
  name: string;
  image: any;
  hasImages?: boolean;
  hasPageBorder?: boolean;
}

interface ColorOption {
  id: string;
  name: string;
  color: string;
}

interface StyleSelectModalProps {
  visible: boolean;
  onClose: () => void;
  coverOptions: CoverOption[];
  layoutOptions: LayoutOption[];
  colorOptions: ColorOption[];
  selectedCover: string;
  selectedLayout: string;
  selectedColor: string;
  onSelectCover: (coverId: string) => void;
  onSelectLayout: (layoutId: string, hasImages?: boolean, hasPageBorder?: boolean) => void;
  onSelectColor: (colorId: string) => void;
}

export const StyleSelectModal: FC<StyleSelectModalProps> = ({
  visible,
  onClose,
  coverOptions,
  layoutOptions,
  colorOptions,
  selectedCover,
  selectedLayout,
  selectedColor,
  onSelectCover,
  onSelectLayout,
  onSelectColor,
}) => {
  const { colors, isDark } = useTheme();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(SCREEN_HEIGHT);
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.bottomSheet, {
          transform: [{ translateY: slideAnim }],
          backgroundColor: colors.surface,
          borderColor: isDark ? 'rgba(178, 0, 0, 0.3)' : colors.border,
        }]}>
          <View style={[styles.bottomSheetHeader, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.bottomSheetTitle, { color: colors.text }]}>标书样式</Text>
              <Text style={[styles.bottomSheetSubtitle, { color: colors.textMuted }]}>以下选项决定导出标书的风格样式</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.bottomSheetContent}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>封面</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.coverScrollView}
            >
              {coverOptions.map((cover) => (
                <TouchableOpacity
                  key={cover.id}
                  style={[
                    styles.coverOption,
                    {
                      borderColor: selectedCover === cover.id ? 'rgba(178, 0, 0, 0.4)' : colors.border,
                      backgroundColor: selectedCover === cover.id
                        ? (isDark ? 'rgba(178, 0, 0, 0.2)' : 'rgba(178, 0, 0, 0.08)')
                        : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                    },
                  ]}
                  onPress={() => onSelectCover(cover.id)}
                >
                  <Image source={cover.image} style={[styles.coverPreview, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]} resizeMode="cover" />
                  <Text style={[styles.optionLabel, { color: colors.textMuted }]}>{cover.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.sectionLabel, { color: colors.text }]}>版式</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.layoutScrollView}
              contentContainerStyle={styles.layoutScrollContent}
            >
              {layoutOptions.map((layout) => (
                <TouchableOpacity
                  key={layout.id}
                  style={[
                    styles.layoutOption,
                    {
                      borderColor: selectedLayout === layout.id ? 'rgba(178, 0, 0, 0.4)' : colors.border,
                      backgroundColor: selectedLayout === layout.id
                        ? (isDark ? 'rgba(178, 0, 0, 0.2)' : 'rgba(178, 0, 0, 0.08)')
                        : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                    },
                  ]}
                  onPress={() => onSelectLayout(layout.id, layout.hasImages, layout.hasPageBorder)}
                >
                  <Image source={layout.image} style={[styles.layoutPreview, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]} resizeMode="cover" />
                  <Text style={[styles.optionLabelSmall, { color: colors.textMuted }]}>{layout.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.sectionLabel, { color: colors.text }]}>色系</Text>
            <View style={styles.colorRow}>
              {colorOptions.map((color) => (
                <TouchableOpacity
                  key={color.id}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color.color },
                    selectedColor === color.id && styles.colorOptionSelected,
                  ]}
                  onPress={() => onSelectColor(color.id)}
                >
                  {selectedColor === color.id && (
                    <Check size={16} color="#000" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    borderWidth: 1,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  bottomSheetSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  bottomSheetContent: {
    padding: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  coverScrollView: {
    marginBottom: 16,
  },
  coverOption: {
    width: 75,
    alignItems: 'center',
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 10,
  },
  coverPreview: {
    width: 60,
    height: 80,
    borderRadius: 4,
    marginBottom: 6,
  },
  optionLabel: {
    fontSize: 10,
  },
  layoutScrollView: {
    height: 110,
    marginBottom: 16,
  },
  layoutScrollContent: {
    paddingRight: 16,
  },
  layoutOption: {
    width: 140,
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 12,
  },
  layoutPreview: {
    width: 120,
    height: 80,
    borderRadius: 6,
    marginBottom: 6,
  },
  optionLabelSmall: {
    fontSize: 10,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    paddingVertical: 8,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#B20000',
    shadowColor: '#B20000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 6,
  },
});
