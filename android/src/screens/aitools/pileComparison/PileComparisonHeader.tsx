import React, { FC, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Edit3 } from 'lucide-react-native';
import { ChevronLeft } from 'lucide-react-native';

interface PileComparisonHeaderProps {
  navigation: { goBack: () => void };
  projectName?: string;
  holeNumber?: string;
  onEditProjectName: () => void;
  onViewReport?: () => void;
  hasUnreadReport?: boolean;
  tabs: Array<{
    id: string;
    label: string;
  }>;
  selectedTab: string;
  maxReachedStep?: number;
  onTabPress: (tabId: string) => void;
}

export const PileComparisonHeader: FC<PileComparisonHeaderProps> = ({
  navigation,
  projectName,
  holeNumber,
  onEditProjectName,
  onViewReport,
  hasUnreadReport,
  tabs,
  selectedTab,
  maxReachedStep: maxStepProp,
  onTabPress,
}) => {
  const insets = useSafeAreaInsets();

  const orderedTabs = useMemo(() => {
    const order = ['parameter', 'profile', 'bearing', 'solution'];
    const rank = new Map(order.map((id, idx) => [id, idx]));
    return [...tabs].sort((a, b) => {
      const ra = rank.get(a.id) ?? 999;
      const rb = rank.get(b.id) ?? 999;
      return ra - rb;
    });
  }, [tabs]);

  const stepIndex = useMemo(() => {
    const idx = orderedTabs.findIndex(t => t.id === selectedTab);
    return idx >= 0 ? idx : 0;
  }, [orderedTabs, selectedTab]);

  // 记录用户曾经到达的最高步骤，优先使用外部传入的 maxReachedStep（解决历史记录初始化问题）
  // 否则内部根据 selectedTab 变化累加
  const [internalMaxStep, setInternalMaxStep] = React.useState(0);
  React.useEffect(() => {
    setInternalMaxStep(prev => Math.max(prev, stepIndex));
  }, [stepIndex]);

  const maxReachedStep = Math.max(maxStepProp ?? 0, internalMaxStep);

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}><ChevronLeft size={24} color="#fff" /></TouchableOpacity>

        <View style={styles.projectNameContainer}>
          <View style={styles.projectNameRow}>
            <View style={styles.titleContainer}>
              <Text style={styles.projectNameMain} numberOfLines={1} ellipsizeMode="tail">
                {projectName || '桩基比选'}
              </Text>
              {holeNumber ? (
                <Text style={styles.projectNameSub} numberOfLines={1} ellipsizeMode="tail">
                  （孔号{holeNumber}）
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={onEditProjectName}
            >
              <Edit3 size={14} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          <View style={styles.progressRow}>
            <View style={styles.progressStepsContainer}>
              {orderedTabs.map((tab, idx) => {
                const isActive = idx === stepIndex;
                const isReached = idx <= maxReachedStep;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[
                      styles.stepButton,
                      isActive ? styles.stepButtonActive : null
                    ]}
                    onPress={() => onTabPress(tab.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[
                      styles.stepNumberText,
                      isActive || isReached ? styles.stepNumberTextActive : styles.stepNumberTextInactive
                    ]}>
                      {idx + 1}
                    </Text>
                    <Text style={[
                      styles.stepLabelText,
                      isActive || isReached ? styles.stepLabelTextActive : styles.stepLabelTextInactive
                    ]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.reportButton}
              onPress={onViewReport}
              activeOpacity={0.85}
            >
              <Text style={styles.reportButtonText}>对比报告</Text>
              {!!hasUnreadReport && <View style={styles.reportBadge} />}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <View style={styles.headerDivider} />
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectNameContainer: {
    flex: 1,
    marginLeft: 12,
  },
  projectNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectNameMain: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 20,
  },
  projectNameSub: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    marginLeft: 4,
  },
  editButton: {
    marginLeft: 8,
    padding: 4,
    alignSelf: 'center',
  },
  spacer: {
    flex: 1,
  },
  reportButton: {
    position: 'relative',
    backgroundColor: 'rgba(178,0,0,0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginLeft: 8,
  },
  reportButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  reportBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  progressStepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    width: '100%',
    height: 22,
    paddingVertical: 2,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
  },
  stepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: 16,
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 2,
  },
  stepButtonActive: {
    backgroundColor: '#4CAF50',
  },
  stepNumberText: {
    fontSize: 9,
    fontWeight: '700',
    marginRight: 4,
  },
  stepNumberTextActive: {
    color: '#FFFFFF',
  },
  stepNumberTextInactive: {
    color: 'rgba(255,255,255,0.4)',
  },
  stepLabelText: {
    fontSize: 9,
    fontWeight: '500',
  },
  stepLabelTextActive: {
    color: '#FFFFFF',
  },
  stepLabelTextInactive: {
    color: 'rgba(255,255,255,0.4)',
  },
  headerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
  },
});
