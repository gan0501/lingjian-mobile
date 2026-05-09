import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapPin, Calendar, Building2 } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius } from '@/constants/spacing';
import { FontSize } from '@/constants/typography';
import { formatDate, formatCurrency } from '@/utils/format';

interface ProjectCardProps {
  title: string;
  type: string;
  typeColor: string;
  region?: string;
  amount?: number | string;
  publishDate?: string;
  constructor?: string;
  address?: string;
  onPress?: () => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  title,
  type,
  typeColor,
  region,
  amount,
  publishDate,
  constructor,
  address,
  onPress,
}) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={[styles.typeTag, { backgroundColor: typeColor }]}>
          <Text style={styles.typeText}>{type}</Text>
        </View>
        {region && <Text style={styles.region}>{region}</Text>}
      </View>

      <Text style={styles.title} numberOfLines={2}>{title}</Text>

      <View style={styles.infoRow}>
        {constructor && (
          <View style={styles.infoItem}>
            <Building2 color={Colors.text.tertiary} size={12} />
            <Text style={styles.infoText} numberOfLines={1}>{constructor}</Text>
          </View>
        )}
        {amount && (
          <Text style={styles.amount}>{formatCurrency(amount)}</Text>
        )}
      </View>

      <View style={styles.footer}>
        {address && (
          <View style={styles.footerItem}>
            <MapPin color={Colors.text.tertiary} size={12} />
            <Text style={styles.footerText} numberOfLines={1}>{address}</Text>
          </View>
        )}
        {publishDate && (
          <View style={styles.footerItem}>
            <Calendar color={Colors.text.tertiary} size={12} />
            <Text style={styles.footerText}>{formatDate(publishDate)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.card,
    padding: Spacing.cardPadding,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  typeTag: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm, marginRight: Spacing.sm },
  typeText: { fontSize: 10, fontWeight: '600', color: Colors.text.primary },
  region: { fontSize: FontSize.xs, color: Colors.text.tertiary },
  title: { fontSize: FontSize.base, fontWeight: '600', color: Colors.text.primary, marginBottom: Spacing.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  infoItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  infoText: { fontSize: FontSize.xs, color: Colors.text.secondary, marginLeft: Spacing.xs, flex: 1 },
  amount: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary[500] },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  footerText: { fontSize: FontSize.xs, color: Colors.text.tertiary, marginLeft: Spacing.xs },
});
