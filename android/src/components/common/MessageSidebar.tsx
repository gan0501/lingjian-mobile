import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { GlassSidebar } from './GlassSidebar';
import { useMessageStore, Message } from '@/stores';
import { Loading } from './Loading';
import { Spacing, FontSize, BorderRadius } from '@/constants';

interface MessageSidebarProps {
  visible: boolean;
  onClose: () => void;
  onMessageSelect?: (message: Message) => void;
}

const getMessageIcon = (category: Message['category']) => {
  switch (category) {
    case 'system':
      return '🔔';
    case 'activity':
      return '🎉';
    case 'im':
      return '💬';
    case 'member':
      return '🤝';
    case 'quota_reward':
      return '🎁';
    default:
      return '📢';
  }
};

export const MessageSidebar: React.FC<MessageSidebarProps> = ({
  visible,
  onClose,
  onMessageSelect,
}) => {
  const { messages, loading, fetchMessages, markAsRead, respondToInvite } = useMessageStore();
  const [responding, setResponding] = useState<string | null>(null);
  const [messageCategory, setMessageCategory] = useState<Message['category'] | 'all'>('all');

  useEffect(() => {
    if (visible) {
      fetchMessages(true);
    }
  }, [visible]);

  const isPendingInvite = (message: Message) => {
    return message.message_type === 2 && message.status === 0;
  };

  const getFilteredMessages = () => {
    if (messageCategory === 'all') {
      return messages;
    }
    return messages.filter(msg => msg.category === messageCategory);
  };

  const getCategoryName = (category: Message['category'] | 'all') => {
    switch (category) {
      case 'all': return '全部';
      case 'system': return '系统';
      case 'activity': return '活动';
      case 'im': return '消息';
      case 'member': return '会员';
      case 'quota_reward': return '奖励';
      default: return '其他';
    }
  };

  const handleMessagePress = (message: Message) => {
    if (isPendingInvite(message)) {
      return;
    }
    markAsRead(message.id);
    onMessageSelect?.(message);
  };

  const handleRespond = async (message: Message, action: 'accept' | 'reject') => {
    if (action === 'accept') {
      Alert.alert(
        '接受协作邀请',
        '接受后，您将以协作者身份参与该项目，且该项目的对话记录将被重置清空（将使用创建者的跟进记录）。确认接受？',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '确认接受',
            style: 'destructive',
            onPress: async () => {
              setResponding(message.id);
              const success = await respondToInvite(message.id, action);
              setResponding(null);
              if (success) {
                Alert.alert('提示', '已接受协作邀请');
              } else {
                Alert.alert('错误', '操作失败，请重试');
              }
            },
          },
        ],
      );
      return;
    }

    setResponding(message.id);
    const success = await respondToInvite(message.id, action);
    setResponding(null);

    if (success) {
      Alert.alert('提示', '已拒绝协作邀请');
    } else {
      Alert.alert('错误', '操作失败，请重试');
    }
  };

  return (
    <GlassSidebar
      visible={visible}
      onClose={onClose}
      title="消息中心"
      width="80%"
    >
      <View style={styles.container}>
        <View style={styles.categoryTabs}>
          {(['all', 'system', 'activity', 'im', 'member'] as const).map((cat) => (
            <TouchableOpacity
              key={cat}
              style={styles.categoryTab}
              onPress={() => setMessageCategory(cat)}
            >
              <Text style={[
                styles.categoryTabText,
                messageCategory === cat && styles.categoryTabTextActive
              ]}>
                {getCategoryName(cat)}
              </Text>
              {messageCategory === cat && <View style={styles.categoryTabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.divider} />

        <ScrollView style={styles.messageList}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <Loading color="#1A1A2E" />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.loadingText}>暂无消息</Text>
            </View>
          ) : getFilteredMessages().length === 0 ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.loadingText}>该类别暂无消息</Text>
            </View>
          ) : (
            getFilteredMessages().map((message) => (
              <TouchableOpacity
                key={message.id}
                style={[
                  styles.messageItem,
                  message.unread && styles.messageItemUnread,
                ]}
                onPress={() => handleMessagePress(message)}
                activeOpacity={isPendingInvite(message) ? 1 : 0.7}
              >
                <View style={styles.messageIcon}>
                  <Text style={styles.iconText}>{getMessageIcon(message.category)}</Text>
                </View>
                <View style={styles.messageContent}>
                  <View style={styles.messageHeader}>
                    <Text style={styles.messageTitle} numberOfLines={1}>
                      {message.title}
                    </Text>
                    {message.unread && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.messageText} numberOfLines={2}>
                    {message.content}
                  </Text>
                  <Text style={styles.messageTime}>{message.time}</Text>

                  {isPendingInvite(message) && (
                    <View style={styles.inviteActions}>
                      {responding === message.id ? (
                        <Loading size="small" color="#B20000" />
                      ) : (
                        <>
                          <TouchableOpacity
                            style={styles.acceptBtn}
                            onPress={() => handleRespond(message, 'accept')}
                          >
                            <Text style={styles.acceptBtnText}>接受</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.rejectBtn}
                            onPress={() => handleRespond(message, 'reject')}
                          >
                            <Text style={styles.rejectBtnText}>拒绝</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}

                  {message.message_type === 2 && message.status === 1 && (
                    <Text style={styles.statusText}>已接受</Text>
                  )}
                  {message.message_type === 2 && message.status === 2 && (
                    <Text style={styles.statusTextReject}>已拒绝</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    </GlassSidebar>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Spacing.sm,
  },
  categoryTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  categoryTab: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  categoryTabText: {
    color: '#999999',
    fontSize: FontSize.sm,
  },
  categoryTabTextActive: {
    color: '#1A1A2E',
    fontWeight: 'bold',
  },
  categoryTabIndicator: {
    width: 20,
    height: 2,
    backgroundColor: '#1A1A2E',
    marginTop: 4,
    borderRadius: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  messageList: {
    flex: 1,
  },
  messageItem: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  messageItemUnread: {
    backgroundColor: '#FEF2F2',
  },
  messageIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.base,
  },
  iconText: {
    fontSize: 18,
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageTitle: {
    color: '#1A1A2E',
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#B20000',
    marginLeft: Spacing.sm,
  },
  messageText: {
    color: '#6B7280',
    fontSize: FontSize.xs,
    lineHeight: 18,
    marginBottom: 4,
  },
  messageTime: {
    color: '#9CA3AF',
    fontSize: FontSize.xs,
  },
  loadingWrap: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6B7280',
    fontSize: FontSize.base,
    marginTop: Spacing.sm,
  },
  inviteActions: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  acceptBtn: {
    backgroundColor: '#B20000',
    paddingHorizontal: Spacing.base,
    paddingVertical: 6,
    borderRadius: 4,
  },
  acceptBtnText: {
    color: '#ffffff',
    fontSize: FontSize.xs,
    fontWeight: 'bold',
  },
  rejectBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: Spacing.base,
    paddingVertical: 6,
    borderRadius: 4,
  },
  rejectBtnText: {
    color: '#1A1A2E',
    fontSize: FontSize.xs,
  },
  statusText: {
    color: '#16A34A',
    fontSize: FontSize.xs,
    marginTop: 4,
  },
  statusTextReject: {
    color: '#9CA3AF',
    fontSize: FontSize.xs,
    marginTop: 4,
  },
});

export default MessageSidebar;
