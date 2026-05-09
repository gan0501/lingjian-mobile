import React, { useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  onDismiss: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

const { height: screenHeight } = Dimensions.get('window');

const BottomSheet: React.FC<Props> = ({ visible, title, onDismiss, children, footer }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={bs.overlay}>
        <Pressable style={bs.backdrop} onPress={onDismiss} />
        <View style={bs.container}>
          {/* Drag handle */}
          <View style={bs.handleRow}>
            <View style={bs.handle} />
          </View>

          {/* Title row */}
          <View style={bs.titleRow}>
            <Text style={bs.title}>{title}</Text>
            <TouchableOpacity onPress={onDismiss} activeOpacity={0.6}>
              <Text style={bs.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={bs.scrollContent}
            contentContainerStyle={{ paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {children}
          </ScrollView>

          {/* Footer */}
          {footer && (
            <ScrollView
              scrollEnabled={false}
              keyboardShouldPersistTaps="handled"
              style={{ flexGrow: 0 }}
              contentContainerStyle={bs.footer}
              showsVerticalScrollIndicator={false}
            >
              {footer}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const bs = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: screenHeight * 0.75,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
  },
  closeBtn: {
    fontSize: 18,
    color: 'rgba(0,0,0,0.35)',
    paddingLeft: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
});

export default BottomSheet;
