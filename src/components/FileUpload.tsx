import { Loading } from '@/components/common/Loading';
import React, { FC, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Paperclip } from 'lucide-react-native';
import DocumentPicker from 'react-native-document-picker';
import axios from 'axios';
import { API_CONFIG } from '@/constants/config';
import { useAuthStore } from '@/stores/useAuthStore';
import { CenterModal } from './common';

interface FileUploadProps {
  projectId: string;
  onUploadSuccess?: (noteId: string, content: string) => void;
  onParseSuccess?: (data: { filename: string; summary: string; content_digest: string; parsed_text: string }) => void;
  visible: boolean;
  onClose: () => void;
  mode?: 'note' | 'chat';
  onUploadStart?: (filename: string) => void;
  onUploadProgress?: (percent: number) => void;
  onUploadError?: (error: string) => void;
  onUploadComplete?: () => void;
}

const FileUpload: FC<FileUploadProps> = ({
  projectId, onUploadSuccess, onParseSuccess, visible, onClose,
  mode = 'note', onUploadStart, onUploadProgress: onUploadProgressCb, onUploadError, onUploadComplete,
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { token } = useAuthStore();

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.xlsx, DocumentPicker.types.xls, DocumentPicker.types.docx, DocumentPicker.types.doc, DocumentPicker.types.plainText, DocumentPicker.types.images],
      });
      if (!result || result.length === 0) return;
      const file = result[0];
      onUploadStart?.(file.name || '未知文件');
      onClose();
      handleUpload(file);
    } catch (error: any) {
      if (DocumentPicker.isCancel(error)) return;
      Alert.alert('错误', '选择文件失败，请重试');
    }
  };

  const handleUpload = async (file: any) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      if (!projectId) throw new Error('项目ID不存在，无法上传文件');

      const formData = new FormData();
      formData.append('file', { uri: file.uri, type: file.type || 'application/octet-stream', name: file.name } as any);

      const endpoint = mode === 'chat' ? 'parse-file-for-chat' : 'upload-file';
      const encodedProjectId = encodeURIComponent(String(projectId));
      const uploadUrl = `${API_CONFIG.BASE_URL}/api/project-agent/${endpoint}?project_id=${encodedProjectId}`;

      const response = await axios.post(uploadUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
        timeout: 120000,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(Math.min(percent, 99));
            onUploadProgressCb?.(Math.min(percent, 99));
          }
        },
      });

      if (response.data.success) {
        if (mode === 'chat' && response.data.data) {
          onParseSuccess?.(response.data.data);
        } else if (response.data.data?.note) {
          onUploadSuccess?.(response.data.data.note.id, response.data.data.note.content);
        }
        onUploadComplete?.();
      } else {
        const errMsg = response.data.message || '操作失败';
        onUploadError?.(errMsg);
        Alert.alert('错误', errMsg);
      }
    } catch (error: any) {
      const errMsg = error.message || '文件上传失败';
      onUploadError?.(errMsg);
      Alert.alert('错误', errMsg);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      onUploadProgressCb?.(0);
    }
  };

  return (
    <CenterModal visible={visible} title={mode === 'chat' ? '上传文件（仅对话）' : '上传附件'} onClose={onClose}>
      <View style={styles.modalBody}>
        <TouchableOpacity style={styles.uploadButton} onPress={handlePickFile} disabled={uploading}>
          <View style={styles.uploadButtonGradient}>
            <Paperclip size={24} color="#C084FC" />
            <Text style={styles.uploadButtonText}>选择文件</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.fileInfoContainer}>
          <Text style={styles.fileInfoText}>支持的文件类型：PDF、Excel、Word、TXT、图片</Text>
          <Text style={styles.fileInfoDetail}>文件大小限制：单个文件最大 {mode === 'chat' ? '5' : '10'}MB</Text>
          {mode === 'note' && <Text style={styles.fileInfoDetailLast}>存储空间限制：总空间 100MB</Text>}
          {mode === 'chat' && <Text style={styles.fileInfoDetailLast}>文件仅用于当前对话，不会存储</Text>}
        </View>
        {uploading && (
          <View style={styles.uploadProgress}>
            <Loading size="small" color="#C084FC" />
            <Text style={styles.uploadProgressText}>上传中 {uploadProgress}%</Text>
          </View>
        )}
      </View>
    </CenterModal>
  );
};

const styles = StyleSheet.create({
  modalBody: { gap: 16 },
  uploadButton: { borderRadius: 12, overflow: 'hidden' },
  uploadButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(192, 132, 252, 0.1)', borderWidth: 1, borderColor: 'rgba(192, 132, 252, 0.4)', borderRadius: 12, padding: 16, gap: 12 },
  uploadButtonText: { color: '#C084FC', fontSize: 16, fontWeight: '600' },
  fileInfoContainer: { backgroundColor: 'rgba(0, 0, 0, 0.3)', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  fileInfoText: { color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, marginBottom: 8 },
  fileInfoDetail: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 14, fontWeight: '500', marginBottom: 4 },
  fileInfoDetailLast: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 14, fontWeight: '500' },
  uploadProgress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8, backgroundColor: 'rgba(0, 0, 0, 0.3)', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(192, 132, 252, 0.3)' },
  uploadProgressText: { color: '#C084FC', fontSize: 14, fontWeight: '500' },
});

export default FileUpload;
