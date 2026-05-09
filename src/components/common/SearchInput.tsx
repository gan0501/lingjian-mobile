import React, { useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Search, Mic, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius } from '@/constants/spacing';
import { FontSize } from '@/constants/typography';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  onVoicePress?: () => void;
  placeholder?: string;
  loading?: boolean;
  showVoice?: boolean;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChangeText,
  onSubmit,
  onVoicePress,
  placeholder = '搜索...',
  loading = false,
  showVoice = true,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, isFocused && styles.containerFocused]}>
      <Search color={Colors.text.tertiary} size={20} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={Colors.text.tertiary}
        returnKeyType="search"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {loading ? (
        <ActivityIndicator size="small" color={Colors.primary[500]} />
      ) : value.length > 0 ? (
        <TouchableOpacity onPress={() => onChangeText('')} style={styles.iconButton}>
          <X color={Colors.text.tertiary} size={18} />
        </TouchableOpacity>
      ) : showVoice && onVoicePress ? (
        <TouchableOpacity onPress={onVoicePress} style={styles.iconButton}>
          <Mic color={Colors.text.secondary} size={20} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  containerFocused: { borderColor: Colors.primary[500] },
  input: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: FontSize.base,
    color: Colors.text.primary,
    paddingVertical: 0,
  },
  iconButton: { padding: Spacing.xs },
});
