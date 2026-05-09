/**
 * GlassBottomSheet - 统一底部弹窗组件（V2）
 *
 * 液态玻璃风格，替代所有 Alert.alert() 和 Modal 中心弹窗。
 *
 * 三种模式：
 *   - preset="alert"   → 提示（标题+描述+确定）
 *   - preset="confirm"  → 确认（标题+描述+取消/确定）
 *   - preset="custom"   → 自定义 children
 *
 * 特性：
 *   - 底部滑入动画
 *   - 拖拽手柄下拉关闭
 *   - 最大高度 80% 屏幕
 *   - 液态玻璃视觉效果
 */
import React, { FC, memo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated,
  Dimensions, PanResponder, TouchableWithoutFeedback, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_HEIGHT = SCREEN_HEIGHT * 0.8;
const DISMISS_THRESHOLD = 80;

// ─── 按钮配置 ───

export interface SheetAction {
  text: string;
  /** 'primary' 黑色填充 | 'secondary' 灰色 | 'destructive' 红色 */
  style?: 'primary' | 'secondary' | 'destructive';
  onPress?: () => void;
}

// ─── Props ───

interface GlassBottomSheetProps {
  visible: boolean;
  onClose: () => void;

  /** 预设模式 */
  preset?: 'alert' | 'confirm' | 'custom';

  /** 标题 */
  title?: string;
  /** 描述文字 */
  message?: string;

  /** 自定义内容 */
  children?: React.ReactNode;

  /** 按钮列表（preset=custom 时也可用） */
  actions?: SheetAction[];

  /** 确认按钮文字（preset=confirm/alert 快捷） */
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;

  /** 是否显示拖拽手柄，默认 true */
  showHandle?: boolean;
  /** 是否显示关闭按钮，默认 false（有标题时才显示） */
  showClose?: boolean;
  /** 点击遮罩关闭，默认 true */
  dismissOnOverlay?: boolean;

  /** 日间/夜间主题 */
  theme?: 'light' | 'dark';
}

export const GlassBottomSheet: FC<GlassBottomSheetProps> = memo(({
  visible, onClose,
  preset = 'custom',
  title, message, children,
  actions,
  confirmText = '确定', cancelText = '取消',
  onConfirm, onCancel,
  showHandle = true, showClose = false,
  dismissOnOverlay = true,
  theme = 'light',
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const isDark = theme === 'dark';
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  // 动画
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, friction: 9, tension: 65, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // 拖拽关闭
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_THRESHOLD || g.vy > 0.5) {
          handleClose();
        } else {
          Animated.spring(translateY, { toValue: 0, friction: 9, tension: 65, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [onClose, translateY, overlayOpacity]);

  const handleConfirm = useCallback(() => {
    onConfirm?.();
    handleClose();
  }, [onConfirm, handleClose]);

  const handleCancel = useCallback(() => {
    onCancel?.();
    handleClose();
  }, [onCancel, handleClose]);

  // 构建 actions
  const resolvedActions: SheetAction[] = actions || (() => {
    if (preset === 'alert') return [{ text: confirmText, style: 'primary' as const, onPress: handleConfirm }];
    if (preset === 'confirm') return [
      { text: cancelText, style: 'secondary' as const, onPress: handleCancel },
      { text: confirmText, style: 'primary' as const, onPress: handleConfirm },
    ];
    return [];
  })();

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <View style={styles.root}>
        {/* 遮罩 */}
        <TouchableWithoutFeedback onPress={dismissOnOverlay ? handleClose : undefined}>
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
        </TouchableWithoutFeedback>

        {/* 弹窗 */}
        <Animated.View style={[
          styles.sheet,
          {
            maxHeight: MAX_HEIGHT,
            paddingBottom: insets.bottom + 16,
            backgroundColor: colors.background,
            borderColor: colors.border,
            transform: [{ translateY }],
          },
        ]}>
          {/* 拖拽手柄 */}
          {showHandle && (
            <View {...panResponder.panHandlers} style={styles.handleArea}>
              <View style={[styles.handle, { backgroundColor: colors.handle }]} />
            </View>
          )}

          {/* 标题栏 */}
          {title && (
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              {showClose && (
                <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <X color={colors.textSecondary} size={20} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* 消息 */}
          {message && (
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          )}

          {/* 自定义内容 */}
          {children}

          {/* 底部按钮 */}
          {resolvedActions.length > 0 && (
            <View style={styles.actionsRow}>
              {resolvedActions.map((action, idx) => {
                const btnStyle = action.style === 'primary' ? [styles.btn, styles.btnPrimary, { backgroundColor: colors.btnPrimary }]
                  : action.style === 'destructive' ? [styles.btn, styles.btnDestructive]
                  : [styles.btn, styles.btnSecondary, { backgroundColor: colors.btnSecondary }];

                const textStyle = action.style === 'primary' ? [styles.btnText, { color: colors.btnPrimaryText }]
                  : action.style === 'destructive' ? [styles.btnText, { color: '#fff' }]
                  : [styles.btnText, { color: colors.text }];

                return (
                  <TouchableOpacity
                    key={idx}
                    style={btnStyle}
                    onPress={() => { action.onPress?.(); }}
                    activeOpacity={0.7}
                  >
                    <Text style={textStyle}>{action.text}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
});

// ─── 主题色 ───

const LIGHT_COLORS = {
  background: 'rgba(255, 255, 255, 0.96)',
  border: 'rgba(0, 0, 0, 0.06)',
  handle: 'rgba(0, 0, 0, 0.12)',
  text: '#1a1a1a',
  textSecondary: '#666',
  btnPrimary: '#111827',
  btnPrimaryText: '#fff',
  btnSecondary: '#F2F3F7',
};

const DARK_COLORS = {
  background: 'rgba(30, 30, 30, 0.96)',
  border: 'rgba(255, 255, 255, 0.08)',
  handle: 'rgba(255, 255, 255, 0.2)',
  text: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.6)',
  btnPrimary: '#ffffff',
  btnPrimaryText: '#111827',
  btnSecondary: 'rgba(255, 255, 255, 0.1)',
};

// ─── 样式 ───

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    // 液态玻璃阴影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    padding: 4,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimary: {},
  btnSecondary: {},
  btnDestructive: {
    backgroundColor: '#EF4444',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default GlassBottomSheet;
