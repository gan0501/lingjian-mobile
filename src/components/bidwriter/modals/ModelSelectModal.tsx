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

interface Model {
  id: string;
  name: string;
  desc: string;
  color: string;
  icon: any;
  provider: string;
  code: string;
}

interface ModelSelectModalProps {
  visible: boolean;
  onClose: () => void;
  models: Model[];
  selectedModel: string;
  onSelect: (model: Model) => void;
}

export const ModelSelectModal: FC<ModelSelectModalProps> = ({
  visible,
  onClose,
  models,
  selectedModel,
  onSelect,
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
              <Text style={[styles.bottomSheetTitle, { color: colors.text }]}>选择AI模型</Text>
              <Text style={[styles.bottomSheetSubtitle, { color: colors.textMuted }]}>选择品牌，后端自动使用最新顶级模型</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.bottomSheetContent}>
            {models.map((model) => (
              <TouchableOpacity
                key={model.id}
                style={[
                  styles.modelItem,
                  {
                    backgroundColor: selectedModel === model.id
                      ? (isDark ? 'rgba(178, 0, 0, 0.2)' : 'rgba(178, 0, 0, 0.08)')
                      : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                    borderColor: selectedModel === model.id
                      ? 'rgba(178, 0, 0, 0.4)'
                      : colors.border,
                  },
                ]}
                onPress={() => onSelect(model)}
              >
                <View style={[styles.modelIconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                  <Image
                    source={model.icon}
                    style={styles.modelIconImage}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.modelInfo}>
                  <Text style={[styles.modelName, { color: selectedModel === model.id ? '#B20000' : colors.text }]}>{model.name}</Text>
                  <Text style={[styles.modelDesc, { color: colors.textMuted }]}>{model.desc}</Text>
                </View>
                {selectedModel === model.id && (
                  <Check size={20} color="#B20000" />
                )}
              </TouchableOpacity>
            ))}
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
  modelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  modelIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  modelIconImage: {
    width: 32,
    height: 32,
  },
  modelInfo: {
    flex: 1,
  },
  modelName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  modelDesc: {
    fontSize: 13,
  },
});
