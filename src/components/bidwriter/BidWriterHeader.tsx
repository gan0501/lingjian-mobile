import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/common';

// AI模型图标 - 本地资源
const MODEL_ICONS: Record<string, any> = {
  deepseek: require('@/assets/images/models/deepseek.png'),
  qwen: require('@/assets/images/models/qwen.png'),
  doubao: require('@/assets/images/models/doubao.png'),
  zhipu: require('@/assets/images/models/zhipu.png'),
  kimi: require('@/assets/images/models/moonshot.png'),
  minimax: require('@/assets/images/models/minimax.png'),
};

export type StepStatus = 'pending' | 'active' | 'done';

export interface StepInfo {
  name: string;
  status: StepStatus;
}

interface BidWriterHeaderProps {
  navigation: { goBack: () => void };
  projectName?: string;
  selectedModel: string;
  wordCount: number;
  darkBidMode: boolean;
  hasKnowledgeFiles: boolean;
  status?: string;
  statusText?: string;
  isGenerating?: boolean;
  steps?: StepInfo[];
  onModelPress: () => void;
  onConfigPress: () => void;
  onKnowledgePress: () => void;
  onMyBidsPress?: () => void;
  rightAction?: {
    label: string;
    onPress: () => void;
  };
}

export const BidWriterHeader: FC<BidWriterHeaderProps> = ({
  navigation,
  projectName,
  selectedModel,
  wordCount,
  darkBidMode,
  hasKnowledgeFiles,
  status,
  statusText,
  isGenerating,
  steps,
  onModelPress,
  onConfigPress,
  onKnowledgePress,
  onMyBidsPress,
  rightAction,
}) => {
  const insets = useSafeAreaInsets();
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const dropdownTimer = useRef<NodeJS.Timeout | null>(null);

  // 呼吸动画 - 任何active步骤都闪烁
  useEffect(() => {
    if (isGenerating) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(breatheAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      breatheAnim.setValue(1);
    }
  }, [isGenerating, breatheAnim]);

  const clearDropdownTimer = useCallback(() => {
    if (dropdownTimer.current) {
      clearTimeout(dropdownTimer.current);
      dropdownTimer.current = null;
    }
  }, []);

  const showDropdown = useCallback(() => {
    setDropdownVisible(true);
    clearDropdownTimer();
    dropdownTimer.current = setTimeout(() => {
      setDropdownVisible(false);
      dropdownTimer.current = null;
    }, 3000);
  }, [clearDropdownTimer]);

  const dismissDropdown = useCallback(() => {
    setDropdownVisible(false);
    clearDropdownTimer();
  }, [clearDropdownTimer]);

  const toggleDropdown = useCallback(() => {
    if (dropdownVisible) {
      dismissDropdown();
    } else {
      showDropdown();
    }
  }, [dropdownVisible, dismissDropdown, showDropdown]);

  useEffect(() => {
    return () => clearDropdownTimer();
  }, [clearDropdownTimer]);

  const getModelIcon = () => {
    return MODEL_ICONS[selectedModel] || MODEL_ICONS.qwen;
  };

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <BackButton onPress={() => navigation.goBack()} />

        <View style={styles.projectNameContainer}>
          <Text style={styles.projectName} numberOfLines={1} ellipsizeMode="tail">
            {projectName || '指尖标书'}
          </Text>
          <View style={styles.projectMeta}>
            {statusText && (
              <TouchableOpacity
                style={styles.statusBadge}
                onPress={toggleDropdown}
                activeOpacity={0.7}
              >
                <Animated.View style={[styles.statusDot, isGenerating && { opacity: breatheAnim }]} />
                <Text style={styles.statusText}>{statusText}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.modelBadge}
              onPress={onModelPress}
            >
              <Image
                source={getModelIcon()}
                style={styles.modelBadgeIcon}
              />
            </TouchableOpacity>
            <Text style={styles.wordCountText}>{(wordCount / 10000).toFixed(1)}万字</Text>
            <TouchableOpacity
              style={styles.darkBidBadge}
              onPress={onConfigPress}
            >
              <Image
                source={darkBidMode
                  ? require('@/assets/images/models/anbiao.png')
                  : require('@/assets/images/models/anbiao_no.png')
                }
                style={styles.darkBidIcon}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.knowledgeBadge}
              onPress={onKnowledgePress}
            >
              <Image
                source={hasKnowledgeFiles
                  ? require('@/assets/images/models/knowledge.png')
                  : require('@/assets/images/models/knowledge_no.png')
                }
                style={styles.knowledgeIcon}
              />
            </TouchableOpacity>
            {onMyBidsPress && (
              <TouchableOpacity
                style={styles.headerAction}
                onPress={onMyBidsPress}
                activeOpacity={0.7}
              >
                <Text style={styles.headerActionText}>我的标书</Text>
              </TouchableOpacity>
            )}
            {rightAction && (
              <TouchableOpacity 
                style={styles.headerAction} 
                onPress={rightAction.onPress}
                activeOpacity={0.7}
              >
                <Text style={styles.headerActionText}>{rightAction.label}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      <View style={styles.headerDivider} />
      {/* 步骤下拉弹窗 */}
      {dropdownVisible && steps && steps.length > 0 && (
        <>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismissDropdown}
          />
          <View style={[styles.dropdownPanel, { top: insets.top + 70 }]}>
            {steps.map((stepItem, index) => (
              <View key={stepItem.name} style={styles.dropdownItem}>
                <Animated.View
                  style={[
                    styles.dropdownDot,
                    stepItem.status === 'done' && { backgroundColor: '#4CAF50' },
                    stepItem.status === 'active' && { backgroundColor: '#4CAF50' },
                    stepItem.status === 'pending' && { backgroundColor: '#666' },
                    stepItem.status === 'active' && stepItem.name !== '准备' && { opacity: breatheAnim },
                  ]}
                />
                <Text
                  style={[
                    styles.dropdownText,
                    stepItem.status === 'pending' && { color: 'rgba(255,255,255,0.4)' },
                  ]}
                >
                  {stepItem.name}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
  },
  projectNameContainer: {
    flex: 1,
    marginLeft: 12,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76,175,80,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '500',
  },
  projectMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modelBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  modelBadgeIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  wordCountText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginRight: 8,
  },
  darkBidBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  darkBidIcon: {
    width: 14,
    height: 14,
  },
  knowledgeBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  knowledgeIcon: {
    width: 14,
    height: 14,
  },
  headerAction: {
    backgroundColor: 'rgba(178,0,0,0.8)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerActionText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
  },
  headerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
  },
  dropdownPanel: {
    position: 'absolute',
    left: 95,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex: 999,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  dropdownDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 8,
  },
  dropdownText: {
    fontSize: 11,
    color: '#fff',
  },
});
