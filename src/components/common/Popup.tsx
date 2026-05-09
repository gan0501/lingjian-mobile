import React from 'react';
import { View, Modal, StyleSheet, Dimensions, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius } from '@/constants/spacing';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

interface SidePopupProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number | string;
}

export const SidePopup: React.FC<SidePopupProps> = ({ visible, onClose, children, width = screenWidth * 0.8 }) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.sideContainer, { width }]}>
              <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

interface BottomPopupProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: number;
}

export const BottomPopup: React.FC<BottomPopupProps> = ({ visible, onClose, children, height = screenHeight * 0.6 }) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.bottomContainer, { maxHeight: height }]}>
              <View style={styles.handle} />
              {children}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

interface CenterPopupProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  cancelable?: boolean;
}

export const CenterPopup: React.FC<CenterPopupProps> = ({ visible, onClose, title, children, cancelable = true }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancelable ? onClose : undefined}>
      <TouchableWithoutFeedback onPress={cancelable ? onClose : undefined}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.centerContainer}>
              {title && <View style={styles.centerHeader}>{title}</View>}
              {children}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-start',
  },
  sideContainer: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    paddingTop: Spacing['2xl'],
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border.medium,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  centerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing['2xl'],
    maxWidth: 320,
    width: '100%',
  },
  centerHeader: {
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
});
