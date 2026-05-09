import React, { FC, memo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BookOpen, FileText, DollarSign } from 'lucide-react-native';
import { DayColors } from '@/constants';

interface UploadTypeSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: 'norm' | 'atlas' | 'material') => void;
}

export const UploadTypeSheet: FC<UploadTypeSheetProps> = memo(({
  visible,
  onClose,
  onSelect,
}) => {
  const handleSelect = useCallback((type: 'norm' | 'atlas' | 'material') => {
    onSelect(type);
    onClose();
  }, [onSelect, onClose]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={styles.overlayTouch}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={styles.content}>
        <View style={styles.handle} />
        <Text style={styles.title}>选择上传类型</Text>
        <Text style={styles.desc}>共享标准资源可获得10次查看权限</Text>

        <TouchableOpacity
          style={styles.option}
          onPress={() => handleSelect('norm')}
          activeOpacity={0.7}
        >
          <BookOpen size={24} color="#4CAF50" />
          <Text style={styles.optionText}>建筑规范</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.option}
          onPress={() => handleSelect('atlas')}
          activeOpacity={0.7}
        >
          <FileText size={24} color="#2196F3" />
          <Text style={styles.optionText}>标准图集</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.option}
          onPress={() => handleSelect('material')}
          activeOpacity={0.7}
        >
          <DollarSign size={24} color="#FF9800" />
          <Text style={styles.optionText}>信息价</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelText}>取消</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  overlayTouch: {
    flex: 1,
  },
  content: {
    backgroundColor: DayColors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 34,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: DayColors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: DayColors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  desc: {
    fontSize: 13,
    color: DayColors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 15,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: DayColors.text,
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 12,
  },
  cancelText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

export default UploadTypeSheet;
