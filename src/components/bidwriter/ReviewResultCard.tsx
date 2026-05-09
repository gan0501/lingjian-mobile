/**
 * 审稿结果卡片组件
 * 显示审稿评分、总结和建议列表
 */
import React, { FC, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { X, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import type { ReviewResult as ReviewResultType } from '@/services/bidWriter';

interface ReviewResultCardProps {
  visible: boolean;
  reviewResult: ReviewResultType | null;
  onClose: () => void;
}

export const ReviewResultCard: FC<ReviewResultCardProps> = ({
  visible,
  reviewResult,
  onClose,
}) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(SCREEN_HEIGHT);
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<number>>(new Set());

  if (!reviewResult) return null;

  const toggleSuggestion = (index: number) => {
    setExpandedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return '#F44336';
      case 'medium': return '#FF9800';
      case 'low': return '#FFC107';
      default: return '#9E9E9E';
    }
  };

  const getSeverityText = (severity: string) => {
    switch (severity) {
      case 'high': return '严重';
      case 'medium': return '中等';
      case 'low': return '轻微';
      default: return '未知';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#4CAF50';
    if (score >= 80) return '#8BC34A';
    if (score >= 70) return '#FFC107';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  };

  const getScoreText = (score: number) => {
    if (score >= 90) return '优秀';
    if (score >= 80) return '良好';
    if (score >= 70) return '中等';
    if (score >= 60) return '及格';
    return '不及格';
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.header}>
            <Text style={styles.title}>审稿结果</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            overScrollMode="never"
            bounces={false}
          >
            <View style={styles.scoreCard}>
              <LinearGradient
                colors={[getScoreColor(reviewResult.overall_score), getScoreColor(reviewResult.overall_score) + '80']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.scoreGradient}
              >
                <Text style={styles.scoreNumber}>{reviewResult.overall_score}</Text>
                <Text style={styles.scoreText}>分</Text>
              </LinearGradient>
              <View style={styles.scoreInfo}>
                <Text style={styles.scoreLabel}>评价等级</Text>
                <Text style={styles.scoreValue}>{getScoreText(reviewResult.overall_score)}</Text>
                {reviewResult.suggestions && reviewResult.suggestions.length > 0 && (
                  <Text style={styles.scoreIssues}>
                    建议修改 {reviewResult.suggestions.length} 处
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>总结评价</Text>
              <Text style={styles.summaryText}>{reviewResult.summary}</Text>
            </View>

            {reviewResult.suggestions && reviewResult.suggestions.length > 0 && (
              <View style={styles.suggestionsCard}>
                <Text style={styles.suggestionsTitle}>
                  修改建议 ({reviewResult.suggestions.length})
                </Text>
                {reviewResult.suggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionItem}
                    onPress={() => toggleSuggestion(index)}
                  >
                    <View style={styles.suggestionHeader}>
                      <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(suggestion.severity) }]}>
                        <Text style={styles.severityText}>{getSeverityText(suggestion.severity)}</Text>
                      </View>
                      <Text style={styles.suggestionTitle} numberOfLines={1}>
                        {suggestion.section_title}
                      </Text>
                      {expandedSuggestions.has(index) ? (
                        <ChevronUp size={16} color="rgba(255,255,255,0.7)" />
                      ) : (
                        <ChevronDown size={16} color="rgba(255,255,255,0.7)" />
                      )}
                    </View>
                    {expandedSuggestions.has(index) && (
                      <View style={styles.suggestionDetail}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>问题类型：</Text>
                          <Text style={styles.detailValue}>{suggestion.issue_type}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>问题描述：</Text>
                          <Text style={styles.detailValue}>{suggestion.description}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>修改建议：</Text>
                          <Text style={[styles.detailValue, styles.suggestionText]}>{suggestion.suggestion}</Text>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {(!reviewResult.suggestions || reviewResult.suggestions.length === 0) && (
              <View style={styles.noIssuesCard}>
                <CheckCircle size={48} color="#4CAF50" />
                <Text style={styles.noIssuesTitle}>未发现问题</Text>
                <Text style={styles.noIssuesText}>标书内容质量良好，无需修改</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 16,
    paddingBottom: 0,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },
  scoreGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  scoreNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  scoreText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  scoreInfo: {
    flex: 1,
  },
  scoreLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginBottom: 4,
  },
  scoreValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  scoreIssues: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 4,
  },
  summaryCard: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    marginBottom: 16,
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  summaryText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    lineHeight: 18,
  },
  suggestionsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  suggestionsTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  suggestionItem: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  severityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  severityText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  suggestionTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  suggestionDetail: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  detailRow: {
    marginBottom: 8,
  },
  detailLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginBottom: 2,
  },
  detailValue: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    lineHeight: 18,
  },
  suggestionText: {
    color: '#4CAF50',
  },
  noIssuesCard: {
    padding: 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    alignItems: 'center',
  },
  noIssuesTitle: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  noIssuesText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textAlign: 'center',
  },
});

export default ReviewResultCard;
