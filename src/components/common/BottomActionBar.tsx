import React, { FC, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cpu, Palette, Settings, BookOpen } from 'lucide-react-native';
import { FontSize } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';

interface ActionTab {
  icon: ReactNode;
  label: string;
  onPress?: () => void;
  active?: boolean;
}

interface BottomActionBarProps {
  mainButtonText: string;
  onMainButtonPress: () => void;
  mainButtonDisabled?: boolean;
  mainButtonLoading?: boolean;
  customTabs?: ActionTab[];
  style?: ViewStyle;
}

const defaultTabs: ActionTab[] = [
  { icon: <Cpu size={16} color="rgba(255,255,255,0.6)" />, label: '模型' },
  { icon: <Palette size={16} color="rgba(255,255,255,0.6)" />, label: '样式' },
  { icon: <Settings size={16} color="rgba(255,255,255,0.6)" />, label: '��置' },
  { icon: <BookOpen size={16} color="rgba(255,255,255,0.6)" />, label: '知识' },
];

export const BottomActionBar: FC<BottomActionBarProps> = ({
  mainButtonText,
  onMainButtonPress,
  mainButtonDisabled = false,
  mainButtonLoading = false,
  customTabs,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const tabs = customTabs || defaultTabs;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 10 }, style]}>
      {/* 四个功能按钮 */}
      <View style={styles.tabsRow}>
        {tabs.map((tab, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.tab, tab.active && styles.tabActive]}
            onPress={tab.onPress}
            disabled={!tab.onPress}
          >
            {tab.icon}
            <Text style={[styles.tabLabel, tab.active && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 主操作按钮 */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={onMainButtonPress}
          disabled={mainButtonDisabled || mainButtonLoading}
        >
          <LinearGradient
            colors={
              mainButtonDisabled || mainButtonLoading
                ? ['rgba(128,128,128,0.25)', 'rgba(128,128,128,0.15)', 'rgba(0,0,0,0.85)']
                : ['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.15)', 'rgba(0,0,0,0.85)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonBackground}
          >
            <View style={styles.buttonHighlight} />
            {mainButtonLoading && (
              <ActivityIndicator size="small" color="#fff" style={styles.loadingIndicator} />
            )}
            <Text style={styles.buttonText}>
              {mainButtonLoading ? '导出中...' : mainButtonText}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 30,
    paddingVertical: 10,
    gap: Spacing.sm,
    marginBottom: 0,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  tabActive: {
    borderColor: 'rgba(233,69,96,0.5)',
    backgroundColor: 'rgba(233,69,96,0.1)',
  },
  tabLabel: {
    fontSize: FontSize.xs,
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 4,
  },
  tabLabelActive: {
    color: '#e94560',
  },
  buttonContainer: {
    paddingHorizontal: 20,
  },
  button: {
    flexDirection: 'row',
    borderRadius: 25,
    height: 50,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  buttonBackground: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
  },
  buttonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 18,
  },
  loadingIndicator: {
    marginRight: 8,
  },
});

export default BottomActionBar;
