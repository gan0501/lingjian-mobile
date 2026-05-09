/**
 * FlagSettingsSheet V2 - 旗帜设置底部弹窗
 *
 * 用户自定义旗帜颜色（7色）+ 文字（1字）。
 * 旗帜插在地图上，标识跟进项目位置。
 *
 * - 创建者旗帜：用户自定义颜色/文字
 * - 协作旗帜：固定团队图标
 */
import React, { FC, useState, useEffect, memo, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  TextInput, ScrollView, Modal, Dimensions, Platform,
  Animated, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFlagStore } from '@/stores/useFlagStore';
import { DayColors } from '@/constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 旗帜图片资源 (1-7)
export const FLAG_IMAGES: Record<number, any> = {
  1: require('@/assets/images/flag/1.png'),
  2: require('@/assets/images/flag/2.png'),
  3: require('@/assets/images/flag/3.png'),
  4: require('@/assets/images/flag/4.png'),
  5: require('@/assets/images/flag/5.png'),
  6: require('@/assets/images/flag/6.png'),
  7: require('@/assets/images/flag/7.png'),
};

// 7色旗帜
const FLAG_COLORS = [
  { index: 1, label: '红', hex: '#8B1A2B' },
  { index: 2, label: '绿', hex: '#1B5E20' },
  { index: 3, label: '蓝', hex: '#1A237E' },
  { index: 4, label: '棕', hex: '#3E2723' },
  { index: 5, label: '紫', hex: '#4A148C' },
  { index: 6, label: '橙', hex: '#E65100' },
  { index: 7, label: '青', hex: '#00796B' },
];

interface FlagSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

const FlagSettingsSheet: FC<FlagSettingsSheetProps> = memo(({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const { flagSettings, setFlagColor, setFlagText } = useFlagStore();

  const [localColor, setLocalColor] = useState(flagSettings.colorIndex);
  const [localText, setLocalText] = useState(flagSettings.text);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Animation values
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [internalVisible, setInternalVisible] = useState(false);

  // Sync from store when opened
  useEffect(() => {
    if (visible) {
      setLocalColor(flagSettings.colorIndex);
      setLocalText(flagSettings.text);
      setInternalVisible(true);
      // Animate sheet up
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Animate sheet down
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setInternalVisible(false);
      });
    }
  }, [visible, flagSettings]);

  // Keyboard listeners
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSave = () => {
    setFlagColor(localColor);
    setFlagText(localText || '旗');
    onClose();
  };

  if (!internalVisible) return null;

  return (
    <Modal
      visible={true}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Overlay - no animation */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Sheet with slide animation */}
      <Animated.View
        style={[
          styles.sheetContainer,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 + keyboardHeight * 0.3 }]}>
          {/* Handle */}
          <TouchableOpacity style={styles.handleArea} onPress={onClose} activeOpacity={0.7}>
            <View style={styles.handle} />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.title}>旗帜设置</Text>
            <Text style={styles.subtitle}>自定义你在地图上的跟进标识</Text>

            {/* Flag preview - 创建者和协作者旗帜对比 */}
            <View style={styles.previewContainer}>
              <View style={styles.previewRow}>
                {/* 创建者旗帜 */}
                <View style={styles.previewItem}>
                  <View style={styles.previewWrapper}>
                    <Image
                      source={FLAG_IMAGES[localColor] || FLAG_IMAGES[1]}
                      style={styles.previewFlag}
                      resizeMode="contain"
                    />
                    <Text style={styles.previewText}>
                      {localText || '旗'}
                    </Text>
                  </View>
                  <Text style={styles.previewLabel}>跟进旗帜</Text>
                </View>
                {/* 协作者旗帜 */}
                <View style={styles.previewItem}>
                  <View style={styles.previewWrapper}>
                    <Image
                      source={require('@/assets/images/team.png')}
                      style={styles.previewFlag}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={styles.previewLabel}>协作旗帜</Text>
                </View>
              </View>
            </View>

            {/* Text input */}
            <Text style={styles.sectionLabel}>旗帜文字（一个字）</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                value={localText}
                onChangeText={(t) => setLocalText(t.slice(0, 1))}
                placeholder="旗"
                placeholderTextColor="#CCCCCC"
                maxLength={1}
                textAlign="center"
                autoCorrect={false}
              />
              <Text style={styles.inputHint}>输入一个汉字或字母</Text>
            </View>

            {/* Color picker */}
            <Text style={styles.sectionLabel}>旗帜颜色</Text>
            <View style={styles.colorRow}>
              {FLAG_COLORS.map((c) => (
                <TouchableOpacity
                  key={c.index}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c.hex },
                    localColor === c.index && styles.colorCircleActive,
                  ]}
                  onPress={() => setLocalColor(c.index)}
                  activeOpacity={0.7}
                >
                  {localColor === c.index && (
                    <Text style={styles.colorCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Save button */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              activeOpacity={0.7}
            >
              <Text style={styles.saveButtonText}>保存设置</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 8,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: DayColors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: DayColors.textTertiary,
    textAlign: 'center',
    marginBottom: 20,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: DayColors.surfaceSecondary,
    borderRadius: 16,
    paddingVertical: 20,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 40,
  },
  previewItem: {
    alignItems: 'center',
  },
  previewWrapper: {
    width: 100,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  previewLabel: {
    fontSize: 13,
    color: DayColors.textSecondary,
    marginTop: 8,
  },
  previewFlag: {
    width: 100,
    height: 120,
  },
  previewText: {
    position: 'absolute',
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    top: 30,
    fontFamily: 'AlimamaDaoLiTi',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: DayColors.text,
    marginBottom: 12,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleActive: {
    borderWidth: 3,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  colorCheck: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  textInput: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: DayColors.border,
    fontSize: 24,
    fontWeight: '800',
    color: DayColors.text,
    backgroundColor: DayColors.surfaceSecondary,
  },
  inputHint: {
    fontSize: 12,
    color: DayColors.textTertiary,
  },
  saveButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default FlagSettingsSheet;
