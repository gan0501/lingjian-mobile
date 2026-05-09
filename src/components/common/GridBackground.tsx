import React from 'react';
import { View, StyleSheet } from 'react-native';

const GRID_SIZE = 30;

export const GridBackground: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.gridContainer}>
        {Array.from({ length: 50 }).map((_, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.gridRow}>
            {Array.from({ length: 20 }).map((_, colIndex) => (
              <View key={`cell-${rowIndex}-${colIndex}`} style={styles.gridCell} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  gridContainer: {
    flex: 1,
  },
  gridRow: {
    flexDirection: 'row',
    height: GRID_SIZE,
  },
  gridCell: {
    width: GRID_SIZE,
    height: GRID_SIZE,
    borderWidth: 0.3,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
});
