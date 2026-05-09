import React, { FC } from 'react';
import { Text, StyleSheet, ViewStyle } from 'react-native';

interface AIContentDisclaimerProps {
  style?: ViewStyle;
  text?: string;
}

export const AIContentDisclaimer: FC<AIContentDisclaimerProps> = ({
  style,
  text = '内容由AI生成，注意甄别',
}) => {
  return (
    <Text style={[styles.text, style]}>
      {text}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    fontSize: 8,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 10,
  },
});

export default AIContentDisclaimer;
