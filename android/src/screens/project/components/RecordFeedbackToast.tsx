import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';

interface RecordFeedbackData {
  record_type: 'note' | 'followup';
  record_id: string;
  summary: string;
  source: string;
  revocable: boolean;
}

interface RecordFeedbackToastProps {
  feedback: RecordFeedbackData | null;
  onRevoke?: (recordType: string, recordId: string) => void;
  onDismiss?: () => void;
}

const SOURCE_LABELS: Record<string, string> = {
  user_explicit: '用户指令',
  llm_auto: 'AI自动',
  chat_agent: 'AI自动',
};

export default function RecordFeedbackToast({ feedback, onRevoke, onDismiss }: RecordFeedbackToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!feedback) return;

    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => onDismiss?.());
    }, 3000);

    return () => clearTimeout(timer);
  }, [feedback]);

  if (!feedback) return null;

  const isNote = feedback.record_type === 'note';
  const icon = isNote ? '📝' : '📌';
  const typeLabel = isNote ? '笔记' : '跟进';
  const sourceLabel = SOURCE_LABELS[feedback.source] || feedback.source;

  const handleRevoke = () => {
    onRevoke?.(feedback.record_type, feedback.record_id);
    onDismiss?.();
  };

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.inner}>
        <Text style={styles.icon}>{icon}</Text>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {typeLabel}：{feedback.summary}
          </Text>
          <Text style={styles.source}>{sourceLabel}</Text>
        </View>
        {feedback.revocable && (
          <TouchableOpacity onPress={handleRevoke} style={styles.revokeBtn}>
            <Text style={styles.revokeText}>撤回</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  inner: {
    backgroundColor: '#F0F7FF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  icon: {
    fontSize: 18,
    marginRight: 8,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  source: {
    fontSize: 11,
    color: '#999',
    marginTop: 1,
  },
  revokeBtn: {
    marginLeft: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: '#E8E8E8',
  },
  revokeText: {
    fontSize: 12,
    color: '#666',
  },
});
