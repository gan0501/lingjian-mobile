import React, { FC, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText } from 'lucide-react-native';
import { Header } from '@/components/common/Header';
import { Button } from '@/components/common/Button';
import { Loading } from '@/components/common/Loading';
import { Spacing, BorderRadius } from '@/constants/spacing';
import { FontSize } from '@/constants/typography';
import { enterpriseApi } from '@/services/enterpriseService';
import type { RootStackScreenProps } from '@/navigation/types';
import * as ImagePicker from 'react-native-image-picker';

const THEME = {
  primary: '#80011A',
  secondary: '#000000',
};

type Props = RootStackScreenProps<'EnterpriseClaim'>;

const EnterpriseClaimScreen: FC<Props> = ({ navigation, route }) => {
  const { enterpriseId, enterpriseName } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  
  const [licenseUrl, setLicenseUrl] = useState('');
  const [licenseLocalUri, setLicenseLocalUri] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPosition, setContactPosition] = useState('');

  const uploadFileToCDN = async (localUri: string, fileType: string): Promise<string> => {
    const formData = new FormData();
    const fileName = localUri.split('/').pop() || `${fileType}.jpg`;
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';
    formData.append('file', { uri: localUri, name: fileName, type: mimeType } as any);
    formData.append('file_type', fileType);
    const resp = await enterpriseApi.uploadFile(formData);
    if (resp?.url) return resp.url;
    throw new Error('文件上传失败');
  };

  const pickLicense = useCallback(async () => {
    const result = await ImagePicker.launchImageLibrary({
      mediaType: 'photo',
      includeBase64: false,
      maxWidth: 1024,
      maxHeight: 768,
      quality: 0.8,
    });
    
    if (result.didCancel || result.errorCode) return;
    
    if (result.assets && result.assets[0]) {
      setLicenseLocalUri(result.assets[0].uri || '');
      setLicenseUrl(result.assets[0].uri || '');
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!licenseUrl) {
      Alert.alert('提示', '请上传营业执照');
      return;
    }
    if (!contactName.trim()) {
      Alert.alert('提示', '请输入联系人姓名');
      return;
    }
    if (!contactPhone.trim()) {
      Alert.alert('提示', '请输入联系电话');
      return;
    }

    setLoading(true);
    try {
      let remoteLicenseUrl = licenseUrl;
      if (licenseLocalUri && licenseUrl.startsWith('file://') || licenseUrl.startsWith('content://') || licenseUrl.startsWith('/')) {
        remoteLicenseUrl = await uploadFileToCDN(licenseLocalUri, 'license');
      }

      await enterpriseApi.claim({
        enterprise_id: enterpriseId,
        license_url: remoteLicenseUrl,
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        contact_position: contactPosition.trim() || undefined,
      });

      Alert.alert('提交成功', '认领申请已提交，请等待审核', [
        { text: '确定', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      Alert.alert('错误', error?.message || '认领申请失败');
    } finally {
      setLoading(false);
    }
  }, [enterpriseId, licenseUrl, licenseLocalUri, contactName, contactPhone, contactPosition, navigation]);

  return (
    <View style={styles.container}>
      <Header
        title="认领企业"
        showBack
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>认领企业</Text>
            <Text style={styles.infoValue}>{enterpriseName}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>营业执照 *</Text>
            <TouchableOpacity style={styles.licensePicker} onPress={pickLicense}>
              {licenseUrl ? (
                <Image source={{ uri: licenseUrl }} style={styles.licenseImage} />
              ) : (
                <View style={styles.licensePlaceholder}>
                  <FileText color="#999" size={32} />
                  <Text style={styles.licensePlaceholderText}>点击上传营业执照</Text>
                  <Text style={styles.licenseHint}>支持jpg、png格式</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>联系人姓名 *</Text>
            <TextInput
              style={styles.input}
              value={contactName}
              onChangeText={setContactName}
              placeholder="请输入您的姓名"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>联系电话 *</Text>
            <TextInput
              style={styles.input}
              value={contactPhone}
              onChangeText={setContactPhone}
              placeholder="请输入联系电话"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>职位</Text>
            <TextInput
              style={styles.input}
              value={contactPosition}
              onChangeText={setContactPosition}
              placeholder="请输入您的职位（选填）"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>认领说明</Text>
            <Text style={styles.tipsText}>1. 请上传清晰的营业执照照片</Text>
            <Text style={styles.tipsText}>2. 认领申请提交后，我们将在1-3个工作日内审核</Text>
            <Text style={styles.tipsText}>3. 审核通过后，您将成为该企业的管理员</Text>
            <Text style={styles.tipsText}>4. 认领成功后可申请VIP认证，享受更多权益</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Button
          title="提交申请"
          variant="primary"
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={loading}
        />
      </View>
      {loading && (
        <View style={styles.loadingOverlay}>
          <Loading text="提交中..." />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  keyboardView: { flex: 1, backgroundColor: '#F5F5F5' },
  scrollView: { flex: 1 },
  content: { padding: Spacing.screenPadding, paddingTop: Spacing.base },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: '#E8E8E8',
  },
  infoLabel: { fontSize: 12, color: '#999', marginBottom: 4 },
  infoValue: { fontSize: 18, fontWeight: '600', color: '#333' },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: 14, fontWeight: '500', marginBottom: Spacing.sm, color: '#333' },
  licensePicker: { alignItems: 'center' },
  licenseImage: { width: '100%', height: 200, borderRadius: BorderRadius.md },
  licensePlaceholder: {
    width: '100%', height: 200, borderRadius: BorderRadius.md,
    backgroundColor: '#FAFAFA',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  licensePlaceholderText: { fontSize: FontSize.md, color: '#666', marginTop: Spacing.sm },
  licenseHint: { fontSize: FontSize.xs, color: '#999', marginTop: 4 },
  input: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    fontSize: FontSize.md - 2,
    color: '#333',
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  tipsCard: {
    backgroundColor: '#FFFBF0',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1, borderColor: '#FFE8A0',
  },
  tipsTitle: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: Spacing.sm },
  tipsText: { fontSize: 12, color: '#666', lineHeight: 20, marginBottom: 4 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing.screenPadding,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#E8E8E8',
  },
  submitButton: { backgroundColor: THEME.primary },
});

export default EnterpriseClaimScreen;
