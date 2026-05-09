import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, getProjectColor, getEnterpriseColor } from '@/constants/colors';
import { Spacing, BorderRadius } from '@/constants/spacing';
import { FontSize } from '@/constants/typography';

interface FilterType {
  id: number;
  name: string;
  key: string;
}

interface MapFilterBarProps {
  types: FilterType[];
  selectedType: number | null;
  onSelectType: (type: number | null) => void;
  mode?: 'project' | 'enterprise';
}

export const MapFilterBar: React.FC<MapFilterBarProps> = ({
  types,
  selectedType,
  onSelectType,
  mode = 'project',
}) => {
  const [expanded, setExpanded] = useState(false);

  const getColor = (id: number) => {
    return mode === 'project' ? getProjectColor(id) : getEnterpriseColor(id);
  };

  const handleToggle = (id: number) => {
    if (selectedType === id) {
      onSelectType(null);
    } else {
      onSelectType(id);
    }
  };

  if (!types || types.length === 0) {
    return null;
  }

  return (
    <View style={styles.verticalWrapper}>
      <View style={[styles.verticalContainer, expanded && styles.verticalContainerExpanded]}>
        {types.map((type) => {
          const isSelected = selectedType === type.id;
          const color = getColor(type.id);
          return (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.verticalItem,
                !expanded && styles.verticalItemCollapsed,
                isSelected && styles.verticalItemActive,
                { borderColor: color },
              ]}
              onPress={() => handleToggle(type.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.colorDot, { backgroundColor: color }]} />
              {expanded && (
                <View style={styles.textContainer}>
                  <Text style={[styles.verticalLabel, isSelected && styles.verticalLabelActive]}>
                    {type.name}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity style={styles.handleButton} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <Text style={styles.handleIcon}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  verticalWrapper: {
    position: 'absolute',
    right: 10,
    top: 100,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  handleButton: {
    backgroundColor: 'rgba(20, 20, 20, 0.9)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -1,
  },
  handleIcon: {
    fontSize: 10,
    color: '#999',
  },
  verticalContainer: {
    backgroundColor: 'rgba(20, 20, 20, 0.9)',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 8,
    gap: 6,
  },
  verticalContainerExpanded: {
    padding: 10,
  },
  verticalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  verticalItemCollapsed: {
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  verticalItemActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  textContainer: {
    alignItems: 'flex-start',
    marginLeft: 8,
  },
  verticalLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
  },
  verticalLabelActive: {
    color: '#fff',
  },
});
