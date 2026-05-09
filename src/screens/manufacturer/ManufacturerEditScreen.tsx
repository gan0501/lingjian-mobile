import React, { FC, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Alert,
  KeyboardAvoidingView, Platform, TouchableOpacity, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { Header } from '@/components/common/Header';
import { Button } from '@/components/common/Button';
import { Loading } from '@/components/common/Loading';
import { Spacing, BorderRadius } from '@/constants/spacing';
import { FontSize } from '@/constants/typography';
import { enterpriseService } from '@/services/enterpriseService';
import { useManufacturerDetail } from '@/hooks/useEnterprises';
import type { RootStackScreenProps } from '@/navigation/types';
import { Camera, Upload, Globe, Video, FileText, Image as ImageIcon } from 'lucide-react-native';

const THEME = {
  primary: '#80011A',
  accent: '#333',
};

type Props = RootStackScreenProps<'ManufacturerEdit'>;

const ManufacturerEditScreen: FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { manufacturerId } = route.params;
  const { data: manufacturer, isLoading: dataLoading } = useManufacturerDetail(manufacturerId);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const [manufacturerName, setManufacturerName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [registerAddress, setRegisterAddress] = useState('');
  const [description, setDescription] = useState('');
  const [vrUrl, setVrUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [brochureUrl, setBrochureUrl] = useState('');
  const [licenseUrl, setLicenseUrl] = useState('');

  useEffect(() => {
    if (manufacturer) {
      setManufacturerName(manufacturer.enterprise_name || '');
      setContactPhone(manufacturer.contact_phone || '');
      setRegisterAddress(manufacturer.register_address || '');
      setDescription(manufacturer.description || '');
      setVrUrl(manufacturer.vr_url || '');
      setWebsiteUrl(manufacturer.url || '');
      setLogoUrl(manufacturer.logo_url || '');
      setVideoUrl(manufacturer.video_url || '');
      setBrochureUrl(manufacturer.brochure_url || '');
      setLicenseUrl(manufacturer.license_url || '');
    }
  }, [manufacturer]);

  const handleUpload = useCallback(async (fileType: string) => {
    try {
      const result = await launchImageLibrary({
        mediaType: fileType === 'video' ? 'video' : 'photo',
        quality: 0.8,
        selectionLimit: 1,
      });

      if (result.didCancel || !result.assets?.length) return;

      const asset = result.assets[0];
      if (!asset.uri) return;

      setUploading(fileType);

      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || `upload.${fileType === 'video' ? 'mp4' : 'jpg'}`,
      } as any);
      formData.append('file_type', fileType);
      formData.append('enterprise_id', String(manufacturerId));

      const resp = await enterpriseService.uploadManufacturerFile(formData);

      if (resp && resp.url) {
        const url = resp.url;
        switch (fileType) {
          case 'logo': setLogoUrl(url); break;
          case 'video': setVideoUrl(url); break;
          case 'brochure': setBrochureUrl(url); break;
          case 'license': setLicenseUrl(url); break;
        }
        Alert.alert('成功', '文件上传成功');
      } else {
        Alert.alert('错误', '上传失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error?.message || '上传失败');
    } finally {
      setUploading(null);
    }
  }, [manufacturerId]);

  const handleSave = useCallback(async () => {
    if (!manufacturerName.trim()) {
      Alert.alert('提示', '厂家名称不能为空');
      return;
    }

    setSaving(true);
    try {
      const resp = await enterpriseService.updateManufacturer({
        enterprise_id: manufacturerId,
        enterprise_name: manufacturerName.trim(),
        contact_phone: contactPhone.trim(),
        register_address: registerAddress.trim(),
        description: description.trim(),
        vr_url: vrUrl.trim(),
        url: websiteUrl.trim(),
        logo_url: logoUrl,
        video_url: videoUrl,
        brochure_url: brochureUrl,
        license_url: licenseUrl,
      });

      if (resp) {
        Alert.alert('成功', '厂家信息已更新', [
          { text: '确定', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('错误', '更新失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error?.message || '更新失败');
    } finally {
      setSaving(false);
    }
  }, [manufacturerId, manufacturerName, contactPhone, registerAddress, description, vrUrl, websiteUrl, logoUrl, videoUrl, brochureUrl, licenseUrl, navigation]);

  const renderUploadItem = (
    label: string,
    fileType: string,
    currentUrl: string,
    icon: React.ReactNode,
  ) => {
    const isUploading = uploading === fileType;
    const hasFile = !!currentUrl;

    return (
      <View style={styles.uploadItem}>
        <View style={styles.uploadHeader}>
          {icon}
          <Text style={styles.uploadLabel}>{label}</Text>
          {hasFile && <Text style={styles.uploadStatus}>✓ 已上传</Text>}
        </View>
        <View style={styles.uploadActions}>
          {hasFile && fileType !== 'video' && (
            <Image source={{ uri: currentUrl }} style={styles.uploadPreview} />
          )}
          {hasFile && fileType === 'video' && (
            <View style={styles.videoPreview}>
              <Video color="#999" size={24} />
              <Text style={styles.videoPreviewText}>视频已上传</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
            onPress={() => handleUpload(fileType)}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loading size="small" color="#fff" />
            ) : (
              <>
                <Upload color="#fff" size={14} />
                <Text style={styles.uploadButtonText}>{hasFile ? '重新上传' : '上传'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (dataLoading) {
    return (
      <View style={styles.container}>
        <Header title="编辑厂家信息" showBack onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <Loading text="加载中..." />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="编辑厂家信息" showBack onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionHeader}>基本信息</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>厂家名称</Text>
            <TextInput style={styles.input} value={manufacturerName} onChangeText={setManufacturerName} placeholder="厂家名称" placeholderTextColor="#999" />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>联系电话</Text>
            <TextInput style={styles.input} value={contactPhone} onChangeText={setContactPhone} placeholder="联系电话" placeholderTextColor="#999" keyboardType="phone-pad" />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>注册地址</Text>
            <TextInput style={styles.input} value={registerAddress} onChangeText={setRegisterAddress} placeholder="注册地址" placeholderTextColor="#999" multiline />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>厂家简介</Text>
            <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="请输入厂家简介" placeholderTextColor="#999" multiline numberOfLines={4} />
          </View>

          <Text style={styles.sectionHeader}>链接信息</Text>

          <View style={styles.field}>
            <View style={styles.fieldLabelRow}>
              <Globe color="#666" size={14} />
              <Text style={styles.fieldLabel}>厂家网址</Text>
            </View>
            <TextInput style={styles.input} value={websiteUrl} onChangeText={setWebsiteUrl} placeholder="https://www.example.com" placeholderTextColor="#999" autoCapitalize="none" />
          </View>

          <View style={styles.field}>
            <View style={styles.fieldLabelRow}>
              <Camera color="#666" size={14} />
              <Text style={styles.fieldLabel}>VR全景链接</Text>
            </View>
            <TextInput style={styles.input} value={vrUrl} onChangeText={setVrUrl} placeholder="https://vr.example.com/tour" placeholderTextColor="#999" autoCapitalize="none" />
          </View>

          <Text style={styles.sectionHeader}>厂家资料上传</Text>

          {renderUploadItem('厂家Logo', 'logo', logoUrl, <ImageIcon color="#666" size={16} />)}
          {renderUploadItem('宣传视频', 'video', videoUrl, <Video color="#666" size={16} />)}
          {renderUploadItem('产品画册', 'brochure', brochureUrl, <FileText color="#666" size={16} />)}
          {renderUploadItem('营业执照', 'license', licenseUrl, <FileText color="#666" size={16} />)}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Button title="保存" variant="primary" style={styles.saveButton} onPress={handleSave} disabled={saving} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  keyboardView: { flex: 1, backgroundColor: '#F5F5F5' },
  scrollView: { flex: 1 },
  content: { padding: Spacing.screenPadding, paddingTop: Spacing.sm },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionHeader: {
    fontSize: 16, fontWeight: '700', color: '#333',
    marginTop: Spacing.md, marginBottom: Spacing.sm,
    paddingBottom: Spacing.xs, borderBottomWidth: 2, borderBottomColor: THEME.primary,
  },
  field: { marginBottom: Spacing.md },
  fieldLabel: { fontSize: 13, fontWeight: '500', color: '#555', marginBottom: 6 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: FontSize.md - 2, color: '#333',
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  uploadItem: {
    backgroundColor: '#fff', borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: '#E8E8E8',
  },
  uploadHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  uploadLabel: { fontSize: 14, fontWeight: '500', color: '#333', flex: 1 },
  uploadStatus: { fontSize: 12, color: '#4CAF50', fontWeight: '600' },
  uploadActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  uploadPreview: { width: 60, height: 60, borderRadius: BorderRadius.sm, backgroundColor: '#F0F0F0' },
  videoPreview: { width: 60, height: 60, borderRadius: BorderRadius.sm, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  videoPreviewText: { fontSize: 8, color: '#999', marginTop: 2 },
  uploadButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: THEME.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  uploadButtonDisabled: { opacity: 0.5 },
  uploadButtonText: { fontSize: 13, color: '#fff', fontWeight: '500' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.screenPadding, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E8E8E8' },
  saveButton: { backgroundColor: THEME.primary },
});

export default ManufacturerEditScreen;
