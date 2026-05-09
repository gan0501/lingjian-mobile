import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { X, MapPin, Calendar, Building2 } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius } from '@/constants/spacing';
import { FontSize } from '@/constants/typography';
import { Button } from '@/components/common';
import { formatDate } from '@/utils/format';

interface MarkerDetailCardProps {
  visible: boolean;
  title: string;
  type: string;
  typeColor: string;
  region?: string;
  address?: string;
  publishDate?: string;
  constructor?: string;
  isFollowed?: boolean;
  onClose: () => void;
  onFollow?: () => void;
  onViewDetail?: () => void;
}

export const MarkerDetailCard: React.FC<MarkerDetailCardProps> = ({
  visible,
  title,
  type,
  typeColor,
  region,
  address,
  publishDate,
  constructor,
  isFollowed = false,
  onClose,
  onFollow,
  onViewDetail,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <X color={Colors.text.tertiary} size={20} />
        </TouchableOpacity>

        <Text style={styles.title} numberOfLines={2}>{title}</Text>

        <View style={styles.tagsRow}>
          <View style={[styles.tag, { backgroundColor: typeColor }]}>
            <Text style={styles.tagText}>{type}</Text>
          </View>
          {region && (
            <View style={[styles.tag, styles.regionTag]}>
              <Text style={styles.tagText}>{region}</Text>
            </View>
          )}
          {isFollowed && (
            <View style={[styles.tag, { backgroundColor: '#EF4444' }]}>
              <Text style={styles.tagText}>已跟进</Text>
            </View>
          )}
        </View>

        <ScrollView style={styles.infoContainer} showsVerticalScrollIndicator={false}>
          {constructor && (
            <View style={styles.infoRow}>
              <Building2 color={Colors.text.tertiary} size={14} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>建设单位</Text>
                <Text style={styles.infoValue}>{constructor}</Text>
              </View>
            </View>
          )}
          {address && (
            <View style={styles.infoRow}>
              <MapPin color={Colors.text.tertiary} size={14} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>地址</Text>
                <Text style={styles.infoValueGray} numberOfLines={2}>{address}</Text>
              </View>
            </View>
          )}
          {publishDate && (
            <View style={styles.infoRow}>
              <Calendar color={Colors.text.tertiary} size={14} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>发布时间</Text>
                <Text style={styles.infoValueGray}>{formatDate(publishDate)}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.divider} />

        <View style={styles.actionsRow}>
          <View style={styles.actionsRight}>
            {isFollowed ? (
              <Button title="查看" variant="primary" size="sm" onPress={onViewDetail} />
            ) : (
              <Button title="跟进" variant="primary" size="sm" onPress={onFollow} />
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: 100, left: Spacing.lg, right: Spacing.lg },
  card: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.card,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  closeButton: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, padding: Spacing.xs, zIndex: 1 },
  title: { fontSize: FontSize.base, fontWeight: '600', color: Colors.text.primary, marginBottom: Spacing.sm, paddingRight: 30 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.md },
  tag: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.sm },
  tagText: { fontSize: 10, fontWeight: '600', color: Colors.text.primary },
  regionTag: { backgroundColor: Colors.text.tertiary },
  infoContainer: { maxHeight: 120 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.sm },
  infoContent: { flex: 1, marginLeft: Spacing.sm },
  infoLabel: { fontSize: FontSize.xs, color: Colors.text.tertiary, marginBottom: 2 },
  infoValue: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.text.primary },
  infoValueGray: { fontSize: FontSize.sm, color: Colors.text.secondary },
  divider: { height: 1, backgroundColor: Colors.border.light, marginVertical: Spacing.md },
  actionsRow: { flexDirection: 'row', alignItems: 'center' },
  actionsRight: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
});
