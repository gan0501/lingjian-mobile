import React, { FC, useCallback, useEffect, useState } from 'react';
import { Alert, View, Text, Modal, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

interface CustomAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
  visible: boolean;
  title?: string;
  message?: string;
  buttons?: CustomAlertButton[];
  onDismiss?: () => void;
  cancelable?: boolean;
  theme?: 'day' | 'night';
  variant?: 'default' | 'enterprise' | 'system';
}

interface CustomAlertOpenOptions {
  title?: string;
  message?: string;
  buttons?: CustomAlertButton[];
  onDismiss?: () => void;
  cancelable?: boolean;
  theme?: 'day' | 'night';
  variant?: 'default' | 'enterprise' | 'system';
}

let openCustomAlert: ((options: CustomAlertOpenOptions) => void) | null = null;
let originalAlertAlert: typeof Alert.alert | null = null;

export const CustomAlert: FC<CustomAlertProps> = ({
  visible, title, message, buttons = [{ text: '确定', style: 'default' }],
  onDismiss, cancelable = true, theme = 'day', variant = 'default',
}) => {
  const isDayTheme = theme === 'day';

  const getButtonColor = () => {
    if (variant === 'system') return '#1a1a1a';
    if (variant === 'enterprise') return '#2563eb';
    return '#B20000';
  };

  const buttonColor = getButtonColor();

  const handleButtonPress = (button: CustomAlertButton) => {
    button.onPress?.();
    onDismiss?.();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={cancelable ? onDismiss : undefined}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={cancelable ? onDismiss : undefined}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.alertContainer, isDayTheme ? styles.alertContainerDay : styles.alertContainerNight]}>
            <View style={styles.content}>
              {title && <Text style={[styles.title, isDayTheme && styles.titleDay]}>{title}</Text>}
              {message && <Text style={[styles.message, isDayTheme && styles.messageDay]}>{message}</Text>}
              <View style={styles.buttonContainer}>
                {buttons.map((button, index) => {
                  const isDefaultBtn = !button.style || button.style === 'default';
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        button.style === 'cancel' && [styles.cancelButton, isDayTheme && styles.cancelButtonDay],
                        button.style === 'destructive' && styles.destructiveButton,
                        isDefaultBtn && isDayTheme && { backgroundColor: buttonColor, borderColor: buttonColor },
                        buttons.length === 1 && styles.singleButton,
                      ]}
                      onPress={() => handleButtonPress(button)}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.buttonText,
                        button.style === 'cancel' && [styles.cancelButtonText, isDayTheme && styles.cancelButtonTextDay],
                        button.style === 'destructive' && styles.destructiveButtonText,
                        isDefaultBtn && isDayTheme && styles.buttonTextDay,
                      ]}>
                        {button.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export const showAlert = (
  titleOrOptions: string | CustomAlertOpenOptions,
  message?: string,
  buttons?: CustomAlertButton[],
): Promise<void> => {
  return new Promise((resolve) => {
    if (!openCustomAlert) { resolve(); return; }
    if (typeof titleOrOptions === 'object' && titleOrOptions !== null) {
      openCustomAlert({
        ...titleOrOptions,
        onDismiss: () => { titleOrOptions.onDismiss?.(); resolve(); },
      });
    } else {
      openCustomAlert({ title: titleOrOptions, message, buttons, onDismiss: resolve });
    }
  });
};

export const showSystemAlert = (
  titleOrOptions: string | CustomAlertOpenOptions,
  message?: string,
  buttons?: CustomAlertButton[],
): Promise<void> => {
  return new Promise((resolve) => {
    if (!openCustomAlert) { resolve(); return; }
    if (typeof titleOrOptions === 'object' && titleOrOptions !== null) {
      openCustomAlert({
        ...titleOrOptions,
        variant: 'system',
        onDismiss: () => { titleOrOptions.onDismiss?.(); resolve(); },
      });
    } else {
      openCustomAlert({ title: titleOrOptions, message, buttons, variant: 'system', onDismiss: resolve });
    }
  });
};

export const CustomAlertProvider: FC<React.PropsWithChildren & { theme?: 'day' | 'night' }> = ({ children, theme = 'day' }) => {
  const [state, setState] = useState<{
    visible: boolean; title?: string; message?: string;
    buttons?: CustomAlertButton[]; onDismiss?: () => void;
    cancelable?: boolean; alertTheme?: 'day' | 'night';
    variant?: 'default' | 'enterprise' | 'system';
  }>({ visible: false });

  const handleDismiss = useCallback(() => {
    const onDismiss = state.onDismiss;
    setState({ visible: false });
    onDismiss?.();
  }, [state.onDismiss]);

  const open = useCallback((options: CustomAlertOpenOptions) => {
    setState({
      visible: true, title: options.title, message: options.message,
      buttons: options.buttons, onDismiss: options.onDismiss,
      cancelable: options.cancelable, alertTheme: options.theme || theme,
      variant: options.variant || 'default',
    });
  }, [theme]);

  useEffect(() => {
    openCustomAlert = open;
    return () => { if (openCustomAlert === open) openCustomAlert = null; };
  }, [open]);

  useEffect(() => {
    if (!originalAlertAlert) originalAlertAlert = Alert.alert;
    const patchedAlert = (title: any, message?: any, buttons?: any, options?: any) => {
      if (!openCustomAlert) return originalAlertAlert?.(title, message, buttons, options);
      const normalizedButtons: CustomAlertButton[] = Array.isArray(buttons) && buttons.length > 0
        ? buttons.map((b: any) => ({ text: b?.text ?? '确定', onPress: b?.onPress, style: b?.style }))
        : [{ text: '确定', style: 'default' }];
      openCustomAlert({
        title: title === undefined || title === null ? undefined : String(title),
        message: message === undefined || message === null ? undefined : typeof message === 'string' ? message : String(message),
        buttons: normalizedButtons, onDismiss: options?.onDismiss, cancelable: options?.cancelable !== false,
      });
    };
    (Alert as any).alert = patchedAlert;
    return () => { if (originalAlertAlert) (Alert as any).alert = originalAlertAlert; };
  }, [open]);

  return (
    <>
      {children}
      <CustomAlert
        visible={state.visible} title={state.title} message={state.message}
        buttons={state.buttons} onDismiss={handleDismiss}
        cancelable={state.cancelable} theme={state.alertTheme || theme}
        variant={state.variant}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  alertContainer: { width: width * 0.75, borderRadius: 16, overflow: 'hidden' },
  alertContainerNight: { backgroundColor: 'rgba(28, 20, 45, 0.98)', borderWidth: 1, borderColor: 'rgba(192, 132, 252, 0.3)' },
  alertContainerDay: { backgroundColor: '#ffffff', borderWidth: 0, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  content: { padding: 20 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 12, textAlign: 'center' },
  titleDay: { color: '#1a1a1a' },
  message: { fontSize: 14, color: 'rgba(255, 255, 255, 0.8)', marginBottom: 20, textAlign: 'center', lineHeight: 20 },
  messageDay: { color: '#555555' },
  buttonContainer: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, backgroundColor: 'rgba(192, 132, 252, 0.2)', borderWidth: 1, borderColor: 'rgba(192, 132, 252, 0.4)', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonDay: { backgroundColor: '#B20000', borderColor: '#B20000' },
  singleButton: { flex: 1 },
  cancelButton: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' },
  cancelButtonDay: { backgroundColor: '#E5E5E5', borderColor: '#E5E5E5' },
  destructiveButton: { backgroundColor: 'rgba(220, 38, 38, 0.2)', borderColor: 'rgba(220, 38, 38, 0.4)' },
  buttonText: { color: '#C084FC', fontSize: 16, fontWeight: '600' },
  buttonTextDay: { color: '#ffffff' },
  cancelButtonText: { color: 'rgba(255, 255, 255, 0.6)' },
  cancelButtonTextDay: { color: '#666666' },
  destructiveButtonText: { color: '#F87171' },
});
