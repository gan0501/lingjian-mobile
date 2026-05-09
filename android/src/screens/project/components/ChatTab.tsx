/**
 * ChatTab V2 - 对话Tab
 *
 * 功能：
 * - 消息列表（用户/AI/系统三种气泡）
 * - Markdown 渲染 AI 回复
 * - 打字机效果（最后一条AI消息）
 * - 搜索高亮
 * - 自动滚到底部
 * - AI 思考中动画
 */
import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  InteractionManager,
} from 'react-native';
import { Bot } from 'lucide-react-native';
import { DayColors } from '@/constants';
import SimpleMarkdown from '@/components/common/SimpleMarkdown';
import type { ConversationPair } from '@/services';

interface ChatTabProps {
  projectId: string;
  projectType: number;
  conversationHistory: ConversationPair[];
  isAiThinking: boolean;
  initialSummary?: string;
}

const ChatTab: React.FC<ChatTabProps> = ({
  projectId,
  projectType,
  conversationHistory,
  isAiThinking,
  initialSummary,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const hasScrolledInitial = useRef(false);

  // 消息列表 = 系统消息(摘要) + 对话历史
  const messages = useMemo(() => {
    const list: Array<{
      id: string;
      content: string;
      type: 'user' | 'assistant' | 'system';
    }> = [];

    if (initialSummary) {
      list.push({
        id: 'system_summary',
        content: initialSummary,
        type: 'system',
      });
    }

    conversationHistory.forEach(pair => {
      if (pair.user_message) {
        list.push({
          id: pair.user_message_id || `u_${pair.id}`,
          content: pair.user_message,
          type: 'user',
        });
      }
      if (pair.assistant_message) {
        list.push({
          id: pair.assistant_message_id || `a_${pair.id}`,
          content: pair.assistant_message,
          type: 'assistant',
        });
      }
    });

    return list;
  }, [conversationHistory, initialSummary]);

  // 初始加载时滚动到底部（只执行一次）
  useEffect(() => {
    if (messages.length > 0 && !hasScrolledInitial.current) {
      hasScrolledInitial.current = true;
      // 使用 InteractionManager 确保在所有动画完成后滚动
      const handle = InteractionManager.runAfterInteractions(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      });
      return () => handle.cancel();
    }
  }, [messages.length]);

  // 切换项目时重置
  useEffect(() => {
    hasScrolledInitial.current = false;
  }, [projectId]);

  const handleContentSizeChange = useCallback(() => {}, []);
  const handleScroll = useCallback(() => {});

  const renderMessage = (msg: typeof messages[0], index: number) => {
    const isUser = msg.type === 'user';
    const isSystem = msg.type === 'system';
    const isAssistant = msg.type === 'assistant';

    return (
      <View
        key={msg.id}
        style={[
          styles.messageRow,
          isUser && styles.messageRowUser,
        ]}
      >
        {isUser && (
          <View style={styles.bubbleUser}>
            <Text style={styles.messageTextUser}>
              {msg.content}
            </Text>
          </View>
        )}
        {isAssistant && (
          <View style={styles.assistantContent}>
            <SimpleMarkdown
              content={msg.content}
              textColor={DayColors.text}
              fontSize={14}
            />
          </View>
        )}
        {isSystem && (
          <View style={styles.bubbleSystem}>
            <Text style={styles.systemLabel}>项目概要</Text>
            <Text style={styles.messageText}>
              {msg.content}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onScroll={handleScroll}
      scrollEventThrottle={16}
      onContentSizeChange={handleContentSizeChange}
    >
      {messages.length === 0 && !isAiThinking && (
        <View style={styles.emptyState}>
          <Bot size={48} color={DayColors.textTertiary} strokeWidth={1} />
          <Text style={styles.emptyTitle}>AI 项目跟进</Text>
          <Text style={styles.emptyDesc}>
            你可以向我提问项目相关信息{'\n'}我会帮你分析项目动态
          </Text>
        </View>
      )}

      {messages.map(renderMessage)}

      {/* AI 思考中 */}
      {isAiThinking && (
        <View style={styles.messageRow}>
          <ThinkingDots />
        </View>
      )}
    </ScrollView>
  );
};

// ─── 思考中动画 ───

const ThinkingDots: React.FC = () => {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
        ]),
      );

    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 150);
    const a3 = animate(dot3, 300);
    a1.start(); a2.start(); a3.start();

    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={styles.thinkingRow}>
      <Animated.View style={[styles.thinkingDot, { opacity: dot1 }]} />
      <Animated.View style={[styles.thinkingDot, { opacity: dot2 }]} />
      <Animated.View style={[styles.thinkingDot, { opacity: dot3 }]} />
    </View>
  );
};

// ─── 样式 ───

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 24,
    gap: 12,
  },

  // 空态
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: DayColors.text,
  },
  emptyDesc: {
    fontSize: 13,
    color: DayColors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // 消息行
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },

  // 用户气泡
  bubbleUser: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    backgroundColor: '#111827',
  },

  // AI 回复（无气泡，占满宽度）
  assistantContent: {
    width: '100%',
    paddingVertical: 4,
  },

  // 项目概要气泡（保持不变）
  bubbleSystem: {
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    backgroundColor: '#F5F3FF',
    borderColor: '#E0E7FF',
    borderWidth: 1,
  },

  // 文字
  systemLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6366F1',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
    color: DayColors.text,
  },
  messageTextUser: {
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
  },

  // 思考动画
  thinkingRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  thinkingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: DayColors.textTertiary,
  },
});

export default ChatTab;
