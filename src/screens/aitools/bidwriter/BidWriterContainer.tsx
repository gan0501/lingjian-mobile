import { Loading } from '@/components/common/Loading';
/**
 * BidWriter 主容器组件
 * 统一管理 Header、Footer、Modals，内容区根据 step 切换
 */
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DotMatrixBackground } from '@/components/home/DotMatrixBackground';

// ==================== 主题配置 ====================

/** 背景类型枚举 */
enum BackgroundType {
  GRADIENT = 'gradient',    // 渐变背景
  DOT_MATRIX = 'dotMatrix'  // 点阵背景
}

/** 背景配置接口 */
interface BackgroundConfig {
  type: BackgroundType;
  colors?: string[];        // 渐变色数组(仅 GRADIENT 类型)
  color?: string;           // 纯色(仅 DOT_MATRIX 类型)
}

/** 主题配置接口 */
interface ThemeConfig {
  background: BackgroundConfig;
  loadingColor: string;     // Loading 指示器颜色
  dotMatrixEnabled?: boolean; // 是否启用点阵动效
}

/** 主题模式枚举 */
enum ThemeMode {
  LIGHT = 'light',  // 日间模式
  DARK = 'dark'     // 夜间模式
}

/** 主题配置集合 */
const themeConfigs: Record<ThemeMode, ThemeConfig> = {
  [ThemeMode.LIGHT]: {
    background: {
      type: BackgroundType.GRADIENT,
      colors: ['#80011A', '#000000']
    },
    loadingColor: '#fff'
  },
  [ThemeMode.DARK]: {
    background: {
      type: BackgroundType.DOT_MATRIX,
      color: '#05080C'
    },
    loadingColor: '#C084FC',
    dotMatrixEnabled: true
  }
};

/** 获取主题配置函数 */
function getThemeConfig(darkBidMode: boolean): ThemeConfig {
  const mode = darkBidMode ? ThemeMode.DARK : ThemeMode.LIGHT;
  return themeConfigs[mode];
}
import {
  BidWriterHeader,
  BidWriterFooter,
  ModelSelectModal,
  StyleSelectModal,
  ConfigModal,
  KnowledgeModal,
  KnowledgeUploadModal,
} from '@/components/bidwriter';
import { AIContentDisclaimer } from '@/components/common/AIContentDisclaimer';
import {
  AI_MODELS as BID_WRITER_AI_MODELS,
  COVER_OPTIONS as BID_WRITER_COVER_OPTIONS,
  LAYOUT_OPTIONS as BID_WRITER_LAYOUT_OPTIONS,
  COLOR_OPTIONS as BID_WRITER_COLOR_OPTIONS,
} from '@/constants/bidWriter';
import { useBidWriterStore } from '@/stores/useBidWriterStore';
import { useAIToolGuard } from '@/hooks';
import { BidWriterProvider, useBidWriterContext, BidWriterStep } from './BidWriterContext';
import { useBidWriterModals } from './useBidWriterModals';
import UploadContent from './contents/UploadContent';
import OutlineContent from './contents/OutlineContent';
import GenerationContent from './contents/GenerationContent';
import type { RootStackScreenProps } from '@/navigation/types';
import { bidWriterApi } from '@/services/bidWriter';
import { MyBidsSidebar, type MyBidsListItem } from './components/MyBidsSidebar';

// 常量
const AI_MODELS = BID_WRITER_AI_MODELS;
const COVER_OPTIONS = BID_WRITER_COVER_OPTIONS;
const LAYOUT_OPTIONS = BID_WRITER_LAYOUT_OPTIONS;
const COLOR_OPTIONS = BID_WRITER_COLOR_OPTIONS;

type Props = RootStackScreenProps<'BidWriter'>;

// ==================== 内部组件 ====================

