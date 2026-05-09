import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Share,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Save, Box, Share2 } from 'lucide-react-native';
import { useAuthStore } from '@/stores';
import { API_CONFIG } from '@/constants/config';
import { authenticatedFetch } from '@/services/authenticatedFetch';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'BlueprintPreview'>;

const LAYER_MODES = ['全模型', '仅钢筋', '仅混凝土'] as const;
type LayerMode = typeof LAYER_MODES[number];

const PreviewScreen: React.FC<Props> = ({ navigation, route }) => {
  const { componentParams: rawParams, confidence, qualityIssues } = route.params || {};
  const [resolvedParams, setResolvedParams] = useState<any>(null);
  const [fetchingSaved, setFetchingSaved] = useState(false);
  const [layerMode, setLayerMode] = useState<LayerMode>('全模型');
  const [modelReady, setModelReady] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const [savedComponentId, setSavedComponentId] = useState<string | null>(null);
  const webviewRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const isFromSaved = rawParams?.fromSaved === true;
  const componentParams = isFromSaved ? resolvedParams : rawParams;

  useEffect(() => {
    if (!isFromSaved) return;
    const componentId = rawParams?.componentId;
    if (!componentId) return;
    setFetchingSaved(true);
    (async () => {
      try {
        const url = `${API_CONFIG.BASE_URL}/api/blueprint/components/${componentId}`;
        const res = await authenticatedFetch(url);
        const data = await res.json();
        if (data.code === 200 && data.result?.model_params) {
          let mp = data.result.model_params;
          if (typeof mp === 'string') {
            try { mp = JSON.parse(mp); } catch { mp = []; }
          }
          setResolvedParams(mp);
          setSavedComponentId(componentId);
        } else {
          Alert.alert('加载失败', '无法获取构件数据');
          navigation.goBack();
        }
      } catch (e) {
        Alert.alert('加载失败', '网络异常');
        navigation.goBack();
      } finally {
        setFetchingSaved(false);
      }
    })();
  }, [isFromSaved, rawParams, navigation]);

  const handleSave = useCallback(async () => {
    if (!componentParams || savedComponentId) return;
    try {
      const userId = String(user?.id || 'anonymous');
      const firstComp = Array.isArray(componentParams) ? componentParams[0] : componentParams;
      const compName = firstComp?.component_id || '未命名构件';
      const compType = firstComp?.component_type || 'beam';
      const url = `${API_CONFIG.BASE_URL}/api/blueprint/save`;
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('component_name', compName);
      formData.append('component_type', compType);
      formData.append('model_params', JSON.stringify(componentParams));
      const res = await authenticatedFetch(url, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.code === 200 && data.result?.id) {
        setSavedComponentId(data.result.id);
        Alert.alert('保存成功', '构件已保存到列表');
      } else if (data.message?.includes('已存在')) {
        Alert.alert('提示', '该构件已保存过');
      } else {
        Alert.alert('保存失败', data.message || '请重试');
      }
    } catch (e) {
      Alert.alert('保存失败', '网络异常');
    }
  }, [componentParams, user, savedComponentId]);

  const handleShare = useCallback(async () => {
    const compId = savedComponentId;
    if (!compId) {
      Alert.alert('提示', '请先保存构件再分享');
      return;
    }
    try {
      const url = `${API_CONFIG.BASE_URL}/api/blueprint/share`;
      const formData = new FormData();
      formData.append('component_id', compId);
      const res = await authenticatedFetch(url, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.code === 200 && data.result?.share_url) {
        await Share.share({
          message: `查看3D钢筋模型: ${data.result.share_url}`,
          title: '图纸转3D - 分享3D模型',
        });
      } else {
        Alert.alert('分享失败', data.message || '请重试');
      }
    } catch (e) {
      if ((e as any).message !== 'User did not share') {
        Alert.alert('分享失败', '请重试');
      }
    }
  }, [savedComponentId]);

  const onWebViewMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'MODEL_READY') {
        setModelReady(true);
      } else if (msg.type === 'RENDER_ERROR') {
        setRenderError(true);
      }
    } catch {}
  }, []);

  const injectBuildModel = useCallback(() => {
    if (webviewRef.current && componentParams) {
      const js = `if(typeof buildModel==='function'){try{buildModel(${JSON.stringify(componentParams)});}catch(e){post({type:'RENDER_ERROR',error:e.message});}}`;
      webviewRef.current.injectJavaScript(js);
    }
  }, [componentParams]);

  const switchLayer = useCallback((mode: LayerMode) => {
    setLayerMode(mode);
    if (webviewRef.current) {
      const modeMap = { '全模型': 'all', '仅钢筋': 'rebar', '仅混凝土': 'concrete' };
      const js = `if(typeof switchLayer==='function'){switchLayer('${modeMap[mode]}');}`;
      webviewRef.current.injectJavaScript(js);
    }
  }, []);

  const handleLayerToggle = useCallback(() => {
    const idx = LAYER_MODES.indexOf(layerMode);
    const next = LAYER_MODES[(idx + 1) % LAYER_MODES.length];
    switchLayer(next);
  }, [layerMode, switchLayer]);

  const handleRetake = useCallback(() => {
    navigation.navigate('BlueprintCamera');
  }, [navigation]);

  const showWarning = confidence === 'low' || (qualityIssues && qualityIssues.length > 0);

  if (renderError) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>3D渲染失败，设备可能不支持WebGL</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetake}>
            <Text style={styles.retryButtonText}>重新拍摄</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (fetchingSaved || !componentParams) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <ActivityIndicator size="large" color="#E67E22" />
          <Text style={styles.errorText}>加载构件数据...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showWarning && (
        <View style={[styles.warningBar, { top: insets.top }]}>
          <Text style={styles.warningText}>
            {confidence === 'low' ? '⚠️ 识别结果仅供参考' : `⚠️ ${qualityIssues?.[0] || '图纸存在质量问题'}`}
          </Text>
        </View>
      )}
      <WebView
        ref={webviewRef}
        source={{ uri: 'file:///android_asset/blueprint-3d-viewer.html?nocache=' + Date.now() }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled={false}
        cacheEnabled={false}
        allowFileAccess
        onMessage={onWebViewMessage}
        onLoadEnd={injectBuildModel}
        renderLoading={() => (
          <View style={styles.webviewLoading}>
            <ActivityIndicator size="large" color="#E67E22" />
          </View>
        )}
        startInLoadingState
      />
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.sideButton} onPress={handleSave}>
          <Save size={24} color="#fff" />
          <Text style={styles.sideButtonText}>{savedComponentId ? '已保存' : '保存'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.centerButton} onPress={handleLayerToggle}>
          <Box size={32} color="#E67E22" />
          <Text style={styles.centerButtonText}>{layerMode}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideButton} onPress={handleShare}>
          <Share2 size={24} color="#fff" />
          <Text style={styles.sideButtonText}>分享</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1 },
  webviewLoading: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#000',
  },
  warningBar: {
    position: 'absolute', left: 0, right: 0,
    backgroundColor: '#FF9800', paddingVertical: 6, paddingHorizontal: 12,
    zIndex: 10,
  },
  warningText: { color: '#fff', fontSize: 12 },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  sideButton: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  sideButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  centerButton: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  centerButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16,
  },
  errorText: { color: '#fff', fontSize: 16, textAlign: 'center' },
  retryButton: {
    paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 8, backgroundColor: '#E67E22',
  },
  retryButtonText: { color: '#fff', fontSize: 16 },
});

export default PreviewScreen;
