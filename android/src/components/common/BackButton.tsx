import React, { FC, memo } from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

interface BackButtonProps {
  onPress: () => void;
  size?: number;
  iconSize?: number;
  color?: string;
  backgroundColor?: string;
  style?: ViewStyle;
}

export const BackButton: FC<BackButtonProps> = memo(({
  onPress,
  size = 40,
  iconSize = 24,
  color = '#fff',
  backgroundColor = 'rgba(0,0,0,0.5)',
  style,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.backButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <ChevronLeft size={iconSize} color={color} />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
