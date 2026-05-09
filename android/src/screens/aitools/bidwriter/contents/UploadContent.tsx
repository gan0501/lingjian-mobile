/**
 * Step 1: 上传/解析内容区
 * 负责文件上传、解析状态显示、流式内容展示
 */
import React, { FC, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  useWindowDimensions,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import SimpleMarkdown from '@/components/common/SimpleMarkdown';
import { Upload, FileText, RefreshCw, FileUp, Edit3 } from 'lucide-react-native';
import DocumentPicker from 'react-native-document-picker';
import { bidWriterApi } from '@/services/bidWriter';
import { useBidWriterContext } from '../BidWriterContext';
import { useBidWriterWebSocket } from '../useBidWriterWebSocket';
import { useAuthStore } from '@/stores';
import type { RootStackScreenProps } from '@/navigation/types';

type Props = {
  navigation: RootStackScreenProps<'BidWriter'>['navigation'];
};

const UploadContent: FC<Props> = ({ navigation }) => {
  const { width: contentWidth, height: windowHeight } = useWindowDimensions();
  const { user } = useAuthStore();

  const {
    bidId,
    setBidId,
    status,
    setStatus,
    uploading,
    setUploading,
    analyzing,
    setAnalyzing,
    projectOverview,
    setProjectOverview,
    scoringCriteria,
    setScoringCriteria,
    setStep,
    connectWebSocket,
    setMainButtonAction,
  } = useBidWriterContext();

  // 文件上传状态
  const [fileUploaded, setFileUploaded] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parseMessage, setParseMessage] = useState('');

  // 活性检测：记录最后一次收到后端事件的时间（用于替代硬编码超时）
  const lastActivityRef = useRef(Date.now());

  // 流式输出状态
  const [streamingContent, setStreamingContent] = useState('');
  const streamingScrollRef = useRef<ScrollView>(null);

  // 动画相关
  const REVEAL_DURATION_MS = 1200;
  const parseCardRevealAnim = useRef(new Animated.Value(0)).current;

  const parseCardTargetHeight = useMemo(() => {
    // 顶部header+padding约130px，底部距离70px
    const estimated = windowHeight - 130 - 70;
    return Math.max(300, estimated);
  }, [windowHeight]);

  const parseCardMaxHeight = useMemo(
    () =>
      parseCardRevealAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, parseCardTargetHeight],
      }),
    [parseCardRevealAnim, parseCardTargetHeight]
  );

  const parseCardOpacity = useMemo(
    () =>
      parseCardRevealAnim.interpolate({
        inputRange: [0, 0.15, 1],
        outputRange: [0.85, 1, 1],
      }),
    [parseCardRevealAnim]
  );

  // (流式延迟已移除，内容即时显示)

  // 容器可见性跟踪（只在首次变为可见时触发动画）
  const containerVisibleRef = useRef(false);
  const containerVisible = uploading || analyzing || fileUploaded;

  // 动画触发：只在容器首次变为可见时触发一次
  useEffect(() => {
    if (containerVisible && !containerVisibleRef.current) {
      // 首次变为可见，启动动画
      containerVisibleRef.current = true;
      parseCardRevealAnim.stopAnimation();
      parseCardRevealAnim.setValue(0);
      Animated.timing(parseCardRevealAnim, {
        toValue: 1,
        duration: REVEAL_DURATION_MS,
        useNativeDriver: false,
      }).start();
    } else if (!containerVisible && containerVisibleRef.current) {
      // 变为不可见，重置标记（下次上传时可以重新触发动画）
      containerVisibleRef.current = false;
      parseCardRevealAnim.setValue(0);
    }
  }, [containerVisible, parseCardRevealAnim]);

  // (打字机效果已移除，LLM 流式内容即时渲染)

  // WebSocket 事件处理
  useBidWriterWebSocket({
    onParseProgress: (data) => {
      lastActivityRef.current = Date.now(); // 刷新活性
      setParseMessage(data.message || '正在解析中...');
    },
    onStreamChunk: (data) => {
      lastActivityRef.current = Date.now(); // 刷新活性
      if (data.stream_type === 'overview') {
        const content = data.full_content || '';
        setStreamingContent(content);
      }
    },
    onParseComplete: (data) => {
      lastActivityRef.current = Date.now(); // 刷新活性
      setAnalyzing(false);
      setFileUploaded(true);
    },
    onConnected: (data) => {
      lastActivityRef.current = Date.now(); // 刷新活性
      if (data.status === 'parsed' || data.status === 'outline_editing') {
        bidWriterApi.getOverview(bidId!).then(overviewRes => {
          setAnalyzing(false);
          setFileUploaded(true);
          setStatus(data.status);
          if (overviewRes.project_overview) {
            setProjectOverview(overviewRes.project_overview);
          }
          if (overviewRes.scoring_criteria) {
            setScoringCriteria(overviewRes.scoring_criteria);
          }
        });
      } else if (data.status === 'draft') {
        setAnalyzing(false);
        Alert.alert('解析失败', '文件解析失败，请重新上传');
      }
    },
  });

  // 分析开始时重置流式内容 + 活性检测
  useEffect(() => {
    if (!bidId || !analyzing) return;

    setStreamingContent('');

    // 活性检测超时：每15秒检查一次, 如果90秒内没有收到任何后端事件才判定超时
    lastActivityRef.current = Date.now();
    const IDLE_TIMEOUT_MS = 90000;  // 90秒空闲阈值
    const CHECK_INTERVAL_MS = 15000; // 15秒检查一次
    const idleCheckId = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs > IDLE_TIMEOUT_MS) {
        setAnalyzing(false);
        Alert.alert('解析超时', '已超过90秒未收到解析进度，请检查网络后重试');
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      clearInterval(idleCheckId);
    };
  }, [bidId, analyzing]);

  // 上传文件
  const handleUpload = useCallback(async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.docx, DocumentPicker.types.doc],
      });

      if (result && result[0]) {
        const file = result[0];
        setStreamingContent('');
        setProjectOverview(null);
        setScoringCriteria(null);
        setFileUploaded(false);
        setParseMessage('');
        setUploading(true);
        setFileName(file.name || '未知文件');

        try {
          await new Promise(resolve => setTimeout(resolve, 100));

          const response = await bidWriterApi.uploadFile(
            {
              uri: file.uri,
              name: file.name || 'document',
              type: file.type || 'application/pdf',
            },
            user?.id ?? 0
          );

          setUploading(false);
          setAnalyzing(true);
          setBidId(response.bid_id);
          setStatus('parsing');
          setParseMessage('正在解析招标文件...');

          // 连接 WebSocket
          await connectWebSocket(response.bid_id);

        } catch (uploadErr: any) {
          setUploading(false);
          Alert.alert('上传失败', uploadErr.message || '文件上传失败，请重试');
        }
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        console.error('文件选择错误:', err);
      }
    }
  }, [user?.id, setBidId, setStatus, setProjectOverview, setScoringCriteria, connectWebSocket]);

  // 生成大纲
  const handleGenerateOutline = useCallback(() => {
    if (!bidId) {
      Alert.alert('提示', '请先上传招标文件');
      return;
    }
    setStep(2);
  }, [bidId, setStep]);

  // ==================== 上传标书目录 ====================
  const [outlineUploading, setOutlineUploading] = useState(false);
  const handleUploadOutlineFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.docx, DocumentPicker.types.doc, DocumentPicker.types.plainText],
      });
      if (result && result[0]) {
        const file = result[0];
        setOutlineUploading(true);
        try {
          const response = await bidWriterApi.createFromOutline(user?.id ?? 0, {
            file: { uri: file.uri, name: file.name || 'outline', type: file.type || 'application/pdf' },
          });
          setBidId(response.bid_id);
          setStatus('parsing');
          await connectWebSocket(response.bid_id);
          setStep(2);
        } catch (err: any) {
          Alert.alert('上传失败', err.message || '目录文件上传失败，请重试');
        } finally {
          setOutlineUploading(false);
        }
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        console.error('目录文件选择错误:', err);
      }
    }
  }, [user?.id, setBidId, setStatus, connectWebSocket, setStep]);

  // ==================== 手动编辑目录 ====================
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualOutlineText, setManualOutlineText] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const handleManualSubmit = useCallback(async () => {
    if (!manualOutlineText.trim()) {
      Alert.alert('提示', '请输入大纲/目录内容');
      return;
    }
    setManualSubmitting(true);
    try {
      const response = await bidWriterApi.createFromOutline(user?.id ?? 0, {
        outlineText: manualOutlineText.trim(),
      });
      setBidId(response.bid_id);
      setStatus('parsing');
      await connectWebSocket(response.bid_id);
      setManualModalVisible(false);
      setManualOutlineText('');
      setStep(2);
    } catch (err: any) {
      Alert.alert('提交失败', err.message || '大纲提交失败，请重试');
    } finally {
      setManualSubmitting(false);
    }
  }, [manualOutlineText, user?.id, setBidId, setStatus, connectWebSocket, setStep]);

  // 注册主按钮回调
  useEffect(() => {
    if (!bidId) {
      // 未上传时，主按钮触发上传
      setMainButtonAction(() => handleUpload);
    } else if (status === 'parsed' || status === 'outline_editing') {
      // 解析完成后，主按钮触发生成大纲
      setMainButtonAction(() => handleGenerateOutline);
    } else {
      // 解析中，不设置回调（按钮禁用）
      setMainButtonAction(null);
    }
    return () => setMainButtonAction(null);
  }, [bidId, status, setMainButtonAction, handleUpload, handleGenerateOutline]);


  return (
    <View style={styles.container}>
      {/* 上传区域 */}
      {!containerVisible && (
        <TouchableOpacity style={styles.uploadArea} onPress={handleUpload}>
          <View style={styles.uploadIcon}>
            <Upload size={48} color="#B20000" />
          </View>
          <Text style={styles.uploadTitle}>上传招标文件</Text>
          <Text style={styles.uploadHint}>支持 PDF、Word 格式</Text>
        </TouchableOpacity>
      )}

      {/* 两个入口框 - 上传目录 / 手动编辑 */}
      {!containerVisible && (
        <View style={styles.entryRow}>
          <TouchableOpacity
            style={styles.entryBox}
            onPress={handleUploadOutlineFile}
            disabled={outlineUploading}
          >
            {outlineUploading ? (
              <ActivityIndicator size="small" color="#B20000" />
            ) : (
              <View style={styles.entryIcon}>
                <FileUp size={24} color="#4A6CF7" />
              </View>
            )}
            <Text style={styles.entryTitle}>上传标书目录</Text>
            <Text style={styles.entryDesc}>适合你已有标书大纲/目录</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.entryBox}
            onPress={() => setManualModalVisible(true)}
          >
            <View style={styles.entryIcon}>
              <Edit3 size={24} color="#16A34A" />
            </View>
            <Text style={styles.entryTitle}>手动编辑目录</Text>
            <Text style={styles.entryDesc}>适合你想自行输入文字来编辑大纲/目录</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 手动编辑目录弹窗 */}
      <Modal visible={manualModalVisible} transparent animationType="none" onRequestClose={() => setManualModalVisible(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView style={styles.manualModalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.manualModal}>
              <View style={styles.manualModalHeader}>
                <Text style={styles.manualModalTitle}>手动编辑目录</Text>
                <TouchableOpacity onPress={() => { setManualModalVisible(false); setManualOutlineText(''); }}>
                  <Text style={{ fontSize: 20, color: '#666' }}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.manualModalHint}>请输入你的标书大纲/目录内容，AI将为你整理为标准大纲结构</Text>
              <TextInput
                style={styles.manualTextInput}
                multiline
                placeholder={'例如：\n第一章 项目概述\n  1.1 项目背景\n  1.2 项目目标\n第二章 技术方案\n  2.1 系统架构\n  2.2 功能设计'}
                placeholderTextColor="#bbb"
                value={manualOutlineText}
                onChangeText={setManualOutlineText}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.manualSubmitBtn, (!manualOutlineText.trim() || manualSubmitting) && styles.manualSubmitBtnDisabled]}
                onPress={handleManualSubmit}
                disabled={!manualOutlineText.trim() || manualSubmitting}
              >
                {manualSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.manualSubmitText}>开始生成大纲</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 解析卡片 - 固定位置 */}
      {containerVisible && (
        <Animated.View
          style={[
            styles.parseCard,
            {
              height: parseCardMaxHeight,
              opacity: parseCardOpacity,
            },
          ]}
        >
          {/* 文件信息 */}
          <View style={styles.fileInfo}>
            <FileText size={22} color="rgba(255,255,255,0.9)" />
            <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
            {(uploading || analyzing) ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
            ) : fileUploaded && projectOverview ? (
              <TouchableOpacity style={styles.reuploadButton} onPress={handleUpload}>
                <RefreshCw size={14} color="#fff" />
                <Text style={styles.reuploadText}>重新上传</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* 解析状态 */}
          {(uploading || analyzing) && (
            <View style={styles.parseStatus}>
              <Text style={styles.parseMessage}>
                {uploading ? '正在上传...' : parseMessage}
              </Text>
            </View>
          )}

          {/* 流式内容 - 内部可滚动 */}
          <ScrollView
            ref={streamingScrollRef}
            style={styles.streamingContainer}
            contentContainerStyle={styles.streamingContent}
            showsVerticalScrollIndicator={true}
            onContentSizeChange={() => {
              if (analyzing) {
                streamingScrollRef.current?.scrollToEnd({ animated: true });
              }
            }}
          >
            {streamingContent ? (
              <SimpleMarkdown
                content={streamingContent}
                textColor="#333"
                fontSize={13}
              />
            ) : (
              <View style={styles.emptyContent} />
            )}
          </ScrollView>
        </Animated.View>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  uploadArea: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed',
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  uploadHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  parseCard: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginLeft: 12,
  },
  parseStatus: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  parseMessage: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  streamingContainer: {
    flex: 1,
    margin: 12,
    marginTop: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
  },
  streamingContent: {
    padding: 16,
    paddingBottom: 20,
  },
  emptyContent: {
    height: 100,
  },
  reuploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  reuploadText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
    marginLeft: 4,
  },
  entryRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  entryBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 16,
    alignItems: 'center',
  },
  entryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  entryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
  },
  entryDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 16,
  },
  manualModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  manualModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    padding: 20,
  },
  manualModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  manualModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  manualModalHint: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
  },
  manualTextInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    color: '#333',
    minHeight: 200,
    maxHeight: 300,
    lineHeight: 22,
  },
  manualSubmitBtn: {
    backgroundColor: '#B20000',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  manualSubmitBtnDisabled: {
    backgroundColor: '#ccc',
  },
  manualSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default UploadContent;
