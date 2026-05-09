import React, { useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MODAL_WIDTH = SCREEN_WIDTH - 60;

interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
  fileName: string;
  /** 文件已在导出阶段写入磁盘，这里直接传路径 */
  filePath: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  visible,
  onClose,
  fileName,
  filePath,
}) => {

  const saveToLocal = async () => {
    try {
      // 文件已在 handleExport 阶段写入 filePath，直接提示成功
      const fileExists = await RNFS.exists(filePath);
      if (!fileExists) {
        throw new Error('文件不存在，请重新导出');
      }
      onClose();
      setTimeout(() => {
        Alert.alert('保存成功', '文件已保存到本地', [{ text: '确定' }]);
      }, 100);
    } catch (error: any) {
      onClose();
      Alert.alert('保存失败', error.message || '无法保存文件');
    }
  };

  const shareToWeChat = async () => {
    try {
      const fileExists = await RNFS.exists(filePath);
      if (!fileExists) {
        throw new Error('文件不存在，请重新导出');
      }

      const fileUrl = Platform.OS === 'android' ? `file://${filePath}` : filePath;

      const shareOptions: any = {
        url: fileUrl,
        filename: fileName,
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        failOnCancel: false,
      };

      if (Platform.OS === 'android') {
        shareOptions.social = Share.Social.WECHAT;
      }

      // 先关闭弹窗，再调起系统分享，避免分享面板阻塞导致弹窗卡死
      onClose();

      setTimeout(async () => {
        try {
          await Share.open(shareOptions);
          console.log('分享成功');
        } catch (error: any) {
          console.error('分享错误详情:', error);
          if (
            error.error?.code === 'ECANCELLED' ||
            error.message?.includes('cancelled') ||
            error.message?.includes('cancel')
          ) {
            return;
          }
          Alert.alert(
            '分享失败',
            `${error.message || '未知错误'}\n\n${
              Platform.OS === 'android'
                ? '请确保微信已安装，或尝试保存后手动分享'
                : '请确保微信已安装'
            }`,
            [{ text: '确定' }],
          );
        }
      }, 300);
    } catch (error: any) {
      onClose();
      Alert.alert('分享失败', error.message || '发生未知错误');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>导出标书</Text>
          </View>

          <View style={styles.optionsRow}>
            {/* 保存到本地 */}
            <TouchableOpacity
              style={styles.optionButton}
              onPress={saveToLocal}
              activeOpacity={0.7}
            >
              <View style={styles.optionIconWrap}>
                <Text style={styles.optionIcon}>📁</Text>
              </View>
              <Text style={styles.optionLabel}>保存到本地</Text>
            </TouchableOpacity>

            {/* 转存到微信 */}
            <TouchableOpacity
              style={styles.optionButton}
              onPress={shareToWeChat}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconWrap, styles.optionIconWrapGreen]}>
                <Image
                  source={require('@/assets/images/wechat.png')}
                  style={styles.optionIconImage}
                />
              </View>
              <Text style={styles.optionLabel}>转存到微信</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
          >
            <Text style={styles.cancelText}>取消</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: MODAL_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    paddingVertical: 18,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEEEEE',
  },
  title: {
    color: '#333333',
    fontSize: 18,
    fontWeight: '600',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  optionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  optionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  optionIconWrapGreen: {
    backgroundColor: '#E8F5E9',
  },
  optionIcon: {
    fontSize: 28,
  },
  optionIconImage: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  optionLabel: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEEEEE',
  },
  cancelText: {
    color: '#999999',
    fontSize: 16,
  },
});
