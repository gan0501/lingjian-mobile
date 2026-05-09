import { Platform, TextStyle } from 'react-native';
import { Colors } from './colors';

export const FontFamily = {
  primary: Platform.OS === 'ios' ? 'PingFang SC' : 'Noto Sans SC',
};

export const FontWeight = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
};

export const FontSize = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 14,
  lg: 16,
  xl: 18,
  title: 16,
  body: 14,
  caption: 12,
  tag: 10,
};

export const TextStyles: Record<string, TextStyle> = {
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },

  body: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.regular,
    color: Colors.text.secondary,
  },

  bodySmall: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    color: Colors.text.secondary,
  },

  caption: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.regular,
    color: Colors.text.tertiary,
  },

  tag: {
    fontSize: FontSize.tag,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },

  button: {
    fontSize: 15,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },

  cardTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },

  modalTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Colors.text.modal,
  },

  modalBody: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.regular,
    color: Colors.text.modal,
  },
};

export default TextStyles;
