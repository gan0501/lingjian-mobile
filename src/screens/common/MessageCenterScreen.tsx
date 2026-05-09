import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, FontSize, DayColors } from '@/constants';
import { useMessageStore } from '@/stores';
import { EmptyState } from '@/components/common';

const MessageCenterScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { messages, unreadCount, markAsRead } = useMessageStore();

  const renderMessage = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.messageItem, item.unread && styles.messageItemUnread]}
      onPress={() => markAsRead(item.id)}
    >
      <View style={styles.messageHeader}>
        <Text style={styles.messageTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.messageTime}>{item.time}</Text>
      </View>
      <Text style={styles.messageContent} numberOfLines={2}>
        {item.content}
      </Text>
      {item.unread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + Spacing.base }]}>
        <TouchableOpacity style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>消息中心</Text>
        <View style={styles.placeholder} />
      </View>

      {messages.length === 0 ? (
        <EmptyState message="暂无消息" />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DayColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.base,
    backgroundColor: DayColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: DayColors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: DayColors.text,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: DayColors.text,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  listContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: 100,
  },
  messageItem: {
    backgroundColor: DayColors.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: DayColors.border,
    marginBottom: Spacing.sm,
  },
  messageItemUnread: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary[500],
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  messageTitle: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: '600',
    color: DayColors.text,
  },
  messageTime: {
    fontSize: FontSize.xs,
    color: DayColors.textTertiary,
    marginLeft: Spacing.sm,
  },
  messageContent: {
    fontSize: FontSize.sm,
    color: DayColors.textSecondary,
    lineHeight: 20,
  },
  unreadDot: {
    position: 'absolute',
    top: Spacing.base,
    right: Spacing.base,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent.error,
  },
});

export default MessageCenterScreen;