const BidWriterInner: FC<{ navigation: Props['navigation'] }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const {
    step,
    setStep,
    bidId,
    status,
    uploading,
    analyzing,
    generationPhase,
    projectOverview,
    outline,
    loading,
    loadUserConfig,
    saveUserConfig,
    mainButtonAction,
    exporting,
  } = useBidWriterContext();

  // 视图模式：本地状态（与老代码一致）
  const [viewMode, setViewMode] = useState<'directory' | 'content'>('directory');

  const {
    selectedModel,
    selectedCover,
    selectedLayout,
    selectedColor,
    wordCount,
    darkBidMode,
    autoWebImage,
    generateFlowchart,
    autoProofread,
    selectedKnowledgeFilePaths,
    setSelectedModel,
    setSelectedCover,
    setSelectedLayout,
    setSelectedColor,
    setWordCount,
    setAutoWebImage,
    setGenerateFlowchart,
    setAutoProofread,
    setDarkBidMode,
    refreshKnowledgeList,
  } = useBidWriterStore();

  // 获取主题配置
  const themeConfig = getThemeConfig(darkBidMode);

  const modals = useBidWriterModals();

  const [myBidsVisible, setMyBidsVisible] = useState(false);
  const [myBidsLoading, setMyBidsLoading] = useState(false);
  const [draftBids, setDraftBids] = useState<MyBidsListItem[]>([]);
  const [bidBids, setBidBids] = useState<MyBidsListItem[]>([]);

  const fetchMyBids = useCallback(async () => {
    setMyBidsLoading(true);
    try {
      const list = await bidWriterApi.listBids({ limit: 100, offset: 0 });
      const drafts: typeof list = [];
      const bids: typeof list = [];

      for (const item of list || []) {
        if (item.status === 'completed' || item.status === 'exported') {
          bids.push(item);
        } else {
          drafts.push(item);
        }
      }

      setDraftBids(drafts);
      setBidBids(bids);
    } catch (err: any) {
      Alert.alert('加载失败', err?.message || '无法获取标书列表');
    } finally {
      setMyBidsLoading(false);
    }
  }, []);

  const openMyBids = useCallback(() => {
    setMyBidsVisible(true);
    void fetchMyBids();
  }, [fetchMyBids]);

  const closeMyBids = useCallback(() => {
    setMyBidsVisible(false);
  }, []);

  const statusToStep = useCallback((s: string): BidWriterStep => {
    if (s === 'completed' || s === 'exported' || s === 'reviewing' || s === 'generating' || s === 'outline_confirmed') {
      return 3;
    }
    if (s === 'draft' || s === 'parsing') {
      return 1;
    }
    return 2;
  }, []);

  const handleSelectMyBid = useCallback((item: MyBidsListItem) => {
    closeMyBids();
    const targetStep = statusToStep(item.status);
    navigation.replace('BidWriter', { bidId: item.id, step: targetStep });
  }, [closeMyBids, navigation, statusToStep]);

  const handleCloseConfigModal = () => {
    modals.closeConfigModal();

    const model = AI_MODELS.find(m => m.id === selectedModel);
    void saveUserConfig({
      ...(model ? { model_provider: model.provider, model_code: model.code } : {}),
      default_word_count: wordCount,
      default_dark_bid_mode: darkBidMode,
      auto_web_image: autoWebImage,
      generate_flowchart: generateFlowchart,
      auto_proofread: autoProofread,
      default_cover_style: selectedCover,
      default_layout_style: selectedLayout,
      default_color_scheme: selectedColor,
    });
  };

  // 初始化加载配置和知识库
  useEffect(() => {
    loadUserConfig();
    refreshKnowledgeList();
  }, [loadUserConfig, refreshKnowledgeList]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      // 解析中或大纲生成中：二次确认弹窗
      const isParsing = step === 1 && status === 'parsing';
      const isOutlineGenerating = step === 2 && status === 'generating_outline';
      const isContentGenerating = step === 3 && status !== 'completed';
      if (isParsing || isOutlineGenerating) {
        e.preventDefault();
        const msg = isParsing
          ? '招标文件正在解析中，退出后将在后台继续。\n您可稍后回来查看结果。'
          : '大纲思路正在生成中，退出后将在后台继续。\n您可稍后回来查看结果。';
        Alert.alert('提示', msg, [
          { text: '继续等待', style: 'cancel' },
          { text: '回到首页', onPress: () => navigation.dispatch(e.data.action) },
        ]);
        return;
      }
      // 正文编写中：提示后台继续
      if (isContentGenerating) {
        e.preventDefault();
        Alert.alert(
          '标书编写中',
          '正文编写中，退出后将在后台继续生成。\n您可在通知栏查看进度，完成后可在「我的标书」或「牛马视窗 · 指尖标书」中查看。',
          [
            { text: '继续等待', style: 'cancel' },
            { text: '回到首页', onPress: () => navigation.dispatch(e.data.action) },
          ]
        );
        return;
      }
    });
    return unsub;
  }, [navigation, step, status]);

  // 根据步骤获取主按钮文字
  const getMainButtonText = () => {
    switch (step) {
      case 1:
        // 上传招标文件 -> 正在上传... -> 正在分析... -> 生成大纲思路
        if (uploading) return '正在上传...';
        if (!bidId) return '上传招标文件';
        if (analyzing || status === 'parsing') return '正在分析...';
        return '生成大纲思路';
      case 2:
        // 正在生成... -> 开始编写正文
        if (status === 'generating_outline') return '正在生成...';
        return '开始编写正文';
      case 3:
        if (status === 'completed') return '导出标书';
        // [审稿功能暂未开放] if (status === 'reviewing' || generationPhase === 'review') return '审稿检阅中...';
        if (generationPhase === 'image') return '自动配图中...';
        return '正在编写正文...';
      default:
        return '下一步';
    }
  };

  // 根据步骤获取主按钮禁用状态
  const getMainButtonDisabled = () => {
    switch (step) {
      case 1:
        // 上传中或解析中禁用
        return uploading || analyzing || status === 'parsing';
      case 2:
        return status === 'generating_outline'; // 生成大纲中禁用
      case 3:
        return status !== 'completed'; // 生成完成前禁用
      default:
        return false;
    }
  };

  // 根据步骤获取状态标签文字 - 与鸿蒙 getCurrentStepLabel 一致
  const getStatusText = () => {
    if (step === 1) {
      if (!bidId) return '准备';
      if (status === 'parsing') return '解析';
      return '准备';
    }
    if (step === 2) return '大纲';
    if (step === 3) {
      if (status === 'completed') return '完成';
      return '编写';
    }
    return undefined;
  };

  // 任何active步骤都闪烁（解析、生成大纲、编写正文）
  const isGenerating = (
    (step === 1 && status === 'parsing') ||
    (step === 2 && status === 'generating_outline') ||
    (step === 3 && status !== 'completed')
  );

  // 获取步骤状态列表 - 与鸿蒙 getStepStatus 一致
  const getSteps = (): { name: string; status: 'pending' | 'active' | 'done' }[] => {
    const getStepStatus = (name: string): 'pending' | 'active' | 'done' => {
      if (name === '准备') {
        if (!bidId) return 'active';
        return 'done';
      }
      if (name === '解析') {
        if (!bidId) return 'pending';
        if (status === 'parsing') return 'active';
        if (projectOverview) return 'done';
        return 'pending';
      }
      if (name === '大纲') {
        if (step < 2) return 'pending';
        if (status === 'generating_outline') return 'active';
        if (outline || step >= 3) return 'done';
        return 'active';
      }
      if (name === '编写') {
        if (step < 3) return 'pending';
        if (status === 'completed') return 'done';
        return 'active';
      }
      if (name === '完成') {
        if (status === 'completed') return 'done';
        return 'pending';
      }
      return 'pending';
    };
    return [
      { name: '准备', status: getStepStatus('准备') },
      { name: '解析', status: getStepStatus('解析') },
      { name: '大纲', status: getStepStatus('大纲') },
      { name: '编写', status: getStepStatus('编写') },
      { name: '完成', status: getStepStatus('完成') },
    ];
  };

  // 获取右侧操作按钮（Header 右侧）
  const getRightAction = () => {
    switch (step) {
      case 1:
        return undefined;
      case 2:
        return undefined;
      case 3:
        return undefined;
      default:
        return undefined;
    }
  };

  // 格式化字数显示
  const formatWordCount = (count: number) => {
    if (count >= 10000) {
      return `${(count / 10000).toFixed(0)}万字`;
    }
    return `${count}字`;
  };

  // 渲染内容区
  const renderContent = () => {
    switch (step) {
      case 1:
        return <UploadContent navigation={navigation} />;
      case 2:
        return <OutlineContent navigation={navigation} />;
      case 3:
        return <GenerationContent navigation={navigation} viewMode={viewMode} onToggleViewMode={() => setViewMode(prev => prev === 'directory' ? 'content' : 'directory')} onOpenKnowledgeModal={modals.openKnowledgeModal} />;
      default:
        return null;
    }
  };

  // 全局加载状态
  if (loading) {
    const { background, loadingColor, dotMatrixEnabled } = themeConfig;

    // 渲染背景容器
    const renderBackground = (children: React.ReactNode) => {
      if (background.type === BackgroundType.GRADIENT) {
        return (
          <LinearGradient colors={background.colors!} style={styles.container}>
            {children}
          </LinearGradient>
        );
      }

      if (background.type === BackgroundType.DOT_MATRIX) {
        return (
          <View style={[styles.container, { backgroundColor: background.color }]}>
            {dotMatrixEnabled && <DotMatrixBackground />}
            {children}
          </View>
        );
      }

      return <View style={styles.container}>{children}</View>;
    };

    return renderBackground(
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <Loading size="large" color={loadingColor} />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  // 渲染背景容器
  const renderBackground = (children: React.ReactNode) => {
    const { background, dotMatrixEnabled } = themeConfig;

    if (background.type === BackgroundType.GRADIENT) {
      return (
        <LinearGradient colors={background.colors!} style={styles.container}>
          {children}
        </LinearGradient>
      );
    }

    if (background.type === BackgroundType.DOT_MATRIX) {
      return (
        <View style={[styles.container, { backgroundColor: background.color }]}>
          {dotMatrixEnabled && <DotMatrixBackground />}
          {children}
        </View>
      );
    }

    return <View style={styles.container}>{children}</View>;
  };

  return renderBackground(
    <>
      {/* 顶部标题栏 */}
      <BidWriterHeader
        navigation={navigation}
        projectName={projectOverview?.project_name}
        selectedModel={selectedModel}
        wordCount={wordCount}
        darkBidMode={darkBidMode}
        hasKnowledgeFiles={selectedKnowledgeFilePaths.length > 0}
        status={bidId ? 'active' : undefined}
        statusText={getStatusText()}
        isGenerating={isGenerating}
        steps={getSteps()}
        onModelPress={modals.openModelModal}
        onConfigPress={modals.openConfigModal}
        onKnowledgePress={modals.openKnowledgeModal}
        onMyBidsPress={openMyBids}
        rightAction={getRightAction()}
      />

      {/* 内容区 */}
      <View style={styles.contentArea}>
        {renderContent()}
      </View>

      {/* 底部按钮组 */}
      <BidWriterFooter
        mainButtonText={getMainButtonText()}
        onMainButtonPress={() => {
          // 优先调用内容组件注册的回调
          if (mainButtonAction) {
            mainButtonAction();
            return;
          }
          // 默认行为
          switch (step) {
            case 1:
              if (bidId && (status === 'parsed' || status === 'outline_editing')) {
                setStep(2);
              }
              break;
            case 3:
              if (status === 'completed') {
                // 导出逻辑由 GenerationContent 的 mainButtonAction 处理
              }
              break;
          }
        }}
        mainButtonDisabled={getMainButtonDisabled()}
        onModelPress={modals.openModelModal}
        onStylePress={modals.openStyleModal}
        onConfigPress={modals.openConfigModal}
        onKnowledgePress={modals.openKnowledgeModal}
      />
      <AIContentDisclaimer style={{ marginBottom: insets.bottom + 4 }} />

      {/* ==================== 共享 Modals ==================== */}

      {/* 模型选择弹窗 */}
      <ModelSelectModal
        visible={modals.modelModalVisible}
        onClose={modals.closeModelModal}
        models={AI_MODELS}
        selectedModel={selectedModel}
        onSelect={(model) => {
          setSelectedModel(model.id);
          modals.closeModelModal();
        }}
      />

      {/* 样式选择弹窗 */}
      <StyleSelectModal
        visible={modals.styleModalVisible}
        onClose={modals.closeStyleModal}
        coverOptions={COVER_OPTIONS}
        layoutOptions={LAYOUT_OPTIONS}
        colorOptions={COLOR_OPTIONS}
        selectedCover={selectedCover}
        selectedLayout={selectedLayout}
        selectedColor={selectedColor}
        onSelectCover={setSelectedCover}
        onSelectLayout={setSelectedLayout}
        onSelectColor={setSelectedColor}
      />

      {/* 配置弹窗 */}
      <ConfigModal
        visible={modals.configModalVisible}
        onClose={handleCloseConfigModal}
        wordCount={wordCount}
        onWordCountChange={setWordCount}
        autoWebImage={autoWebImage}
        onAutoWebImageChange={setAutoWebImage}
        generateFlowchart={generateFlowchart}
        onGenerateFlowchartChange={setGenerateFlowchart}
        autoProofread={autoProofread}
        onAutoProofreadChange={setAutoProofread}
        darkBidMode={darkBidMode}
        onDarkBidModeChange={setDarkBidMode}
        formatWordCount={formatWordCount}
      />

      {/* 知识库弹窗 */}
      <KnowledgeModal
        visible={modals.knowledgeModalVisible}
        onClose={modals.closeKnowledgeModal}
        docFiles={modals.docFiles}
        imageFiles={modals.imageFiles}
        tableFiles={modals.tableFiles}
        otherFiles={modals.otherFiles}
        onSelectType={(type) => {
          modals.openKnowledgeUploadModal(type);
        }}
      />

      {/* 知识库上传弹窗 */}
      <KnowledgeUploadModal
        visible={modals.knowledgeUploadModalVisible}
        onClose={modals.closeKnowledgeUploadModal}
        uploadType={modals.knowledgeUploadType}
        docFiles={modals.docFiles}
        imageFiles={modals.imageFiles}
        tableFiles={modals.tableFiles}
        otherFiles={modals.otherFiles}
        onUpload={modals.handleKnowledgeUpload}
        uploading={modals.knowledgeUploading}
        selectedFiles={modals.getSelectedFileNames(modals.knowledgeUploadType)}
        onToggleFile={modals.handleToggleFileByName}
        onConfirm={modals.closeKnowledgeUploadModal}
        onDeleteFile={modals.handleDeleteKnowledge}
        onRenameFile={modals.handleRenameKnowledge}
      />

      <MyBidsSidebar
        visible={myBidsVisible}
        loading={myBidsLoading}
        draftBids={draftBids}
        bidBids={bidBids}
        onClose={closeMyBids}
        onSelect={handleSelectMyBid}
      />
    </>
  );
};

// ==================== 主组件（包装 Provider）====================

const BidWriterContainer: FC<Props> = ({ navigation, route }) => {
  const { bidId, step } = route.params || {};
  const guard = useAIToolGuard('bid_writer');
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    console.log('[BidWriter] 检查权限...');
    guard().then((result) => {
      console.log('[BidWriter] 权限检查结果:', result);
      setAllowed(result);
    }).catch((err) => {
      console.error('[BidWriter] 权限检查失败:', err);
      setAllowed(false);
    });
  }, []); // 只在组件挂载时运行

  if (allowed === null) return <Loading />;
  if (!allowed) return null;

  return (
    <BidWriterProvider
      initialBidId={bidId}
      initialStep={(step as BidWriterStep) || 1}
    >
      <BidWriterInner navigation={navigation} />
    </BidWriterProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  contentArea: {
    flex: 1,
  },
});

export default BidWriterContainer;
