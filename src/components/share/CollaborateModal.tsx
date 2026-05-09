/**
 * 协作邀请模态框（V2）
 *
 * 输入手机号邀请队友协作，显示当前协作人数/上限。
 */
import React, { useState, useCallback, FC } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import { X } from 'lucide-react-native';
import { collaborationApi } from '@/services/collaborationService';

interface CollaborateModalProps {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  currentCount: number;
  maxCount?: number;
  onSuccess?: () => void;
}

const CollaborateModal: FC<CollaborateModalProps> = ({
  visible, onClose, projectId, projectName,
  currentCount, maxCount = 4, onSuccess,
}) => {
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInvite = useCallback(async () => {
    if (!phone.trim()) { Alert.alert('提示', '请输入手机号'); return; }
    if (!/^1[3-9]\d{9}$/.test(phone.trim())) { Alert.alert('提示', '请输入正确的手机号'); return; }
    if (currentCount >= maxCount) { Alert.alert('提示', `协作人数已达上限（${maxCount}人）`); return; }

    Keyboard.dismiss();
    setIsLoading(true);

    try {
      const resp = await collaborationApi.inviteCollaborator({
        project_id: projectId,
        collaborator_contact: phone.trim(),
        collaborator_contact_type: 'phone',
      });

      const displayName = (resp.collaborator_name && !/^[?\s]+$/.test(resp.collaborator_name))
        ? resp.collaborator_name
        : `用户${phone.slice(-4)}`;

      Alert.alert('邀请已发送', `已向 ${displayName} 发送协作邀请，等待对方确认`, [
        { text: '确定', onPress: () => { setPhone(''); onClose(); onSuccess?.(); } },
      ]);
    } catch (error: any) {
      const errorMsg = error?.message || '';
      if (errorMsg.includes('已向该用户发送过邀请') || errorMsg.includes('等待对方回复')) {
        Alert.alert('发送成功', errorMsg, [
          { text: '确定', onPress: () => { setPhone(''); onClose(); onSuccess?.(); } },
        ]);
      } else {
        Alert.alert('发送失败', errorMsg || '请稍后再试');
      }
    } finally {
      setIsLoading(false);
    }
  }, [phone, projectId, currentCount, maxCount, onClose, onSuccess]);

  const handleClose = useCallback(() => { setPhone(''); onClose(); }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>邀请协作</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                <X color="#999" size={18} />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <Text style={styles.projectName} numberOfLines={2}>{projectName}</Text>

              <View style={styles.countRow}>
                <Text style={styles.countLabel}>当前协作人数</Text>
                <Text style={styles.countValue}>
                  <Text style={styles.countCurrent}>{currentCount}</Text>
                  <Text style={styles.countMax}>/{maxCount}</Text>
                </Text>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>邀请队友</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="请输入手机号"
                    placeholderTextColor="#999"
                    keyboardType="phone-pad"
                    maxLength={11}
                    editable={!isLoading}
                  />
                </View>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleClose} disabled={isLoading}>
                  <Text style={styles.cancelButtonText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.confirmButton, isLoading && { opacity: 0.6 }]}
                  onPress={handleInvite}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.confirmButtonText}>发送邀请</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  container: { width: '85%', maxWidth: 340, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  header: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  closeBtn: { position: 'absolute', right: 14, padding: 4 },
  content: { padding: 20 },
  projectName: { fontSize: 15, fontWeight: '600', color: '#333', lineHeight: 22, marginBottom: 16 },
  countRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#f8f9fa',
    borderRadius: 10, marginBottom: 20,
  },
  countLabel: { fontSize: 14, color: '#666' },
  countValue: { fontSize: 16, fontWeight: '600' },
  countCurrent: { color: '#007AFF' },
  countMax: { color: '#999' },
  inputSection: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
  inputWrapper: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, backgroundColor: '#fafafa' },
  input: { height: 48, paddingHorizontal: 14, fontSize: 16, color: '#333' },
  buttonRow: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, height: 46, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  cancelButton: { backgroundColor: '#f2f3f7' },
  cancelButtonText: { fontSize: 15, fontWeight: '500', color: '#333' },
  confirmButton: { backgroundColor: '#111827' },
  confirmButtonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});

export default CollaborateModal;
