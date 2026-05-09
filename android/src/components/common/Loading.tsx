import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { FontSize } from '@/constants/typography';

interface LoadingProps {
  text?: string;
  fullScreen?: boolean;
  size?: 'small' | 'large';
  color?: string;
  containerStyle?: ViewStyle;
}

export const Loading: React.FC<LoadingProps> = ({ 
  text, 
  fullScreen = false, 
  size = 'large', 
  color = '#FFFFFF',
  containerStyle 
}) => {
  if (text || fullScreen || containerStyle) {
    return (
      <View style={[styles.container, fullScreen && styles.fullScreen, containerStyle]}>
        <ActivityIndicator size={size} color={color} />
        {text && <Text style={[styles.text, { color }]}>{text}</Text>}
      </View>
    );
  }

  return <ActivityIndicator size={size} color={color} />;
};

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => {
  return (
    <View style={styles.emptyContainer}>
      {icon && <View style={styles.emptyIcon}>{icon}</View>}
      <Text style={styles.emptyTitle}>{title}</Text>
      {description && <Text style={styles.emptyDesc}>{description}</Text>}
      {action && <View style={styles.emptyAction}>{action}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'stretch',
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  fullScreen: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
  },
  text: { fontSize: FontSize.base, marginTop: Spacing.md },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'] },
  emptyIcon: { marginBottom: Spacing.base },
  emptyTitle: { fontSize: FontSize.base, fontWeight: '600', textAlign: 'center', marginBottom: Spacing.sm, color: Colors.text.primary },
  emptyDesc: { fontSize: FontSize.sm, textAlign: 'center', color: Colors.text.tertiary },
  emptyAction: { marginTop: Spacing.xl },
});
