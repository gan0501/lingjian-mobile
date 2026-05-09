import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/common/Header';
import { API_CONFIG } from '@/constants/config';
import { useAuthStore } from '@/stores/useAuthStore';

const FeedbackScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { token } = useAuthStore();

  const handleSubmit = async () => {
    if (!content.trim()) { Alert.alert('提示', '请输入反馈内容'); return; }
    try {
      setSubmitting(true);
      const resp = await fetch(`${API_CONFIG.BASE_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: content.trim(), contact: contact.trim() }),
      });
      if (resp.ok) {
        Alert.alert('提交成功', '感谢您的反馈，我们会尽快处理！', [{ text: '确定', onPress: () => navigation.goBack() }]);
        setContent('');
        setContact('');
      } else {
        Alert.alert('提交失败', '请稍后重试');
      }
    } catch (error: any) {
      Alert.alert('提交失败', error?.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="用户反馈中心" showBack onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.contentSection}>
          <Text style={styles.sectionTitle}>问题与建议</Text>
          <Text style={styles.hint}>请详细描述您遇到的问题或建议，我们会认真处理每一条反馈</Text>
          <View style={styles.inputContainer}>
            <TextInput style={styles.textInput} value={content} onChangeText={setContent} placeholder="请输入反馈内容..." placeholderTextColor="#999" multiline textAlignVertical="top" />
          </View>
          <Text style={styles.sectionTitle}>联系方式（选填）</Text>
          <Text style={styles.hint}>留下您的联系方式，方便我们进一步沟通</Text>
          <View style={styles.inputContainer}>
            <TextInput style={styles.contactInput} value={contact} onChangeText={setContact} placeholder="手机号 / 邮箱 / 微信号" placeholderTextColor="#999" />
          </View>
        </View>
        <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 10 }]}>
          <TouchableOpacity style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.submitButtonText}>{submitting ? '提交中...' : '提交反馈'}</Text>
          </TouchableOpacity>
          <View style={styles.footer}>
            <Text style={styles.footerText}>感谢您的支持与理解</Text>
            <Text style={styles.footerText}>领建团队</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'space-between' },
  contentSection: { padding: 20, flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 16 },
  hint: { fontSize: 12, color: '#999', marginBottom: 12, lineHeight: 18 },
  inputContainer: { marginBottom: 8 },
  textInput: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, fontSize: 15, color: '#333', minHeight: 200, borderWidth: 1, borderColor: '#e5e5e5' },
  contactInput: { backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 4, fontSize: 15, color: '#333', borderWidth: 1, borderColor: '#e5e5e5', height: 44 },
  bottomSection: { paddingHorizontal: 20, paddingTop: 20 },
  submitButton: { backgroundColor: '#80011A', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  footer: { alignItems: 'center', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e5e5' },
  footerText: { fontSize: 12, color: '#999', lineHeight: 20 },
});

export default FeedbackScreen;
