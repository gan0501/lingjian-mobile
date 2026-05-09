import React, { FC, memo } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ViewStyle, TextStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Loading } from '@/components/common/Loading';

interface GradientButtonProps {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  gradientColors?: string[];
}

export const GradientButton: FC<GradientButtonProps> = memo(({
  title, onPress, disabled = false, loading = false,
  icon, fullWidth = false, style, textStyle,
  gradientColors = ['#000000', '#000000', '#000000'],
}) => {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.button, fullWidth && styles.fullWidth, isDisabled && styles.disabled, style]}
      activeOpacity={0.8}
    >
      <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
        <View style={styles.highlight} />
        {loading ? (
          <Loading size="small" color="#FFFFFF" />
        ) : (
          <>
            {icon}
            <Text style={[styles.text, icon && styles.textWithIcon, textStyle]}>{title}</Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  button: { flexDirection: 'row', borderRadius: 25, height: 50, padding: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#000000', overflow: 'hidden' },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  gradient: { flex: 1, borderRadius: 25, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', height: 42, flexDirection: 'row', gap: 8 },
  highlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  text: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', lineHeight: 18 },
  textWithIcon: { marginLeft: 4 },
});

export default GradientButton;
