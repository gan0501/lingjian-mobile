import { Loading } from '@/components/common/Loading';
import React, { FC, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DocumentPicker from 'react-native-document-picker';
import { Upload, FileText, CheckCircle, ChevronLeft } from 'lucide-react-native';
import { DotMatrixBackground } from '@/components/home/DotMatrixBackground';
import type { RootStackScreenProps } from '@/navigation/types';
import { API_CONFIG, DEFAULT_PROVINCES, PROVINCE_CODE_BY_NAME } from '@/constants/config';
import { CITY_CODE_MAPPING } from '@/constants/cityMapping';
import { useAuthStore } from '@/stores/useAuthStore';
import { showAlert } from '@/components/common/CustomAlert';
import { storage } from '@/utils/storage';

const THEME = {
  day: {
    bg: '#F5F7FA',
    surface: '#FFFFFF',
    text: '#1A1A2E',
    textSub: '#6B7280',
    textMuted: '#9CA3AF',
    accent: '#B20000',
    accentAlpha: 'rgba(178,0,0,0.15)',
    accentBorder: 'rgba(178,0,0,0.3)',
    border: '#E5E7EB',
    inputBg: '#F0F2F5',
    sheetBg: '#FFFFFF',
    overlayBg: 'rgba(0,0,0,0.4)',
    placeholder: '#9CA3AF',
  },
  night: {
    bg: '#05080C',
    surface: 'rgba(28, 20, 45, 0.65)',
    text: '#FFFFFF',
    textSub: 'rgba(255,255,255,0.6)',
    textMuted: 'rgba(255,255,255,0.5)',
    accent: '#C084FC',
    accentAlpha: 'rgba(192, 132, 252, 0.15)',
    accentBorder: 'rgba(192, 132, 252, 0.4)',
    border: 'rgba(255,255,255,0.1)',
    inputBg: 'rgba(28, 20, 45, 0.65)',
    sheetBg: 'rgba(28, 20, 45, 0.98)',
    overlayBg: 'rgba(0,0,0,0.7)',
    placeholder: 'rgba(255,255,255,0.3)',
  },
};

const showAlertDay = (title: string, message?: string, buttons?: any[]) => {
  showAlert({
    title,
    message,
    buttons: buttons?.map(b => ({
      text: b.text,
      onPress: b.onPress,
      style: b.style,
    })),
    theme: 'day',
  });
};

type Props = RootStackScreenProps<'ResourceUpload'>;

const LOCAL_MESSAGES_KEY = 'local_message_center_v1';

const ResourceUploadScreen: FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const C = isDark ? THEME.night : THEME.day;
  const { uploadType } = route.params;
  const { token, isLoggedIn, user } = useAuthStore();

  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    area: '',
    remark: '',
  });

  const [pickerVisible, setPickerVisible] = useState<'region' | 'period' | null>(null);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const [tempProvince, setTempProvince] = useState('');
  const [tempCity, setTempCity] = useState('');
  const [tempYear, setTempYear] = useState(new Date().getFullYear());
  const [tempMonth, setTempMonth] = useState(new Date().getMonth() + 1);

  const years = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const getCitiesByProvince = (provinceName: string) => {
    if (!provinceName) return [] as string[];
    const provinceCode = PROVINCE_CODE_BY_NAME[provinceName];
    if (!provinceCode) return [] as string[];
    return Object.entries(CITY_CODE_MAPPING)
      .filter(([code]) => code.startsWith(provinceCode))
      .map(([, name]) => name);
  };

  const getTitle = () => {
    switch (uploadType) {
      case 'norm':
        return '上传建筑规范';
      case 'atlas':
        return '上传标准图集';
      case 'material':
        return '上传信息价';
      default:
        return '上传资源';
    }
  };

  const getAcceptedTypes = () => {
    if (uploadType === 'material') {
      return [DocumentPicker.types.xls, DocumentPicker.types.xlsx];
    }
    return [DocumentPicker.types.pdf];
  };

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: getAcceptedTypes(),
        allowMultiSelection: false,
      });

      if (result && result.length > 0) {
        setSelectedFile(result[0]);
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        console.error('选择文件失败:', err);
        showAlertDay('错误', '选择文件失败');
      }
    }
  };

  const handleUpload = async () => {
    if (!isLoggedIn || !token) {
      showAlertDay('提示', '请先登录后才能上传资源', [
        { text: '取消', style: 'cancel' },
        { text: '去登录', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }

    if (!selectedFile) {
      showAlertDay('提示', '请先选择文件');
      return;
    }

    if (uploadType === 'material') {
      if (!selectedProvince || !selectedCity) {
        showAlertDay('提示', '请选择地区');
        return;
      }
      if (!selectedYear || !selectedMonth) {
        showAlertDay('提示', '请选择月份');
        return;
      }
    } else {
      if (!formData.name.trim()) {
        showAlertDay('提示', '请输入名称');
        return;
      }
    }

    try {
      setUploading(true);

      const uploadFormData = new FormData();
      const filename = (selectedFile?.name || '').toLowerCase();
      const fallbackType =
        uploadType === 'material'
          ? filename.endsWith('.xlsx')
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/vnd.ms-excel'
          : 'application/pdf';
      uploadFormData.append('file', {
        uri: selectedFile.uri,
        type: selectedFile.type || fallbackType,
        name: selectedFile.name,
      });

      const uploaderId = user?.id ? String(user.id) : (user?.phone || '');
      if (uploaderId) {
        uploadFormData.append('uploader_id', uploaderId);
      }

      if (uploadType === 'atlas') {
        uploadFormData.append('file_name', formData.name);
        uploadFormData.append('code', formData.code);
        uploadFormData.append('area', formData.area);
        uploadFormData.append('remark', formData.remark);
      } else if (uploadType === 'material') {
        uploadFormData.append('province', selectedProvince);
        uploadFormData.append('city', selectedCity);
        uploadFormData.append('year', String(selectedYear));
        uploadFormData.append('month', String(selectedMonth));
        uploadFormData.append('remark', formData.remark);
      } else {
        uploadFormData.append('name', formData.name);
        uploadFormData.append('code', formData.code);
        uploadFormData.append('area', formData.area);
        uploadFormData.append('remark', formData.remark);
      }

      let endpoint = '';
      switch (uploadType) {
        case 'norm':
          endpoint = '/api/resource/norms/upload';
          break;
        case 'atlas':
          endpoint = '/api/resource/standards/upload';
          break;
        case 'material':
          endpoint = '/api/resource/materials/upload';
          break;
      }

      const currentToken = useAuthStore.getState().token;
      const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentToken}`,
        },
        body: uploadFormData,
      });

      const data = await response.json();

      if (data.code === 200) {
        try {
          const raw = storage.getString(LOCAL_MESSAGES_KEY);
          const prev = raw ? JSON.parse(raw) : [];
          const next = Array.isArray(prev) ? prev : [];
          const ts = new Date();

          let contentDetail = '';
          if (uploadType === 'material') {
            contentDetail = `已收到你提交的信息价「${selectedProvince}${selectedCity} ${selectedYear}年${selectedMonth}月」。`;
          } else if (uploadType === 'norm') {
            contentDetail = `已收到你提交的建筑规范「${formData.name || selectedFile?.name || ''}」。`;
          } else if (uploadType === 'atlas') {
            contentDetail = `已收到你提交的标准图集「${formData.name || selectedFile?.name || ''}」。`;
          }

          const newMessage = {
            id: `local-upload-thanks-${ts.getTime()}`,
            category: 'system',
            title: '感谢你的贡献，赠人玫瑰，手有余香',
            content: `${contentDetail}管理员审核通过后将公开展示。`,
            time: '刚刚',
            unread: true,
          };
          next.unshift(newMessage);
          storage.set(LOCAL_MESSAGES_KEY, JSON.stringify(next.slice(0, 50)));
        } catch (e) {
          console.error('保存消息失败:', e);
        }
        showAlertDay('感谢共享', '上传成功，等待审核\n通过后，将获得10次额外查看机会', [
          {
            text: '确定',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        showAlertDay('失败', data.message || '上传失败');
      }
    } catch (error) {
      console.error('上传失败:', error);
      showAlertDay('错误', '上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      {isDark && (
        <View style={StyleSheet.absoluteFill}>
          <DotMatrixBackground />
        </View>
      )}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={C.text} size={24} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.text, textShadowColor: isDark ? 'rgba(192, 132, 252, 0.6)' : 'transparent' }]}>{getTitle()}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
      >
        <View style={styles.section}>
          <Text style={[styles.label, { color: C.text }]}>选择文件 *</Text>
          <TouchableOpacity
            style={[styles.fileSelector, { borderColor: C.accentBorder, backgroundColor: C.accentAlpha }]}
            onPress={handleSelectFile}
            disabled={uploading}
          >
            {selectedFile ? (
              <View style={styles.fileInfo}>
                <FileText color="#4CAF50" size={24} />
                <View style={styles.fileDetails}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
                  <Text style={styles.fileSize}>
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </Text>
                </View>
                <CheckCircle color="#4CAF50" size={20} />
              </View>
            ) : (
              <View style={styles.uploadPrompt}>
                <Upload color={C.accent} size={32} />
                <Text style={[styles.uploadPromptText, { color: C.accent }]}>
                  {uploadType === 'material'
                    ? '点击选择Excel文件'
                    : '点击选择PDF文件'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {uploadType === 'material' ? (
          <View style={styles.section}>
            <Text style={[styles.label, { color: C.text }]}>省市地区 *</Text>
            <TouchableOpacity
              style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border }]}
              activeOpacity={0.8}
              onPress={() => {
                setTempProvince(selectedProvince);
                setTempCity(selectedCity);
                setPickerVisible('region');
              }}
              disabled={uploading}
            >
              <Text style={[styles.pickerText, { color: C.text }]}>
                {selectedProvince && selectedCity ? `${selectedProvince} / ${selectedCity}` : '请选择省份/城市'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={[styles.label, { color: C.text }]}>{uploadType === 'atlas' ? '图集名称 *' : '规范名称 *'}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="请输入名称"
              placeholderTextColor={C.placeholder}
              editable={!uploading}
            />
          </View>
        )}

        {uploadType === 'material' ? (
          <View style={styles.section}>
            <Text style={[styles.label, { color: C.text }]}>月份 *</Text>
            <TouchableOpacity
              style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border }]}
              activeOpacity={0.8}
              onPress={() => {
                setTempYear(selectedYear || new Date().getFullYear());
                setTempMonth(selectedMonth || new Date().getMonth() + 1);
                setPickerVisible('period');
              }}
              disabled={uploading}
            >
              <Text style={[styles.pickerText, { color: C.text }]}>
                {selectedYear && selectedMonth ? `${selectedYear}年${selectedMonth}月` : '请选择年份月份'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={[styles.label, { color: C.text }]}>{uploadType === 'atlas' ? '图集编号' : '规范编号'}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]}
              value={formData.code}
              onChangeText={(text) => setFormData({ ...formData, code: text })}
              placeholder={uploadType === 'atlas' ? '请输入编号（如：16G101-1）' : '请输入编号（如：GB 50016-2014）'}
              placeholderTextColor={C.placeholder}
              editable={!uploading}
            />
          </View>
        )}

        {uploadType === 'atlas' && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: C.text }]}>省市地区</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]}
              value={formData.area}
              onChangeText={(text) => setFormData({ ...formData, area: text })}
              placeholder="请输入地区"
              placeholderTextColor={C.placeholder}
              editable={!uploading}
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.label, { color: C.text }]}>备注</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]}
            value={formData.remark}
            onChangeText={(text) => setFormData({ ...formData, remark: text })}
            placeholder="请输入备注信息"
            placeholderTextColor={C.placeholder}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!uploading}
          />
        </View>

        <Text style={[styles.notice, { color: C.textMuted }]}>
          * 上传的资源需要经过审核后才能在平台上显示
        </Text>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16, backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : '#FFFFFF', borderTopColor: C.border }]}>
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: C.accentAlpha, borderColor: C.accentBorder }, uploading && styles.submitButtonDisabled]}
          onPress={handleUpload}
          disabled={uploading}
        >
          {uploading ? (
            <Loading />
          ) : (
            <Text style={[styles.submitButtonText, { color: C.accent }]}>提交上传</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={pickerVisible === 'region'}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(null)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setPickerVisible(null)}
        >
          <View style={[styles.sheetContainer, { backgroundColor: C.sheetBg, borderColor: C.accentBorder }]} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: C.text }]}>选择省市地区</Text>

            <View style={styles.colHeaders}>
              <Text style={styles.colHeaderText}>省份</Text>
              <Text style={styles.colHeaderText}>城市</Text>
            </View>

            <View style={styles.dualRow}>
              <ScrollView style={styles.pickerCol} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {DEFAULT_PROVINCES.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.pickerItem, tempProvince === p && styles.pickerItemActive]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setTempProvince(p);
                      const cities = getCitiesByProvince(p);
                      setTempCity(cities.length > 0 ? cities[0] : '');
                    }}
                  >
                    <Text style={[styles.pickerItemText, tempProvince === p && styles.pickerItemTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.colDivider} />

              <ScrollView style={styles.pickerCol} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {getCitiesByProvince(tempProvince).length > 0 ? (
                  getCitiesByProvince(tempProvince).map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.pickerItem, tempCity === c && styles.pickerItemActive]}
                      activeOpacity={0.7}
                      onPress={() => setTempCity(c)}
                    >
                      <Text style={[styles.pickerItemText, tempCity === c && styles.pickerItemTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.pickerPlaceholder}>请先选择省份</Text>
                )}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={[styles.sheetConfirm, { backgroundColor: C.accentAlpha, borderColor: C.accentBorder }, (!tempProvince || !tempCity) && styles.sheetConfirmDisabled]}
              disabled={!tempProvince || !tempCity}
              onPress={() => {
                setSelectedProvince(tempProvince);
                setSelectedCity(tempCity);
                setPickerVisible(null);
              }}
            >
              <Text style={[styles.sheetConfirmText, { color: C.accent }]}>确认选择</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={pickerVisible === 'period'}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(null)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setPickerVisible(null)}
        >
          <View style={[styles.sheetContainer, { backgroundColor: C.sheetBg, borderColor: C.accentBorder }]} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: C.text }]}>选择期刊月份</Text>

            <View style={styles.colHeaders}>
              <Text style={styles.colHeaderText}>年份</Text>
              <Text style={styles.colHeaderText}>月份</Text>
            </View>

            <View style={styles.dualRow}>
              <ScrollView style={styles.pickerCol} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {years.map((y) => (
                  <TouchableOpacity
                    key={y}
                    style={[styles.pickerItem, tempYear === y && styles.pickerItemActive]}
                    activeOpacity={0.7}
                    onPress={() => setTempYear(y)}
                  >
                    <Text style={[styles.pickerItemText, tempYear === y && styles.pickerItemTextActive]}>{y}年</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.colDivider} />

              <ScrollView style={styles.pickerCol} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {months.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.pickerItem, tempMonth === m && styles.pickerItemActive]}
                    activeOpacity={0.7}
                    onPress={() => setTempMonth(m)}
                  >
                    <Text style={[styles.pickerItemText, tempMonth === m && styles.pickerItemTextActive]}>{m}月</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={[styles.sheetConfirm, { backgroundColor: C.accentAlpha, borderColor: C.accentBorder }]}
              onPress={() => {
                setSelectedYear(tempYear);
                setSelectedMonth(tempMonth);
                setPickerVisible(null);
              }}
            >
              <Text style={[styles.sheetConfirmText, { color: C.accent }]}>确认选择</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    backgroundColor: 'rgba(28, 20, 45, 0.65)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.15)',
  },
  backButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  fileSelector: {
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(192, 132, 252, 0.4)',
    padding: 20,
    backgroundColor: 'rgba(192, 132, 252, 0.05)',
  },
  uploadPrompt: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  uploadPromptText: {
    color: 'rgba(192, 132, 252, 0.6)',
    fontSize: 14,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  fileSize: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  input: {
    backgroundColor: 'rgba(28, 20, 45, 0.65)',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.2)',
  },
  pickerText: {
    color: '#fff',
    fontSize: 14,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  submitButton: {
    backgroundColor: 'rgba(192, 132, 252, 0.15)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.5)',
    shadowColor: '#C084FC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#C084FC',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
    textShadowColor: 'rgba(192, 132, 252, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  notice: {
    color: 'rgba(192, 132, 252, 0.4)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    letterSpacing: 0.5,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheetContainer: {
    backgroundColor: 'rgba(28, 20, 45, 0.98)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'left',
    marginBottom: 10,
  },
  colHeaders: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  colHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  dualRow: {
    flexDirection: 'row',
    height: 300,
  },
  pickerCol: {
    flex: 1,
  },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 3,
    marginHorizontal: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  pickerItemActive: {
    backgroundColor: 'rgba(192, 132, 252, 0.2)',
    borderColor: 'rgba(192, 132, 252, 0.4)',
  },
  pickerItemText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  pickerItemTextActive: {
    color: '#C084FC',
    fontWeight: '700',
  },
  pickerPlaceholder: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginTop: 40,
  },
  colDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 4,
  },
  sheetConfirm: {
    marginTop: 12,
    backgroundColor: 'rgba(192, 132, 252, 0.2)',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.4)',
  },
  sheetConfirmDisabled: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'transparent',
  },
  sheetConfirmText: {
    color: '#C084FC',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
});

export default ResourceUploadScreen;
