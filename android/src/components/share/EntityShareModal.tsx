import React, { useRef, useState, useCallback, FC } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions,
  Alert, Platform, PermissionsAndroid, Image, ActivityIndicator,
} from 'react-native';
import { X, Share2, Download, MessageCircle } from 'lucide-react-native';
import ViewShot from 'react-native-view-shot';
import Share from 'react-native-share';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import QRCode from 'react-native-qrcode-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MODAL_WIDTH = SCREEN_WIDTH * 0.9;

const APP_LOGO = require('../../assets/images/icon-128x128.png');

interface EntityShareModalProps {
  visible: boolean;
  onClose: () => void;
  entityName: string;
  entityType: string;
  registerCapital?: string;
  qualification?: string;
  address?: string;
  entityId: string;
  entityTypeLabel: 'enterprise' | 'manufacturer';
}

const EntityShareModal: FC<EntityShareModalProps> = ({
  visible, onClose,
  entityName, entityType, registerCapital, qualification, address, entityId, entityTypeLabel,
}) => {
  const viewShotRef = useRef<ViewShot>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const shareUrl = `https://lingjianai.com/${entityTypeLabel}/${entityId}`;
  const titleLabel = entityTypeLabel === 'enterprise' ? '分享建企' : '分享厂家';

  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const apiLevel = Platform.Version;
        if (typeof apiLevel === 'number' && apiLevel >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
            { title: '相册权限', message: '保存图片需要访问相册权限', buttonNeutral: '稍后询问', buttonNegative: '取消', buttonPositive: '确定' },
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        } else if (typeof apiLevel === 'number' && apiLevel >= 29) {
          return true;
        } else {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            { title: '存储权限', message: '保存图片需要访问存储权限', buttonNeutral: '稍后询问', buttonNegative: '取消', buttonPositive: '确定' },
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
      } catch { return false; }
    }
    return true;
  };

  const captureAndShare = useCallback(async (action: 'share' | 'wechat' | 'save') => {
    if (!viewShotRef.current) return;
    setIsGenerating(true);
    try {
      const uri = await viewShotRef.current.capture?.();
      if (!uri) throw new Error('截图失败');

      if (action === 'save') {
        const ok = await requestStoragePermission();
        if (!ok) { Alert.alert('提示', '需要存储权限才能保存图片'); return; }
        await CameraRoll.saveAsset(uri, { type: 'photo' });
        Alert.alert('成功', '图片已保存到相册');
      } else if (action === 'share') {
        await Share.open({ url: uri, type: 'image/png', title: entityName, message: `【${entityName}】- 来自领建` });
      } else if (action === 'wechat') {
        await Share.open({ url: uri, type: 'image/png', social: Share.Social.WECHAT, title: entityName });
      }
    } catch (e: any) {
      if (e?.message !== 'User did not share') Alert.alert('提示', '操作失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [entityName]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{titleLabel}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X color="#999" size={18} />
            </TouchableOpacity>
          </View>

          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }} style={styles.viewShot}>
            <View style={styles.shareCard}>
              <View style={styles.cardContent}>
                <Text style={styles.entityName} numberOfLines={2}>{entityName}</Text>
                <View style={styles.tagRow}>
                  <View style={styles.tag}><Text style={styles.tagText}>{entityType}</Text></View>
                </View>
                <View style={styles.infoSection}>
                  {registerCapital && <InfoRow label="注册资本" value={registerCapital} />}
                  {qualification && <InfoRow label="资质信息" value={qualification} lines={2} />}
                  {address && <InfoRow label="企业地址" value={address} lines={2} />}
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.brandSection}>
                  <View style={styles.logoBox}>
                    <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" />
                  </View>
                  <View style={styles.brandInfo}>
                    <Text style={styles.brandName}>领建</Text>
                    <Text style={styles.slogan}>智能建筑行业信息平台</Text>
                  </View>
                </View>
                <View style={styles.qrSection}>
                  <QRCode value={shareUrl} size={60} backgroundColor="white" color="#333" />
                  <Text style={styles.qrTip}>扫码查看详情</Text>
                </View>
              </View>
            </View>
          </ViewShot>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => captureAndShare('wechat')} disabled={isGenerating}>
              <View style={[styles.actionIcon, { backgroundColor: '#07C160' }]}>
                <MessageCircle color="#fff" size={22} />
              </View>
              <Text style={styles.actionText}>微信好友</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => captureAndShare('share')} disabled={isGenerating}>
              <View style={[styles.actionIcon, { backgroundColor: '#007AFF' }]}>
                <Share2 color="#fff" size={22} />
              </View>
              <Text style={styles.actionText}>更多分享</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => captureAndShare('save')} disabled={isGenerating}>
              <View style={[styles.actionIcon, { backgroundColor: '#FF9500' }]}>
                <Download color="#fff" size={22} />
              </View>
              <Text style={styles.actionText}>保存图片</Text>
            </TouchableOpacity>
          </View>

          {isGenerating && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>正在生成...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const InfoRow: FC<{ label: string; value: string; lines?: number }> = ({ label, value, lines = 1 }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={lines}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  container: { width: MODAL_WIDTH, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  header: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  closeBtn: { position: 'absolute', right: 14, padding: 4 },
  viewShot: { padding: 15, backgroundColor: '#fff' },
  shareCard: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
  cardContent: { padding: 16 },
  entityName: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', lineHeight: 26, marginBottom: 10 },
  tagRow: { flexDirection: 'row', marginBottom: 14 },
  tag: { backgroundColor: '#111827', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  tagText: { fontSize: 12, color: '#fff', fontWeight: '500' },
  infoSection: { gap: 10 },
  infoRow: { flexDirection: 'row' },
  infoLabel: { width: 70, fontSize: 13, color: '#999' },
  infoValue: { flex: 1, fontSize: 13, color: '#333', fontWeight: '500' },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#f8f9fa',
    borderTopWidth: 1, borderTopColor: '#eee',
  },
  brandSection: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  logoBox: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center',
  },
  logoImage: { width: 28, height: 28 },
  brandInfo: { marginLeft: 10 },
  brandName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  slogan: { fontSize: 11, color: '#666', marginTop: 2 },
  qrSection: { alignItems: 'center' },
  qrTip: { fontSize: 10, color: '#999', marginTop: 4 },
  actionRow: {
    flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 20,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eee',
  },
  actionBtn: { alignItems: 'center', minWidth: 70 },
  actionIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionText: { fontSize: 12, color: '#666' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  loadingText: { marginTop: 10, fontSize: 14, color: '#666' },
});

export default EntityShareModal;
