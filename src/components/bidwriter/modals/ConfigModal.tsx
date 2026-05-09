import React, { FC, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { X } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';

interface ConfigModalProps {
  visible: boolean;
  onClose: () => void;
  wordCount: number;
  onWordCountChange: (count: number) => void;
  autoWebImage: boolean;
  onAutoWebImageChange: (value: boolean) => void;
  generateFlowchart: boolean;
  onGenerateFlowchartChange: (value: boolean) => void;
  autoProofread: boolean;
  onAutoProofreadChange: (value: boolean) => void;
  darkBidMode: boolean;
  onDarkBidModeChange: (value: boolean) => void;
  formatWordCount: (count: number) => string;
}

export const ConfigModal: FC<ConfigModalProps> = ({
  visible,
  onClose,
  wordCount,
  onWordCountChange,
  autoWebImage,
  onAutoWebImageChange,
  generateFlowchart,
  onGenerateFlowchartChange,
  autoProofread,
  onAutoProofreadChange,
  darkBidMode,
  onDarkBidModeChange,
  formatWordCount,
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
              <Text style={[styles.bottomSheetTitle, { color: colors.text }]}>功能配置</Text>
              <Text style={[styles.bottomSheetSubtitle, { color: colors.textMuted }]}>以下选项请在进入编写正文之前确定</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.bottomSheetContent}>
            <View style={styles.configItem}>
              <Text style={[styles.configLabel, { color: colors.text }]}>期望字数篇幅</Text>
              <Text style={styles.configValue}>{formatWordCount(wordCount)}</Text>
            </View>
            <View style={styles.wordCountControl}>
              <TouchableOpacity
                style={[styles.wordCountBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}
                onPress={() => onWordCountChange(Math.max(10000, wordCount - 10000))}
              >
                <Text style={[styles.wordCountBtnText, { color: colors.text }]}>−</Text>
              </TouchableOpacity>
              <View style={[styles.wordCountSlider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
                <View
                  style={[
                    styles.wordCountProgress,
                    { width: `${((wordCount - 10000) / (500000 - 10000)) * 100}%` }
                  ]}
                />
              </View>
              <TouchableOpacity
                style={[styles.wordCountBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}
                onPress={() => onWordCountChange(Math.min(500000, wordCount + 10000))}
              >
                <Text style={[styles.wordCountBtnText, { color: colors.text }]}>+</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.sliderLabels}>
              <Text style={[styles.sliderLabel, { color: colors.textMuted }]}>1万字</Text>
              <Text style={[styles.sliderLabel, { color: colors.textMuted }]}>50万字</Text>
            </View>

            <View style={[styles.configRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.configLabel, { color: colors.text }]}>自动联网配图</Text>
              <Switch
                value={autoWebImage}
                onValueChange={onAutoWebImageChange}
                trackColor={{ false: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', true: '#B20000' }}
                thumbColor="#fff"
              />
            </View>

            <View style={[styles.configRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.configLabel, { color: colors.text }]}>生成架构与流程图</Text>
              <Switch
                value={generateFlowchart}
                onValueChange={onGenerateFlowchartChange}
                trackColor={{ false: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', true: '#B20000' }}
                thumbColor="#fff"
              />
            </View>

            <View style={[styles.configRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.configLabel, { color: colors.text }]}>自动审稿检查</Text>
              <Switch
                value={autoProofread}
                onValueChange={(value) => {
                  if (value) {
                    Alert.alert('提示', '自动审稿功能仅对超级用户开放，普通会员用户暂不支持');
                  } else {
                    onAutoProofreadChange(false);
                  }
                }}
                trackColor={{ false: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', true: '#B20000' }}
                thumbColor="#fff"
              />
            </View>

            <View style={[styles.configRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.configLabel, { color: colors.text }]}>暗标模式</Text>
              <Switch
                value={darkBidMode}
                onValueChange={onDarkBidModeChange}
                trackColor={{ false: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', true: '#B20000' }}
                thumbColor="#fff"
              />
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
  configItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  configLabel: {
    fontSize: 15,
  },
  configValue: {
    fontSize: 15,
    color: '#B20000',
    fontWeight: '600',
  },
  wordCountControl: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  wordCountBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordCountBtnText: {
    fontSize: 20,
    fontWeight: '600',
  },
  wordCountSlider: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 12,
  },
  wordCountProgress: {
    height: '100%',
    backgroundColor: '#B20000',
    borderRadius: 3,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  sliderLabel: {
    fontSize: 12,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  configRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  configAction: {
    fontSize: 14,
    marginRight: 4,
  },
});
