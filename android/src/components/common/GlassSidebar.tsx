import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface GlassSidebarProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  width?: number | string;
  hideCloseIcon?: boolean;
}

export const GlassSidebar: React.FC<GlassSidebarProps> = ({
  visible,
  onClose,
  title,
  children,
  headerRight,
  width = '85%',
  hideCloseIcon = false,
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayTouchable} activeOpacity={1} onPress={onClose} />
        <Animated.View
          style={[
            styles.sidebar,
            { width: width as any, transform: [{ translateX: slideAnim }] },
          ]}
        >
          <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top + 10 : 20 }]}>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.headerRightControls}>
              {headerRight}
              {!hideCloseIcon && (
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X size={24} color="#1A1A2E" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.content}>
            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    flexDirection: 'row',
  },
  overlayTouchable: {
    flex: 1,
  },
  sidebar: {
    flexShrink: 0,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A2E',
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeBtn: {
    marginLeft: 16,
    padding: 4,
  },
  content: {
    flex: 1,
  },
});

export default GlassSidebar;
