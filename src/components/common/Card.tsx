import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius } from '@/constants/spacing';
import { FontSize } from '@/constants/typography';

interface CardProps {
  children?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, onPress, style, noPadding }) => {
  const content = <View style={[styles.container, noPadding && styles.noPadding, style]}>{children}</View>;

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

interface InfoCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  tags?: { label: string; color: string }[];
  rightContent?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export const InfoCard: React.FC<InfoCardProps> = ({ title, subtitle, description, tags, rightContent, onPress, style }) => {
  return (
    <Card onPress={onPress} style={style}>
      <View style={styles.infoCardContent}>
        <View style={styles.infoCardLeft}>
          <Text style={styles.infoCardTitle} numberOfLines={2}>{title}</Text>
          {subtitle && <Text style={styles.infoCardSubtitle} numberOfLines={1}>{subtitle}</Text>}
          {tags && tags.length > 0 && (
            <View style={styles.tagsRow}>
              {tags.map((tag, index) => (
                <View key={index} style={[styles.tag, { backgroundColor: tag.color }]}>
                  <Text style={styles.tagText}>{tag.label}</Text>
                </View>
              ))}
            </View>
          )}
          {description && <Text style={styles.infoCardDesc} numberOfLines={2}>{description}</Text>}
        </View>
        {rightContent && <View style={styles.infoCardRight}>{rightContent}</View>}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.card,
    padding: Spacing.cardPadding,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  noPadding: { padding: 0 },
  infoCardContent: { flexDirection: 'row' },
  infoCardLeft: { flex: 1 },
  infoCardRight: { marginLeft: Spacing.md, justifyContent: 'center' },
  infoCardTitle: { fontSize: FontSize.base, fontWeight: '600', color: Colors.text.primary, marginBottom: Spacing.xs },
  infoCardSubtitle: { fontSize: FontSize.sm, color: Colors.text.secondary, marginBottom: Spacing.sm },
  infoCardDesc: { fontSize: FontSize.xs, color: Colors.text.tertiary, marginTop: Spacing.sm },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  tag: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  tagText: { fontSize: 10, color: Colors.text.primary, fontWeight: '500' },
});
