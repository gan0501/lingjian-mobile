import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/colors';

interface ClusterMarkerProps {
  id: string;
  count: number;
  type: number;
  onPress?: (id: string) => void;
}

const TYPE_COLORS: Record<number, string> = {
  1: '#FF6B6B',
  2: '#4ECDC4',
  3: '#45B7D1',
  4: '#96CEB4',
};

export const ClusterMarker: React.FC<ClusterMarkerProps> = ({ id, count, type, onPress }) => {
  const color = TYPE_COLORS[type] || '#999';
  const size = count >= 1000 ? 56 : count >= 100 ? 44 : 36;
  const fontSize = count >= 1000 ? 14 : 12;

  return (
    <TouchableOpacity
      style={[styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}
      onPress={() => onPress?.(id)}
      activeOpacity={0.8}
    >
      <Text style={[styles.count, { fontSize }]}>
        {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  count: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
});
