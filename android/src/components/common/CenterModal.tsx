import React, { FC } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

const { width, height: screenHeight } = Dimensions.get('window');

interface CenterModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  cancelable?: boolean;
  maxHeightPercent?: number;
}

const CenterModal: FC<CenterModalProps> = ({
  visible, title, onClose, children, cancelable = true, maxHeightPercent = 0.6,
}) => {
  const { colors, isDark } = useTheme();
  const maxModalHeight = screenHeight * maxHeightPercent;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancelable ? onClose : undefined}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={cancelable ? onClose : undefined}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={[
            styles.container,
            {
              maxHeight: maxModalHeight,
              backgroundColor: isDark ? 'rgba(28, 20, 45, 0.98)' : '#FFFFFF',
              shadowColor: isDark ? '#C084FC' : 'rgba(0,0,0,0.1)',
              borderColor: isDark ? 'rgba(192, 132, 252, 0.3)' : 'rgba(0,0,0,0.05)',
            },
          ]}>
            <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0,0,0,0.05)' }]}>
              <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>{title}</Text>
              <TouchableOpacity style={[styles.closeButton, { backgroundColor: isDark ? 'rgba(192, 132, 252, 0.2)' : 'rgba(0,0,0,0.05)' }]} onPress={onClose}>
                <Text style={[styles.closeButtonText, { color: isDark ? '#C084FC' : '#6B7280' }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  container: { borderRadius: 16, width: width - 48, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 8, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  title: { fontSize: 17, fontWeight: '600' },
  closeButton: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { fontSize: 16, fontWeight: '400', lineHeight: 18 },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, flexGrow: 1, flexShrink: 1 },
});

export default CenterModal;
