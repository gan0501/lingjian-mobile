import React, { FC, useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {
  ChevronLeft,
  PenTool,
  Square,
  MousePointer2,
  Undo2,
  Trash2,
  Maximize2,
  BrickWall,
  Cylinder,
  Blinds,
} from 'lucide-react-native';
import type { RootStackScreenProps } from '@/navigation/types';
import { BottomActionBar } from '@/components/common';
import { GlassBottomSheet } from '@/components/overlay';
import { useAIToolGuard } from '@/hooks';
import { FontSize } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';

type Props = RootStackScreenProps<'PitDetail'>;

const { height: SCREEN_H } = Dimensions.get('window');

interface PitData {
  id: number;
  type: 'rect' | 'circle';
  cx: number;
  cy: number;
  name: string;
  width?: number;
  height?: number;
  diameter?: number;
  topElev: number;
  bottomElev: number;
  wallThk: number;
  membraneThk: number;
  bottomThk: number;
  bottomMembraneThk: number;
  depth: number;
}

type StepMode = 1 | 2;
type DrawTool = 'draw' | 'select';
type CategoryTab = 'pit' | 'wall' | 'pile' | 'stair';

const CATEGORY_TABS: { key: CategoryTab; label: string; iconKey: string }[] = [
  { key: 'pit', label: '坑井', iconKey: 'Square' },
  { key: 'wall', label: '墙/板', iconKey: 'BrickWall' },
  { key: 'pile', label: '桩/柱', iconKey: 'Cylinder' },
  { key: 'stair', label: '窗/梯', iconKey: 'Blinds' },
];

const EXPORT_FORMATS = [
  { key: 'DXF', label: 'DXF 工程图', desc: 'AutoCAD 兼容格式' },
  { key: 'PNG', label: 'PNG 截图', desc: '高清平面图' },
];

const PitDetailScreen: FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<StepMode>(1);
  const [drawTool, setDrawTool] = useState<DrawTool>('draw');
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('pit');
  const [pits, setPits] = useState<PitData[]>([]);
  const [selectedPitId, setSelectedPitId] = useState<number | null>(null);
  const [propsSheetVisible, setPropsSheetVisible] = useState(false);
  const [selectedExportFormats, setSelectedExportFormats] = useState<Set<string>>(new Set(['PNG']));
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'3d' | 'plan' | 'section'>('3d');
  const [bottomBarH, setBottomBarH] = useState(0);

  const guard = useAIToolGuard('pit_detail');
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    guard().then((result) => {
      if (!result) navigation.goBack();
      setAllowed(result);
    }).catch(() => {
      navigation.goBack();
      setAllowed(false);
    });
  }, []);

  const selectedPit = useMemo(
    () => pits.find((p) => p.id === selectedPitId) || null,
    [pits, selectedPitId],
  );

  const sendToWebView = useCallback((data: object) => {
    webViewRef.current?.postMessage(JSON.stringify(data));
  }, []);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'canvasReady':
          setLoading(false);
          break;
        case 'pitCreated':
          break;
        case 'pitSelected':
          setSelectedPitId(data.id);
          setPropsSheetVisible(true);
          break;
        case 'pitDeselected':
          setSelectedPitId(null);
          setPropsSheetVisible(false);
          break;
        case 'pitsChanged':
          setPits(data.pits || []);
          break;
        case 'stepChanged':
          setStep(data.step);
          setGenerating(false);
          break;
        case 'exportResult':
          setGenerating(false);
          Alert.alert('导出完成', `${data.format} 文件已生成`);
          break;
      }
    } catch {}
  }, []);

  const handleToolChange = useCallback(
    (tool: DrawTool) => {
      setDrawTool(tool);
      sendToWebView({ type: 'setTool', tool });
    },
    [sendToWebView],
  );

  const handleGenerate3D = useCallback(() => {
    if (pits.length === 0) {
      Alert.alert('提示', '请先绘制坑体');
      return;
    }
    setGenerating(true);
    sendToWebView({ type: 'generate3D' });
  }, [pits.length, sendToWebView]);

  const handleBackToStep1 = useCallback(() => {
    setStep(1);
    setViewMode('3d');
    sendToWebView({ type: 'switchStep', step: 1 });
  }, [sendToWebView]);

  const handleUndo = useCallback(() => {
    sendToWebView({ type: 'undo' });
  }, [sendToWebView]);

  const handleClear = useCallback(() => {
    Alert.alert('确认', '是否清除所有坑体？', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除',
        style: 'destructive',
        onPress: () => sendToWebView({ type: 'clearAll' }),
      },
    ]);
  }, [sendToWebView]);

  const handleZoomFit = useCallback(() => {
    sendToWebView({ type: 'zoomFit' });
  }, [sendToWebView]);

  const handleUpdatePitProp = useCallback(
    (prop: string, value: number | string) => {
      if (!selectedPitId) return;
      sendToWebView({ type: 'updatePit', id: selectedPitId, prop, value: Number(value) });
    },
    [selectedPitId, sendToWebView],
  );

  const handleDeletePit = useCallback(() => {
    if (!selectedPitId) return;
    sendToWebView({ type: 'deletePit', id: selectedPitId });
    setSelectedPitId(null);
    setPropsSheetVisible(false);
  }, [selectedPitId, sendToWebView]);

  const handleExport = useCallback(() => {
    const formats = [...selectedExportFormats];
    if (formats.length === 0) {
      Alert.alert('提示', '请选择导出格式');
      return;
    }
    for (const fmt of formats) {
      sendToWebView({ type: fmt === 'DXF' ? 'exportDXF' : 'exportPNG' });
    }
  }, [selectedExportFormats, sendToWebView]);

  const toggleExportFormat = useCallback((key: string) => {
    setSelectedExportFormats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleCategoryPress = useCallback((key: CategoryTab) => {
    if (key !== 'pit') {
      Alert.alert('即将推出', `${CATEGORY_TABS.find((t) => t.key === key)?.label} 功能即将上线，敬请期待`);
      return;
    }
    setActiveCategory(key);
  }, []);

  const handleViewModeChange = useCallback(
    (mode: '3d' | 'plan' | 'section') => {
      setViewMode(mode);
      sendToWebView({ type: 'switchViewMode', mode });
    },
    [sendToWebView],
  );

  const renderCategoryIcon = useCallback(
    (iconKey: string, active: boolean) => {
      const color = active ? '#e94560' : 'rgba(255,255,255,0.6)';
      const size = 16;
      switch (iconKey) {
        case 'Square':
          return <Square size={size} color={color} />;
        case 'BrickWall':
          return <BrickWall size={size} color={color} />;
        case 'Cylinder':
          return <Cylinder size={size} color={color} />;
        case 'Blinds':
          return <Blinds size={size} color={color} />;
        default:
          return <Square size={size} color={color} />;
      }
    },
    [],
  );

  const bottomTabs = useMemo(
    () =>
      CATEGORY_TABS.map((tab) => {
        const isActive = activeCategory === tab.key;
        return {
          icon: renderCategoryIcon(tab.iconKey, isActive),
          label: tab.label,
          onPress: () => handleCategoryPress(tab.key),
          active: isActive,
        };
      }),
    [activeCategory, handleCategoryPress, renderCategoryIcon],
  );

  if (allowed === null || !allowed) return null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity
          onPress={() => (step === 2 ? handleBackToStep1() : navigation.goBack())}
          style={styles.backBtn}
        >
          <ChevronLeft size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 1 ? '平面布局' : '3D预览 & 导出'}
        </Text>
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
          <View style={styles.stepLine} />
          <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
        </View>
      </LinearGradient>

      {step === 1 && (
        <View style={styles.toolBar}>
          <TouchableOpacity
            style={[styles.toolBtn, drawTool === 'draw' && styles.toolBtnActive]}
            onPress={() => handleToolChange('draw')}
          >
            <PenTool size={18} color={drawTool === 'draw' ? '#e94560' : '#888'} />
            <Text style={[styles.toolLabel, drawTool === 'draw' && styles.toolLabelActive]}>
              手绘
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolBtn, drawTool === 'select' && styles.toolBtnActive]}
            onPress={() => handleToolChange('select')}
          >
            <MousePointer2 size={18} color={drawTool === 'select' ? '#e94560' : '#888'} />
            <Text style={[styles.toolLabel, drawTool === 'select' && styles.toolLabelActive]}>
              选择
            </Text>
          </TouchableOpacity>
          <View style={styles.toolDivider} />
          <TouchableOpacity style={styles.toolBtn} onPress={handleUndo}>
            <Undo2 size={18} color="#888" />
            <Text style={styles.toolLabel}>撤销</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={handleClear}>
            <Trash2 size={18} color="#888" />
            <Text style={styles.toolLabel}>清除</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={handleZoomFit}>
            <Maximize2 size={18} color="#888" />
            <Text style={styles.toolLabel}>适应</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 2 && (
        <View style={styles.viewModeBar}>
          {[
            { key: '3d', label: '3D实体' },
            { key: 'plan', label: '平面图' },
            { key: 'section', label: '剖面图' },
          ].map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.viewModeBtn, viewMode === m.key && styles.viewModeBtnActive]}
              onPress={() => handleViewModeChange(m.key as '3d' | 'plan' | 'section')}
            >
              <Text
                style={[styles.viewModeLabel, viewMode === m.key && styles.viewModeLabelActive]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#e94560" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ uri: 'file:///android_asset/pit-detail-mobile.html' }}
        style={styles.webview}
        originWhitelist={['*']}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        onLoadEnd={() => {
          setLoading(false);
          sendToWebView({ type: 'setTool', tool: drawTool });
        }}
        onError={(e) => {
          console.warn('[PitDetail] WebView error:', e.nativeEvent.description);
          setLoading(false);
        }}
        mixedContentMode="always"
        cacheEnabled={false}
        cacheMode="LOAD_NO_CACHE"
        scalesPageToFit={false}
        automaticallyAdjustContentInsets={false}
        contentMode="mobile"
        scrollEnabled={false}
        bounces={false}
      />

      {step === 2 && (
        <View style={[styles.exportPanel, { bottom: bottomBarH }]}>
          <ScrollView style={styles.exportSection} showsVerticalScrollIndicator={false}>
            {EXPORT_FORMATS.map((fmt) => (
              <TouchableOpacity
                key={fmt.key}
                style={[
                  styles.exportRow,
                  selectedExportFormats.has(fmt.key) && styles.exportRowActive,
                ]}
                onPress={() => toggleExportFormat(fmt.key)}
                activeOpacity={0.7}
              >
                <View style={styles.exportRowLeft}>
                  <View
                    style={[
                      styles.exportCheck,
                      selectedExportFormats.has(fmt.key) && styles.exportCheckActive,
                    ]}
                  >
                    {selectedExportFormats.has(fmt.key) && (
                      <Text style={styles.exportCheckMark}>✓</Text>
                    )}
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.exportLabel,
                        selectedExportFormats.has(fmt.key) && styles.exportLabelActive,
                      ]}
                    >
                      {fmt.label}
                    </Text>
                    <Text style={styles.exportDesc}>{fmt.desc}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View
        style={styles.bottomBar}
        onLayout={(e) => setBottomBarH(e.nativeEvent.layout.height)}
      >
        <BottomActionBar
          mainButtonText={step === 1 ? '生成3D实体' : '导出'}
          onMainButtonPress={step === 1 ? handleGenerate3D : handleExport}
          mainButtonDisabled={step === 1 ? pits.length === 0 : selectedExportFormats.size === 0}
          mainButtonLoading={generating}
          customTabs={bottomTabs}
        />
      </View>

      <GlassBottomSheet
        visible={propsSheetVisible && !!selectedPit}
        onClose={() => {
          setPropsSheetVisible(false);
          setSelectedPitId(null);
          sendToWebView({ type: 'deselectPit' });
        }}
        title={selectedPit ? `${selectedPit.name} #${selectedPit.id}` : '构件属性'}
        showClose
        theme="dark"
      >
        {selectedPit && (
          <ScrollView style={styles.propsContent} showsVerticalScrollIndicator={false}>
            <View style={styles.propGroup}>
              <Text style={styles.propGroupTitle}>基本信息</Text>
              <View style={styles.propRow}>
                <View style={styles.propField}>
                  <Text style={styles.propLabel}>名称</Text>
                  <TextInput
                    style={styles.propInput}
                    value={selectedPit.name}
                    onChangeText={(v) => handleUpdatePitProp('name', v)}
                  />
                </View>
              </View>
              {selectedPit.type === 'rect' ? (
                <View style={styles.propRow}>
                  <View style={styles.propField}>
                    <Text style={styles.propLabel}>宽度(mm)</Text>
                    <TextInput
                      style={styles.propInput}
                      value={String(selectedPit.width || '')}
                      keyboardType="numeric"
                      onChangeText={(v) => handleUpdatePitProp('width', v)}
                    />
                  </View>
                  <View style={styles.propField}>
                    <Text style={styles.propLabel}>高度(mm)</Text>
                    <TextInput
                      style={styles.propInput}
                      value={String(selectedPit.height || '')}
                      keyboardType="numeric"
                      onChangeText={(v) => handleUpdatePitProp('height', v)}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.propRow}>
                  <View style={styles.propField}>
                    <Text style={styles.propLabel}>直径(mm)</Text>
                    <TextInput
                      style={styles.propInput}
                      value={String(selectedPit.diameter || '')}
                      keyboardType="numeric"
                      onChangeText={(v) => handleUpdatePitProp('diameter', v)}
                    />
                  </View>
                </View>
              )}
            </View>

            <View style={styles.propGroup}>
              <Text style={styles.propGroupTitle}>标高</Text>
              <View style={styles.propRow}>
                <View style={styles.propField}>
                  <Text style={styles.propLabel}>顶标高(m)</Text>
                  <TextInput
                    style={styles.propInput}
                    value={String(selectedPit.topElev)}
                    keyboardType="numeric"
                    onChangeText={(v) => handleUpdatePitProp('topElev', v)}
                  />
                </View>
                <View style={styles.propField}>
                  <Text style={styles.propLabel}>底标高(m)</Text>
                  <TextInput
                    style={styles.propInput}
                    value={String(selectedPit.bottomElev)}
                    keyboardType="numeric"
                    onChangeText={(v) => handleUpdatePitProp('bottomElev', v)}
                  />
                </View>
              </View>
              <Text style={styles.propHint}>
                深度: {((selectedPit.topElev - selectedPit.bottomElev) * 1000).toFixed(0)}mm (
                {(selectedPit.topElev - selectedPit.bottomElev).toFixed(3)}m)
              </Text>
            </View>

            <View style={styles.propGroup}>
              <Text style={styles.propGroupTitle}>厚度参数</Text>
              <View style={styles.propRow}>
                <View style={styles.propField}>
                  <Text style={styles.propLabel}>壁厚(mm)</Text>
                  <TextInput
                    style={styles.propInput}
                    value={String(selectedPit.wallThk)}
                    keyboardType="numeric"
                    onChangeText={(v) => handleUpdatePitProp('wallThk', v)}
                  />
                </View>
                <View style={styles.propField}>
                  <Text style={styles.propLabel}>膜厚(mm)</Text>
                  <TextInput
                    style={styles.propInput}
                    value={String(selectedPit.membraneThk)}
                    keyboardType="numeric"
                    onChangeText={(v) => handleUpdatePitProp('membraneThk', v)}
                  />
                </View>
              </View>
              <View style={styles.propRow}>
                <View style={styles.propField}>
                  <Text style={styles.propLabel}>坑底厚(mm)</Text>
                  <TextInput
                    style={styles.propInput}
                    value={String(selectedPit.bottomThk)}
                    keyboardType="numeric"
                    onChangeText={(v) => handleUpdatePitProp('bottomThk', v)}
                  />
                </View>
                <View style={styles.propField}>
                  <Text style={styles.propLabel}>底膜厚(mm)</Text>
                  <TextInput
                    style={styles.propInput}
                    value={String(selectedPit.bottomMembraneThk)}
                    keyboardType="numeric"
                    onChangeText={(v) => handleUpdatePitProp('bottomMembraneThk', v)}
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.deleteBtn} onPress={handleDeletePit}>
              <Trash2 size={16} color="#e94560" />
              <Text style={styles.deleteBtnText}>删除此构件</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </GlassBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 40,
    justifyContent: 'flex-end',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  stepDotActive: {
    backgroundColor: '#e94560',
  },
  stepLine: {
    width: 12,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  toolBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,52,96,0.5)',
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  toolBtnActive: {
    backgroundColor: 'rgba(233,69,96,0.12)',
  },
  toolLabel: {
    fontSize: 12,
    color: '#888',
  },
  toolLabelActive: {
    color: '#e94560',
  },
  toolDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 4,
  },
  viewModeBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,52,96,0.5)',
    gap: 8,
  },
  viewModeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  viewModeBtnActive: {
    backgroundColor: 'rgba(233,69,96,0.15)',
    borderColor: '#e94560',
  },
  viewModeLabel: {
    fontSize: 13,
    color: '#888',
  },
  viewModeLabelActive: {
    color: '#e94560',
    fontWeight: '600',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15,15,35,0.9)',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#e0e0e0',
  },
  exportPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(22,33,62,0.95)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: SCREEN_H * 0.3,
  },
  exportSection: {
    flex: 1,
  },
  exportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  exportRowActive: {
    backgroundColor: 'rgba(233,69,96,0.08)',
    borderColor: 'rgba(233,69,96,0.3)',
  },
  exportRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exportCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportCheckActive: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  exportCheckMark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  exportLabel: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  exportLabelActive: {
    color: '#fff',
  },
  exportDesc: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(22,33,62,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  propsContent: {
    maxHeight: SCREEN_H * 0.5,
  },
  propGroup: {
    marginBottom: 16,
  },
  propGroupTitle: {
    fontSize: 13,
    color: '#4a8fe7',
    fontWeight: '600',
    marginBottom: 8,
  },
  propRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  propField: {
    flex: 1,
  },
  propLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 4,
  },
  propInput: {
    height: 36,
    backgroundColor: 'rgba(15,52,96,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    color: '#e0e0e0',
    paddingHorizontal: 10,
    fontSize: 14,
  },
  propHint: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(233,69,96,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(233,69,96,0.2)',
    gap: 6,
    marginTop: 8,
  },
  deleteBtnText: {
    fontSize: 14,
    color: '#e94560',
    fontWeight: '600',
  },
});

export default PitDetailScreen;
