import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authenticatedFetch } from '@/services/authenticatedFetch';
import { API_CONFIG } from '@/constants/config';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'BlueprintLoading'>;

const LoadingScreen: React.FC<Props> = ({ navigation, route }) => {
  const { imageBase64 } = route.params || {};
  const cropArea = (route.params as any)?.cropArea;
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const callAnalyzeApi = useCallback(async () => {
    try {
      const apiUrl = `${API_CONFIG.BASE_URL}/api/blueprint/analyze`;
      const formData = new FormData();
      formData.append('image_base64', imageBase64);
      formData.append('image_format', 'jpeg');
      formData.append('preprocess_enabled', 'true');
      if (cropArea) {
        formData.append('crop_x', String(cropArea.x));
        formData.append('crop_y', String(cropArea.y));
        formData.append('crop_w', String(cropArea.width));
        formData.append('crop_h', String(cropArea.height));
      }

      const response = await authenticatedFetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.code !== 200) {
        const errorMap: Record<number, string> = {
          400: '图片格式异常，请重新拍摄',
          413: '图片过大，请重新拍摄',
          422: '图片数据异常，请重新拍摄',
          503: 'AI识别服务暂不可用，请稍后重试',
          504: 'AI识别超时，请重新拍摄',
        };
        setError(errorMap[data.code] || `识别失败(${data.code})，请重试`);
        return;
      }

      const result = data.result;
      if (!result.is_blueprint) {
        const detail = result.quality_issues?.length
          ? result.quality_issues.join('; ')
          : result.raw_vl_output
            ? `VL输出: ${result.raw_vl_output.substring(0, 200)}`
            : '';
        setError(detail ? `识别失败\n${detail}` : '识别失败，请重试');
        return;
      }

      if (!result.model_params_list || result.model_params_list.length === 0) {
        setError('未识别到构件信息，请拍摄清晰的建筑图纸');
        return;
      }

      setStep(2);
      setTimeout(() => {
        navigation.replace('BlueprintPreview', {
          componentParams: result.model_params_list,
          confidence: result.confidence,
          qualityIssues: result.quality_issues,
        });
      }, 800);

    } catch (e: any) {
      if (e.message?.includes('Network')) {
        setError('网络异常，请检查网络后重试');
      } else {
        setError('识别失败，请重新拍摄');
      }
    }
  }, [imageBase64, navigation]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setError('识别时间过长，请重新拍摄清晰的图纸');
    }, 30000);

    callAnalyzeApi().catch(() => {
      setError('识别失败，请重新拍摄');
    });

    return () => clearTimeout(timer);
  }, []);

  const handleRetry = useCallback(() => {
    navigation.navigate('BlueprintCamera');
  }, [navigation]);

  const handleGoHome = useCallback(() => {
    navigation.navigate('Home');
  }, [navigation]);

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.errorButtons}>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>重新拍摄</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
              <Text style={styles.homeButtonText}>返回首页</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E67E22" />
          <Text style={styles.stepText}>步骤 {step}/2</Text>
          <Text style={styles.loadingText}>
            {step === 1 ? 'AI正在解析图纸参数...' : '正在生成钢筋3D模型...'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  loadingContainer: { alignItems: 'center', gap: 16 },
  stepText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 16 },
  loadingText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  errorContainer: { alignItems: 'center', paddingHorizontal: 32, gap: 12 },
  errorIcon: { fontSize: 48 },
  errorText: { color: '#fff', fontSize: 16, textAlign: 'center', lineHeight: 24 },
  errorButtons: { flexDirection: 'row', gap: 16, marginTop: 16 },
  retryButton: {
    paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 8, backgroundColor: '#E67E22',
  },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  homeButton: {
    paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)',
  },
  homeButtonText: { color: '#fff', fontSize: 16 },
});

export default LoadingScreen;
