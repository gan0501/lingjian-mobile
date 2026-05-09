import React, { FC, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Linking, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, Download } from 'lucide-react-native';
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

type Props = RootStackScreenProps<'EnterpriseAppeal'>;

const EnterpriseAppealScreen: FC<Props> = ({ navigation, route }) => {
  const { enterpriseId, enterpriseName } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  
  const [licenseUrl, setLicenseUrl] = useState('');
  const [idCardUrl, setIdCardUrl] = useState('');
  const [statementUrl, setStatementUrl] = useState('');

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

  const pickImage = useCallback(async (setter: (url: string) => void) => {
    const result = await ImagePicker.launchImageLibrary({
      mediaType: 'photo',
      includeBase64: false,
      maxWidth: 1024,
      maxHeight: 768,
      quality: 0.8,
    });
    
    if (result.didCancel || result.errorCode) return;
    
    if (result.assets && result.assets[0]) {
      setter(result.assets[0].uri || '');
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!licenseUrl) {
      Alert.alert('提示', '请上传企业营业执照');
      return;
    }
    if (!idCardUrl) {
      Alert.alert('提示', '请上传法人身份证');
      return;
    }
    if (!statementUrl) {
      Alert.alert('提示', '请上传情况说明（需加盖公章）');
      return;
    }

    setLoading(true);
    try {
      const isLocalUri = (uri: string) => uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('/');
      
      const remoteLicenseUrl = isLocalUri(licenseUrl) ? await uploadFileToCDN(licenseUrl, 'license') : licenseUrl;
      const remoteIdCardUrl = isLocalUri(idCardUrl) ? await uploadFileToCDN(idCardUrl, 'id_card') : idCardUrl;
      const remoteStatementUrl = isLocalUri(statementUrl) ? await uploadFileToCDN(statementUrl, 'statement') : statementUrl;

      await enterpriseApi.appealEnterprise?.({
        enterprise_id: enterpriseId,
        license_url: remoteLicenseUrl,
        id_card_url: remoteIdCardUrl,
        statement_url: remoteStatementUrl,
      });

      Alert.alert('提交成功', '申诉材料已提交，我们会在1-3个工作日内进行后台人工审核并与您联系。', [
        { text: '确定', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      Alert.alert('错误', error?.message || '申诉提交失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [enterpriseId, licenseUrl, idCardUrl, statementUrl, navigation]);

  return (
    <View style={styles.container}>
      <Header
        title="企业认领申诉"
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
          {loading && <Loading text="提交中..." />}

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>申诉企业</Text>
            <Text style={styles.infoValue}>{enterpriseName}</Text>
          </View>

          <View style={styles.tipsCard}>
            <Text style={styles.tipsText}>如发现该企业被他人冒领，您可以提交申诉材料。后台将人工审核材料真实性归属进行分辨处理。</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. 营业执照 *</Text>
            <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage(setLicenseUrl)}>
              {licenseUrl ? (
                <Image source={{ uri: licenseUrl }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <FileText color="#999" size={32} />
                  <Text style={styles.placeholderText}>点击上传营业执照</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. 法人身份证（正反面拼图） *</Text>
            <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage(setIdCardUrl)}>
              {idCardUrl ? (
                <Image source={{ uri: idCardUrl }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <FileText color="#999" size={32} />
                  <Text style={styles.placeholderText}>点击上传法人身份证</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>3. 情况说明（需加盖公章） *</Text>
              <TouchableOpacity 
                style={styles.downloadBtn}
                onPress={() => {
                  Linking.openURL('https://www.example.com/情况说明模板.docx').catch(() => Alert.alert('提示', '无法打开下载链接'));
                }}
              >
                <Download color={THEME.primary} size={14} />
                <Text style={styles.downloadText}>下载模板</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage(setStatementUrl)}>
              {statementUrl ? (
                <Image source={{ uri: statementUrl }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <FileText color="#999" size={32} />
                  <Text style={styles.placeholderText}>点击上传情况说明扫描件或照片</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Button
          title="提交申诉"
          variant="primary"
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={loading}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  keyboardView: { flex: 1, backgroundColor: '#F5F5F5' },
  scrollView: { flex: 1 },
  content: { padding: Spacing.screenPadding, paddingTop: Spacing.base },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1, borderColor: '#E8E8E8',
  },
  infoLabel: { fontSize: 12, color: '#999', marginBottom: 4 },
  infoValue: { fontSize: 18, fontWeight: '600', color: '#333' },
  tipsCard: {
    backgroundColor: '#FFFBF0',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: '#FFE8A0',
  },
  tipsText: { fontSize: 12, color: '#666', lineHeight: 20 },
  section: { marginBottom: Spacing.lg },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: Spacing.sm },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.sm },
  downloadText: { fontSize: 13, color: THEME.primary },
  imagePicker: { alignItems: 'center' },
  uploadedImage: { width: '100%', height: 160, borderRadius: BorderRadius.md, resizeMode: 'cover' },
  imagePlaceholder: {
    width: '100%', height: 160, borderRadius: BorderRadius.md,
    backgroundColor: '#FAFAFA',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  placeholderText: { fontSize: FontSize.sm, color: '#666', marginTop: Spacing.sm },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing.screenPadding,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#E8E8E8',
  },
  submitButton: { backgroundColor: THEME.primary },
});

export default EnterpriseAppealScreen;
