import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MapPin, Phone, Award } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius } from '@/constants/spacing';
import { FontSize } from '@/constants/typography';

interface EnterpriseCardProps {
  name: string;
  type: string;
  typeColor: string;
  qualification?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
  isVip?: boolean;
  onPress?: () => void;
}

export const EnterpriseCard: React.FC<EnterpriseCardProps> = ({
  name,
  type,
  typeColor,
  qualification,
  address,
  phone,
  logoUrl,
  isVip = false,
  onPress,
}) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.logo} />
        ) : (
          <View style={[styles.logoPlaceholder, { backgroundColor: typeColor }]}>
            <Text style={styles.logoText}>{name.charAt(0)}</Text>
          </View>
        )}
        <View style={styles.headerRight}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            {isVip && <Award color="#FFD700" size={14} />}
          </View>
          <View style={[styles.typeTag, { backgroundColor: typeColor }]}>
            <Text style={styles.typeText}>{type}</Text>
          </View>
        </View>
      </View>

      {qualification && (
        <Text style={styles.qualification} numberOfLines={2}>{qualification}</Text>
      )}

      <View style={styles.footer}>
        {address && (
          <View style={styles.footerItem}>
            <MapPin color={Colors.text.tertiary} size={12} />
            <Text style={styles.footerText} numberOfLines={1}>{address}</Text>
          </View>
        )}
        {phone && (
          <View style={styles.footerItem}>
            <Phone color={Colors.text.tertiary} size={12} />
            <Text style={styles.footerText}>{phone}</Text>
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
  logo: { width: 48, height: 48, borderRadius: BorderRadius.sm, marginRight: Spacing.md },
  logoPlaceholder: { width: 48, height: 48, borderRadius: BorderRadius.sm, marginRight: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 20, fontWeight: 'bold', color: Colors.text.primary },
  headerRight: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  name: { fontSize: FontSize.base, fontWeight: '600', color: Colors.text.primary, flex: 1, marginRight: Spacing.xs },
  typeTag: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm, alignSelf: 'flex-start' },
  typeText: { fontSize: 10, fontWeight: '600', color: Colors.text.primary },
  qualification: { fontSize: FontSize.xs, color: Colors.text.secondary, marginBottom: Spacing.sm, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  footerText: { fontSize: FontSize.xs, color: Colors.text.tertiary, marginLeft: Spacing.xs },
});
