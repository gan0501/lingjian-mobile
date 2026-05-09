import React, { FC, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { ChevronLeft } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius } from '@/constants/spacing';
import { FontSize } from '@/constants/typography';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightIcon?: React.ReactNode;
  onRightPress?: () => void;
  rightContent?: React.ReactNode;
  transparent?: boolean;
  gradient?: boolean;
  backgroundColor?: string;
  titleColor?: string;
  iconColor?: string;
}

export const Header: FC<HeaderProps> = memo(({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightIcon,
  onRightPress,
  rightContent,
  transparent = false,
  gradient = false,
  backgroundColor,
  titleColor,
  iconColor,
}) => {
  const insets = useSafeAreaInsets();

  const defaultIconColor = transparent || gradient ? '#FFFFFF' : Colors.text.primary;
  const defaultTitleColor = transparent || gradient ? '#FFFFFF' : Colors.text.primary;

  const headerContent = (
    <>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.content}>
        <View style={styles.left}>
          {showBack && (
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <ChevronLeft color={iconColor || defaultIconColor} size={24} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.center}>
          {title && <Text style={[styles.title, titleColor && { color: titleColor }]} numberOfLines={1}>{title}</Text>}
          {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>
        <View style={styles.right}>
          {rightIcon && onRightPress && (
            <TouchableOpacity onPress={onRightPress} style={styles.iconButton}>
              {rightIcon}
            </TouchableOpacity>
          )}
          {rightContent}
        </View>
      </View>
    </>
  );

  if (gradient) {
    return (
      <LinearGradient
        colors={['#80011A', '#A0152D', '#80011A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradientContainer, { paddingTop: insets.top }]}
      >
        {headerContent}
      </LinearGradient>
    );
  }

  return (
    <View
      style={StyleSheet.flatten([
        styles.container,
        { paddingTop: insets.top },
        transparent ? styles.transparent : {},
        backgroundColor ? { backgroundColor } : {},
      ])}
    >
      {headerContent}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  gradientContainer: {
    borderBottomWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  transparent: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  content: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  left: {
    width: 48,
    alignItems: 'flex-start',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  right: {
    width: 48,
    alignItems: 'flex-end',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
});
