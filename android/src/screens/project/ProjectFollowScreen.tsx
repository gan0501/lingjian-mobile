/**
 * ProjectFollowScreen V2 - 项目跟进详情页
 *
 * 白底日间主题 + 底部胶囊Tab切换 + 统一输入栏
 * 4个Tab: 对话(Chat) / 跟进(Followup) / 笔记(Note) / 总结(Summary)
 *
 * 核心联动：
 *   - Chat中AI可自动触发跟进/笔记刷新
 *   - 输入栏根据activeTab分发不同处理函数
 *   - Summary Tab底部显示取消跟进按钮
 *   - 顶部更多按钮：历史分析、生成周报、取消跟进
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  Animated,
  StatusBar,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  MessageCircle,
  ClipboardList,
  StickyNote,
  BarChart3,
  MoreVertical,
  X as XIcon,
  FileText,
  Calendar,
  Search,
  Sparkles,
  Clock,
  ChevronRight,
} from 'lucide-react-native';
import { DayColors } from '@/constants';
import { projectAgentApi, projectApi, type ConversationPair } from '@/services';
import { useOverlay } from '@/components/overlay';
import { BottomSearchBar } from '@/components/common';
import { useFollowedProjectStore, useAgentTaskStore } from '@/stores';
import ChatTab from './components/ChatTab';
import FollowupTab from './components/FollowupTab';
import NoteTab from './components/NoteTab';
import SummaryTab from './components/SummaryTab';
import RecordFeedbackToast from './components/RecordFeedbackToast';

// ─── 类型 ───

type AgentTabType = 'chat' | 'followup' | 'note' | 'summary';

interface TabConfig {
  key: AgentTabType;
  label: string;
  icon: React.ElementType;
}

const TABS: TabConfig[] = [
  { key: 'chat', label: '对话', icon: MessageCircle },
  { key: 'followup', label: '跟进', icon: ClipboardList },
  { key: 'note', label: '笔记', icon: StickyNote },
  { key: 'summary', label: '总结', icon: BarChart3 },
];

// ─── 项目类型映射 ───

const PROJECT_TYPE_NAMES: Record<number, string> = {
  1: '规划工程', 2: '土地拍卖', 3: '招标信息', 4: '采购公告', 5: '自建项目',
};

const PROJECT_COLORS: Record<number, string> = {
  1: '#FF6B6B', 2: '#4ECDC4', 3: '#45B7D1', 4: '#96CEB4', 5: '#9C27B0',
};

// ─── Props ───

interface ProjectFollowScreenProps {
  route: {
    params: {
      projectId: string;
      projectName: string;
      projectType: number;
    };
  };
}

// ─── 主组件 ───

const ProjectFollowScreen: React.FC<ProjectFollowScreenProps> = ({ route }) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const overlay = useOverlay();
  const { projectId, projectName, projectType, initialTab } = route.params;
  const { removeProject } = useFollowedProjectStore();

  // ─── 核心状态 ───
  const [activeTab, setActiveTab] = useState<AgentTabType>(initialTab || 'chat');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recordFeedback, setRecordFeedback] = useState<any>(null);

  // ─── 各 Tab 独立的输入消息 ───
  const [chatMessage, setChatMessage] = useState('');
  const [followupMessage, setFollowupMessage] = useState('');
  const [noteMessage, setNoteMessage] = useState('');

  // ─── 数据状态 ───
  const [conversationHistory, setConversationHistory] = useState<ConversationPair[]>([]);
  const [initialData, setInitialData] = useState<any>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  // ─── 历史分析弹窗状态 ───
  const [historySheetVisible, setHistorySheetVisible] = useState(false);
  const [analysisList, setAnalysisList] = useState<any[]>([]);
  const [analysisListLoading, setAnalysisListLoading] = useState(false);

  // ─── 子Tab回调 ref ───
  const noteRefreshRef = useRef<(() => void) | null>(null);
  const followupRefreshRef = useRef<(() => void) | null>(null);
  const summaryRefreshRef = useRef<(() => void) | null>(null);
  const graphIncrementRef = useRef<((data: any) => void) | null>(null);

  // ─── Tab 切换动画 ───
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const historySheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (historySheetVisible) {
      historySheetAnim.setValue(0);
      Animated.spring(historySheetAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 9,
      }).start();
    }
  }, [historySheetVisible]);

  const animateTabSwitch = useCallback((index: number) => {
    Animated.spring(tabIndicatorAnim, {
      toValue: index,
      useNativeDriver: true,
      tension: 300,
      friction: 25,
    }).start();
  }, [tabIndicatorAnim]);

  const handleTabChange = useCallback((tab: AgentTabType) => {
    const index = TABS.findIndex(t => t.key === tab);
    setActiveTab(tab);
    animateTabSwitch(index);
    Keyboard.dismiss();
  }, [animateTabSwitch]);

  // ─── 初始加载 ───

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // 并行加载历史记录和摘要
      const [historyRes, summaryRes] = await Promise.all([
        projectAgentApi.getConversationHistory(projectId),
        projectAgentApi.checkAndGenerateSummary({
          project_id: projectId,
          project_type: projectType,
          project_name: projectName,
        }),
      ]);
      
      // 批量更新状态，避免多次渲染
      const historyData = historyRes?.data || [];
      const summaryData = summaryRes?.data || null;
      
      setConversationHistory(historyData);
      setInitialData(summaryData);
      setLoading(false);
    } catch (err) {
      console.warn('[ProjectFollow] 加载失败:', err);
      setLoading(false);
    }
  };

  // ─── Chat 发送消息 ───

  const handleSendChatMessage = useCallback(async () => {
    const trimmed = chatMessage.trim();
    if (!trimmed || sending) return;

    const tempId = `temp_${Date.now()}`;
    const userMsg: ConversationPair = {
      id: tempId,
      user_message_id: `user_${Date.now()}`,
      user_message: trimmed,
      assistant_message_id: '',
      assistant_message: '',
      timestamp: new Date().toISOString(),
    };

    setConversationHistory(prev => [...prev, userMsg]);
    setChatMessage('');
    setSending(true);
    setIsAiThinking(true);

    const history = conversationHistory.map(pair => ([
      { role: 'user', content: pair.user_message },
      { role: 'assistant', content: pair.assistant_message },
    ])).flat().filter(m => m.content);

    try {
      await projectAgentApi.processUserInputStream(
        {
          message: trimmed,
          project_id: projectId,
          project_type: projectType,
          conversation_history: history,
        },
        {
          onStart: (ids) => {
            // 收到start事件，更新消息ID
            setIsAiThinking(false); // 开始接收内容，关闭思考动画
            setConversationHistory(prev =>
              prev.map(p => p.id === tempId
                ? { ...p, user_message_id: ids.user_message_id, assistant_message_id: ids.assistant_message_id }
                : p
              ),
            );
          },
          onDelta: (delta) => {
            // 每个delta逐字追加 — 天然打字机效果
            setConversationHistory(prev =>
              prev.map(p => p.id === tempId
                ? { ...p, assistant_message: p.assistant_message + delta }
                : p
              ),
            );
          },
          onDone: (result) => {
            setConversationHistory(prev =>
              prev.map(p => p.id === tempId
                ? {
                    ...p,
                    assistant_message: result.content,
                    assistant_message_id: result.assistant_message_id,
                  }
                : p
              ),
            );
            const anyAgentTriggered = (result as any).agent_b_triggered || (result as any).agent_c_triggered;
            if (anyAgentTriggered) {
              if ((result as any).agent_b_triggered) followupRefreshRef.current?.();
              if ((result as any).agent_c_triggered) noteRefreshRef.current?.();
            } else {
              setTimeout(() => {
                followupRefreshRef.current?.();
                noteRefreshRef.current?.();
              }, 1500);
            }
            setTimeout(() => {
              summaryRefreshRef.current?.();
            }, 2000);
          },
          onError: (error) => {
            if (error.startsWith('TOKEN_REFRESHED')) {
              setConversationHistory(prev => prev.filter(p => p.id !== tempId));
              setSending(false);
              setIsAiThinking(false);
              setTimeout(() => handleSendChatMessage(), 500);
              return;
            }
            if (error.startsWith('AUTH_EXPIRED')) {
              overlay.confirm({
                title: '登录已过期',
                message: '请重新登录后继续使用',
                confirmText: '去登录',
                onConfirm: () => navigation.navigate('Login' as any),
              });
            } else {
              overlay.toast.error('发送失败，请稍后重试');
            }
            setConversationHistory(prev => prev.filter(p => p.id !== tempId));
          },
          onGraphIncrement: (data) => {
            graphIncrementRef.current?.(data);
          },
          onMilestoneCreated: (data) => {
            console.log('[SSE] 里程碑增量:', data);
          },
          onFollowupCreated: (data) => {
            console.log('[SSE] 跟进已创建:', data);
            followupRefreshRef.current?.();
          },
          onNoteCreated: (data) => {
            console.log('[SSE] 笔记已创建:', data);
            noteRefreshRef.current?.();
          },
          onRecordFeedback: (data) => {
            console.log('[SSE] 记录反馈:', data);
            setRecordFeedback(data.data || data);
          },
        },
      );
    } catch (err: any) {
      overlay.toast.error('网络异常，请检查网络后重试');
      setConversationHistory(prev => prev.filter(p => p.id !== tempId));
    } finally {
      setSending(false);
      setIsAiThinking(false);
    }
  }, [chatMessage, sending, conversationHistory, projectId, projectType]);

  // ─── 记录撤回 ───

  const handleRevokeRecord = useCallback(async (recordType: string, recordId: string) => {
    try {
      if (recordType === 'followup') {
        await projectAgentApi.deleteFollowup({ followup_id: recordId, project_id: projectId });
        followupRefreshRef.current?.();
      } else if (recordType === 'note') {
        await projectAgentApi.deleteNote({ note_id: recordId, project_id: projectId });
        noteRefreshRef.current?.();
      }
      overlay.toast.success('已撤回');
    } catch {
      overlay.toast.error('撤回失败，请到对应模块手动删除');
    }
  }, [projectId]);

  // ─── Followup 提交 ───

  const handleSubmitFollowup = useCallback(async () => {
    const trimmed = followupMessage.trim();
    if (!trimmed || sending) return;

    setFollowupMessage('');
    setSending(true);

    try {
      await projectAgentApi.createFollowup({
        project_id: projectId,
        content: trimmed,
        title: '用户手动添加',
        source: '用户输入',
        status: 'confirmed',
      });
      overlay.toast.success('跟进记录已添加');
      followupRefreshRef.current?.();
    } catch (err: any) {
      overlay.toast.error(err?.message || '提交跟进失败');
    } finally {
      setSending(false);
    }
  }, [followupMessage, sending, projectId]);

  // ─── Note 提交 ───

  const handleSubmitNote = useCallback(async () => {
    const trimmed = noteMessage.trim();
    if (!trimmed || sending) return;

    setNoteMessage('');
    setSending(true);

    try {
      await projectAgentApi.createNote({
        project_id: projectId,
        content: trimmed,
        title: '用户手动添加',
      });
      overlay.toast.success('笔记已添加');
      noteRefreshRef.current?.();
    } catch (err: any) {
      overlay.toast.error(err?.message || '提交笔记失败');
    } finally {
      setSending(false);
    }
  }, [noteMessage, sending, projectId]);

  // ─── 取消跟进 ───

  const handleCancelFollow = useCallback(() => {
    overlay.confirm({
      title: '取消跟进',
      message: '确定要取消跟进此项目吗？此操作将删除该项目的所有跟进内容，且无法恢复。',
      confirmText: '确定取消',
      cancelText: '暂不取消',
      onConfirm: async () => {
        try {
          await projectApi.unfollow(projectId);
          removeProject(projectId);
          overlay.toast.success('已取消跟进');
          navigation.goBack();
        } catch (err: any) {
          overlay.toast.error(err?.message || '取消跟进失败');
        }
      },
    });
  }, [projectId, removeProject]);

  // ─── AI全量分析 ───
  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    try {
      useAgentTaskStore.getState().markWorking('project_analysis', '项目全量分析中...');
      
      const res = await projectAgentApi.triggerFullAnalysis({ project_id: projectId });
      
      if (res?.success) {
        overlay.toast.success('全量分析已启动，请关注牛马视窗进度');
        setTimeout(() => {
          summaryRefreshRef.current?.();
        }, 1000);
      } else {
        overlay.toast.info(res?.message || '分析任务已在执行中');
        useAgentTaskStore.getState().markIdle('project_analysis');
      }
    } catch (err) {
      overlay.toast.error('分析触发失败');
      useAgentTaskStore.getState().markIdle('project_analysis');
    } finally {
      setAnalyzing(false);
    }
  }, [projectId, overlay]);

  // ─── 更多操作 ───

  const handleMoreActions = useCallback(() => {
    overlay.sheet.show({
      title: '更多操作',
      children: (
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <TouchableOpacity
              style={moreStyles.actionBtn}
              onPress={async () => {
                overlay.sheet.hide();
                try {
                  overlay.toast.info('正在生成周报...');
                  const res = await projectAgentApi.sendWeeklyReport(projectId);
                  if (res?.success) {
                    overlay.toast.success(res.message || '周报已生成');
                    const historyRes = await projectAgentApi.getConversationHistory(projectId);
                    if (historyRes?.data) {
                      setConversationHistory(historyRes.data);
                    }
                  } else {
                    overlay.toast.info(res?.message || '本周暂无活动');
                  }
                } catch (err: any) {
                  overlay.toast.error(err?.message || '生成周报失败');
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={moreStyles.actionBtnText}>📊 生成周报</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={moreStyles.actionBtn}
              onPress={async () => {
                overlay.sheet.hide();
                try {
                  overlay.toast.info('正在生成月报...');
                  const res = await projectAgentApi.sendMonthlyReport?.(projectId);
                  if (res?.success) {
                    overlay.toast.success(res.message || '月报已生成');
                  } else {
                    overlay.toast.info(res?.message || '本月暂无活动');
                  }
                } catch (err: any) {
                  overlay.toast.error(err?.message || '生成月报失败');
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={moreStyles.actionBtnText}>📈 生成月报</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={moreStyles.actionBtn}
              onPress={async () => {
                overlay.sheet.hide();
                try {
                  overlay.toast.info('正在生成季报...');
                  const res = await projectAgentApi.sendQuarterlyReport?.(projectId);
                  if (res?.success) {
                    overlay.toast.success(res.message || '季报已生成');
                  } else {
                    overlay.toast.info(res?.message || '本季暂无活动');
                  }
                } catch (err: any) {
                  overlay.toast.error(err?.message || '生成季报失败');
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={moreStyles.actionBtnText}>📋 生成季报</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={moreStyles.actionBtn}
              onPress={() => {
                overlay.sheet.hide();
                loadAndShowHistoryAnalysis();
              }}
              activeOpacity={0.7}
            >
              <Text style={moreStyles.actionBtnText}>历史分析</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={moreStyles.actionBtn}
              onPress={() => {
                overlay.sheet.hide();
                overlay.toast.info('Token消耗统计开发中...');
              }}
              activeOpacity={0.7}
            >
              <Text style={moreStyles.actionBtnText}>💰 Token消耗</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[moreStyles.actionBtn, moreStyles.actionBtnDanger]}
              onPress={() => {
                overlay.sheet.hide();
                handleCancelFollow();
              }}
              activeOpacity={0.7}
            >
              <Text style={moreStyles.actionBtnDangerText}>取消跟进</Text>
            </TouchableOpacity>
          </View>
        </View>
      ),
    });
  }, [handleCancelFollow, projectId, overlay, loadAndShowHistoryAnalysis]);

  // ─── 历史分析 ───

  const loadAndShowHistoryAnalysis = useCallback(async () => {
    setAnalysisListLoading(true);
    setHistorySheetVisible(true);
    try {
      const res = await projectAgentApi.listFullAnalysisReports(projectId);
      if (res?.success && Array.isArray(res.data)) {
        setAnalysisList(res.data);
      } else {
        setAnalysisList([]);
      }
    } catch (err: any) {
      overlay.toast.error('加载分析列表失败');
      setAnalysisList([]);
    } finally {
      setAnalysisListLoading(false);
    }
  }, [projectId, overlay]);

  const handleViewAnalysisDetail = useCallback((reportId: string) => {
    setHistorySheetVisible(false);
    (navigation as any).navigate('ProjectAnalysisReport', {
      reportId,
      projectId,
      projectName,
    });
  }, [navigation, projectId, projectName]);

  // ─── 文件上传 ───

  const handleFilePick = useCallback(async () => {
    try {
      const DocumentPicker = require('react-native-document-picker').default;
      const result = await DocumentPicker.pick({
        type: [
          DocumentPicker.types.pdf,
          DocumentPicker.types.xlsx,
          DocumentPicker.types.xls,
          DocumentPicker.types.docx,
          DocumentPicker.types.doc,
          DocumentPicker.types.plainText,
          DocumentPicker.types.images,
        ],
      });

      const file = result[0];
      if (!file) return;

      // 10MB限制
      if (file.size && file.size > 10 * 1024 * 1024) {
        overlay.toast.error('文件大小不能超过10MB');
        return;
      }

      setSending(true);

      if (activeTab === 'chat') {
        // Chat Tab: 解析文件用于对话上下文
        const res = await projectAgentApi.parseFileForChat(projectId, {
          uri: file.uri,
          name: file.name || 'file',
          type: file.type || 'application/octet-stream',
        });
        if (res?.data?.content_digest) {
          setChatMessage(prev => {
            const prefix = prev ? prev + '\n' : '';
            return prefix + `[附件: ${file.name}] ${res.data.content_digest}`;
          });
          overlay.toast.success('文件已解析');
        }
      } else {
        // Followup/Note Tab: 上传文件自动创建笔记
        const res = await projectAgentApi.uploadFile(projectId, {
          uri: file.uri,
          name: file.name || 'file',
          type: file.type || 'application/octet-stream',
        });
        if (res?.success) {
          overlay.toast.success('文件已上传');
          noteRefreshRef.current?.();
          followupRefreshRef.current?.();
        } else {
          overlay.toast.error(res?.message || '上传失败');
        }
      }
    } catch (err: any) {
      if (err?.code === 'DOCUMENT_PICKER_CANCELED') return;
      overlay.toast.error('文件选择失败');
    } finally {
      setSending(false);
    }
  }, [activeTab, projectId]);

  // ─── 输入栏状态分发 ───

  const showInput = activeTab !== 'summary';
  const currentMessage = activeTab === 'chat' ? chatMessage
    : activeTab === 'followup' ? followupMessage : noteMessage;
  const setCurrentMessage = activeTab === 'chat' ? setChatMessage
    : activeTab === 'followup' ? setFollowupMessage : setNoteMessage;
  const handleSubmit = activeTab === 'chat' ? handleSendChatMessage
    : activeTab === 'followup' ? handleSubmitFollowup : handleSubmitNote;
  const inputPlaceholder = activeTab === 'chat'
    ? '向AI助手提问...'
    : activeTab === 'followup'
    ? '输入跟进内容...'
    : '记录笔记...';

  // ─── 渲染 Tab 内容 ───

  const renderTabContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DayColors.accent} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'chat':
        return (
          <ChatTab
            projectId={projectId}
            projectType={projectType}
            conversationHistory={conversationHistory}
            isAiThinking={isAiThinking}
            initialSummary={initialData?.agent_a?.summary}
          />
        );
      case 'followup':
        return (
          <FollowupTab
            projectId={projectId}
            onRefreshRef={followupRefreshRef}
          />
        );
      case 'note':
        return (
          <NoteTab
            projectId={projectId}
            onRefreshRef={noteRefreshRef}
          />
        );
      case 'summary':
        return (
          <SummaryTab
            projectId={projectId}
            projectName={projectName}
            initialData={initialData}
            onCancelFollow={handleCancelFollow}
            onRefreshRef={summaryRefreshRef}
            onGraphIncrementRef={graphIncrementRef}
            onAvatarUpload={(personName: string) => {
              overlay.toast.info(`请在对话中发送${personName}的头像图片，AI将自动识别并设置`);
            }}
          />
        );
      default:
        return null;
    }
  };

  // ─── 渲染 ───

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: DayColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={DayColors.background} />

        {/* ─── 顶部导航栏 ─── */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={18} color={DayColors.text} strokeWidth={2} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {projectName}
            </Text>
            <View style={styles.trayIcons}>
              {/* 项目类型徽章 */}
              <View style={[styles.typeBadge, { backgroundColor: PROJECT_COLORS[projectType] || DayColors.accent }]}>
                <Text style={styles.typeBadgeText}>
                  {PROJECT_TYPE_NAMES[projectType] || '项目'}
                </Text>
              </View>
              
              {/* 项目概要按钮 */}
              <TouchableOpacity
                style={styles.trayBtnWithLabel}
                onPress={() => {
                  overlay.alert({
                    title: '项目概要',
                    message: initialData?.agent_a?.summary || '暂无概要信息',
                  });
                }}
              >
                <FileText size={12} color={DayColors.textSecondary} strokeWidth={2} />
                <Text style={styles.trayLabel}>概要</Text>
              </TouchableOpacity>
              
              {/* 生成周报按钮 */}
              <TouchableOpacity
                style={styles.trayBtnWithLabel}
                onPress={async () => {
                  try {
                    overlay.toast.info('正在生成周报...');
                    const res = await projectAgentApi.sendWeeklyReport(projectId);
                    if (res?.success) {
                      overlay.toast.success(res.message || '周报已生成');
                      const historyRes = await projectAgentApi.getConversationHistory(projectId);
                      if (historyRes?.data) {
                        setConversationHistory(historyRes.data);
                      }
                    }
                  } catch (e: any) {
                    overlay.toast.error(e?.message || '生成周报失败');
                  }
                }}
              >
                <Calendar size={12} color={DayColors.textSecondary} strokeWidth={2} />
                <Text style={styles.trayLabel}>周报</Text>
              </TouchableOpacity>
              
              {/* 搜索按钮 */}
              <TouchableOpacity
                style={styles.trayBtnWithLabel}
                onPress={() => setShowSearchBar(!showSearchBar)}
              >
                {showSearchBar ? (
                  <XIcon size={12} color={DayColors.textSecondary} strokeWidth={2} />
                ) : (
                  <Search size={12} color={DayColors.textSecondary} strokeWidth={2} />
                )}
                <Text style={styles.trayLabel}>{showSearchBar ? '关闭' : '搜索'}</Text>
              </TouchableOpacity>
              
              {/* 更多操作按钮 */}
              <TouchableOpacity
                style={styles.trayBtnWithLabel}
                onPress={handleMoreActions}
              >
                <MoreVertical size={12} color={DayColors.textSecondary} strokeWidth={2} />
                <Text style={styles.trayLabel}>更多</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ─── 搜索框 ─── */}
        {showSearchBar && (
          <View style={styles.searchBar}>
            <Search size={14} color={DayColors.textTertiary} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="搜索关键词..."
              placeholderTextColor={DayColors.textTertiary}
              value={searchKeyword}
              onChangeText={setSearchKeyword}
              autoFocus
            />
            {searchKeyword.length > 0 && (
              <TouchableOpacity onPress={() => setSearchKeyword('')}>
                <XIcon size={14} color={DayColors.textTertiary} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ─── Tab 内容区 ─── */}
        <View style={styles.tabContent}>
          {renderTabContent()}
        </View>

        {/* ─── 底部区域：Tab栏 + 输入栏 ─── */}
        <View style={styles.bottomContainer}>
          {/* Tab栏（在输入框上方） */}
          <View style={styles.tabBar}>
            <View style={styles.tabBarInner}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                const IconComp = tab.icon;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.tabItem, isActive && styles.tabItemActive]}
                    onPress={() => handleTabChange(tab.key)}
                    activeOpacity={0.7}
                  >
                    <IconComp
                      size={15}
                      color={isActive ? '#FFFFFF' : DayColors.textTertiary}
                      strokeWidth={isActive ? 2.2 : 1.6}
                    />
                    <Text style={[
                      styles.tabLabel,
                      isActive && styles.tabLabelActive,
                    ]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>



          {/* 输入栏 */}
          {showInput && (
            <View style={{ paddingBottom: insets.bottom + 15 }}>
              <BottomSearchBar
                value={currentMessage}
                onChangeText={setCurrentMessage}
                onSubmit={handleSubmit}
                placeholder={inputPlaceholder}
                absolute={false}
                avoidKeyboard={false}
                showUploadButton={activeTab === 'chat' || activeTab === 'followup' || activeTab === 'note'}
                onUpload={handleFilePick}
                enableVoice={activeTab === 'chat'}
                variant="light"
                onRequireLogin={() => {
                  navigation.navigate('Login' as any);
                }}
              />
              <Text style={[styles.disclaimer, { position: 'absolute', bottom: insets.bottom, left: 0, right: 0 }]}>
                内容由AI生成，注意甄别
              </Text>
            </View>
          )}

          {/* Summary Tab 底部AI全量分析按钮 */}
          {activeTab === 'summary' && (
            <View style={{ paddingBottom: insets.bottom + 15 }}>
              <View style={styles.analyzeBtnWrapper}>
                <TouchableOpacity
                  style={[styles.analyzeBtn, analyzing && styles.analyzeBtnDisabled]}
                  onPress={handleAnalyze}
                  disabled={analyzing}
                  activeOpacity={0.8}
                >
                  {analyzing ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Sparkles size={16} color="#FFF" strokeWidth={2} />
                  )}
                  <Text style={styles.analyzeBtnText}>
                    {analyzing ? '启动分析中...' : '全量分析'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.disclaimer, { position: 'absolute', bottom: insets.bottom, left: 0, right: 0 }]}>
                内容由AI生成，注意甄别
              </Text>
            </View>
          )}

        </View>

        {/* 记录反馈Toast */}
        <RecordFeedbackToast
          feedback={recordFeedback}
          onRevoke={handleRevokeRecord}
          onDismiss={() => setRecordFeedback(null)}
        />

        {/* 历史分析底部弹窗 */}
        <Modal
          visible={historySheetVisible}
          transparent
          animationType="none"
          onRequestClose={() => setHistorySheetVisible(false)}
        >
          <View style={historyStyles.overlay}>
            <TouchableOpacity
              style={historyStyles.overlayTouch}
              activeOpacity={1}
              onPress={() => setHistorySheetVisible(false)}
            />
            <Animated.View style={[
              historyStyles.sheet,
              {
                paddingBottom: insets.bottom + 16,
                transform: [{
                  translateY: historySheetAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [600, 0],
                  }),
                }],
              },
            ]}>
              <View style={historyStyles.handleBar} />
              <View style={historyStyles.sheetHeader}>
                <Text style={historyStyles.sheetTitle}>历史分析</Text>
                <TouchableOpacity onPress={() => setHistorySheetVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <XIcon size={20} color={DayColors.textSecondary} />
                </TouchableOpacity>
              </View>

              {analysisListLoading ? (
                <View style={historyStyles.loadingBox}>
                  <ActivityIndicator size="small" color={DayColors.accent} />
                  <Text style={historyStyles.loadingText}>加载中...</Text>
                </View>
              ) : analysisList.length === 0 ? (
                <View style={historyStyles.emptyBox}>
                  <Text style={historyStyles.emptyTitle}>暂无全量分析记录</Text>
                  <Text style={historyStyles.emptyHint}>点击下方按钮发起首次全量分析</Text>
                </View>
              ) : (
                <ScrollView style={historyStyles.listScroll} showsVerticalScrollIndicator={false}>
                  {analysisList.map((item, idx) => (
                    <TouchableOpacity
                      key={item.id || idx}
                      style={historyStyles.analysisItem}
                      onPress={() => {
                        if (item.status === 'completed') {
                          handleViewAnalysisDetail(item.id);
                        } else if (item.status === 'generating') {
                          overlay.toast.info('该分析正在生成中，请稍后查看');
                        } else if (item.status === 'failed') {
                          overlay.toast.info('该分析生成失败，请重新触发');
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={historyStyles.itemLeft}>
                        <Clock size={16} color={DayColors.textSecondary} strokeWidth={2} />
                        <View style={historyStyles.itemInfo}>
                          <Text style={historyStyles.itemTitle}>
                            {formatAnalysisDate(item.created_at)} 全量分析
                          </Text>
                          <Text style={historyStyles.itemStatus}>
                            {item.status === 'completed' ? '已完成' : item.status === 'generating' ? '生成中...' : '失败'}
                          </Text>
                        </View>
                      </View>
                      {item.status === 'completed' && (
                        <ChevronRight size={16} color={DayColors.textTertiary} strokeWidth={2} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <TouchableOpacity
                style={[historyStyles.newAnalysisBtn, analyzing && historyStyles.newAnalysisBtnDisabled]}
                onPress={async () => {
                  setHistorySheetVisible(false);
                  handleAnalyze();
                }}
                disabled={analyzing}
                activeOpacity={0.8}
              >
                {analyzing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Sparkles size={16} color="#FFF" strokeWidth={2} />
                )}
                <Text style={historyStyles.newAnalysisBtnText}>
                  {analyzing ? '启动分析中...' : '发起新的全量分析'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
};

const formatAnalysisDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
};

// ─── 样式 ───

const moreStyles = StyleSheet.create({
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F2F3F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnDanger: {
    backgroundColor: '#FEE2E2',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  actionBtnDangerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DayColors.background,
  },
  keyboardAvoidingView: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomContainer: {
    backgroundColor: DayColors.surface,
  },

  // 顶栏 - 类似Windows系统托盘风格
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: DayColors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DayColors.border,
  },
  backBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: DayColors.text,
    marginBottom: 6,
  },
  trayIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  trayBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trayBtnWithLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },
  trayLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: DayColors.textSecondary,
  },

  // 搜索框
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: DayColors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DayColors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: DayColors.text,
    paddingVertical: 0,
  },

  // Tab 内容
  tabContent: {
    flex: 1,
  },

  // 加载
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: DayColors.textTertiary,
  },



  // 免责声明
  disclaimer: {
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
    paddingVertical: 2,
    backgroundColor: DayColors.surface,
  },

  // AI分析按钮
  analyzeBtnWrapper: {
    marginHorizontal: 16,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(120,120,120,0.6)',
    padding: 4,
  },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
    borderRadius: 21,
    backgroundColor: '#111827',
  },
  analyzeBtnDisabled: {
    opacity: 0.6,
  },
  analyzeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },

  // 底部 Tab 栏
  tabBar: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 2,
    backgroundColor: DayColors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DayColors.border,
  },
  tabBarInner: {
    flexDirection: 'row',
    backgroundColor: DayColors.surfaceSecondary,
    borderRadius: 20,
    padding: 2,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 18,
    gap: 3,
  },
  tabItemActive: {
    backgroundColor: '#111827',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: DayColors.textTertiary,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

const historyStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayTouch: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: DayColors.text,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: DayColors.textTertiary,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: DayColors.textSecondary,
    marginBottom: 6,
  },
  emptyHint: {
    fontSize: 13,
    color: DayColors.textTertiary,
  },
  listScroll: {
    maxHeight: 400,
  },
  analysisItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DayColors.border,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: DayColors.text,
  },
  itemStatus: {
    fontSize: 12,
    color: DayColors.textTertiary,
    marginTop: 2,
  },
  newAnalysisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#111827',
  },
  newAnalysisBtnDisabled: {
    opacity: 0.6,
  },
  newAnalysisBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
});

export default ProjectFollowScreen;
