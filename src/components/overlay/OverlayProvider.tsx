/**
 * OverlayProvider - 全局覆盖层状态管理（V2）
 *
 * 使用方式：
 *   1. 在 App.tsx 中包裹 <OverlayProvider>
 *   2. 任何组件内调用 useOverlay() 获取：
 *      - toast.success('保存成功')
 *      - toast.error('操作失败')
 *      - toast.loading('加载中...')
 *      - confirm({ title: '确认', message: '是否删除？', onConfirm: ... })
 *      - alert({ title: '提示', message: '操作完成' })
 *      - sheet({ title: '分享', children: <ShareContent /> })
 */
import React, { createContext, useContext, useState, useCallback, FC, useRef } from 'react';
import { GlassBottomSheet, SheetAction } from './GlassBottomSheet';
import { GlassToast, ToastType } from './GlassToast';

// ─── Toast API ───

interface ToastState {
  visible: boolean;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastAPI {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  loading: (message: string) => void;
  info: (message: string, duration?: number) => void;
  dismiss: () => void;
}

// ─── Sheet API ───

interface SheetConfig {
  title?: string;
  message?: string;
  preset?: 'alert' | 'confirm' | 'custom';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  actions?: SheetAction[];
  children?: React.ReactNode;
  showClose?: boolean;
  dismissOnOverlay?: boolean;
  theme?: 'light' | 'dark';
}

interface SheetAPI {
  show: (config: SheetConfig) => void;
  hide: () => void;
}

// ─── 便捷入口 ───

interface OverlayAPI {
  toast: ToastAPI;
  sheet: SheetAPI;
  confirm: (config: { title?: string; message: string; confirmText?: string; cancelText?: string; onConfirm?: () => void; onCancel?: () => void; theme?: 'light' | 'dark' }) => void;
  alert: (config: { title?: string; message: string; confirmText?: string; onConfirm?: () => void; theme?: 'light' | 'dark' }) => void;
}

const OverlayContext = createContext<OverlayAPI | null>(null);
const ToastStateContext = createContext<ToastState | null>(null);

export const useOverlay = (): OverlayAPI => {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error('useOverlay must be used within OverlayProvider');
  return ctx;
};

export const useToastState = (): ToastState => {
  const ctx = useContext(ToastStateContext);
  if (!ctx) throw new Error('useToastState must be used within OverlayProvider');
  return ctx;
};

export const InModalToast: FC<{ theme?: 'light' | 'dark' }> = ({ theme = 'light' }) => {
  const toastState = useToastState();
  return (
    <GlassToast
      visible={toastState.visible}
      type={toastState.type}
      message={toastState.message}
      duration={toastState.duration}
      onDismiss={() => {}}
      theme={theme}
    />
  );
};

// ─── Provider ───

export const OverlayProvider: FC<{ children: React.ReactNode; theme?: 'light' | 'dark' }> = ({
  children, theme = 'light',
}) => {
  // Toast state
  const [toastState, setToastState] = useState<ToastState>({
    visible: false, type: 'info', message: '', duration: 2000,
  });

  // Sheet state
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetConfig, setSheetConfig] = useState<SheetConfig>({});
  const sheetChildrenRef = useRef<React.ReactNode>(null);

  // Toast API
  const toast: ToastAPI = {
    success: useCallback((message: string, duration = 2000) => {
      setToastState({ visible: true, type: 'success', message, duration });
    }, []),
    error: useCallback((message: string, duration = 3000) => {
      setToastState({ visible: true, type: 'error', message, duration });
    }, []),
    loading: useCallback((message: string) => {
      setToastState({ visible: true, type: 'loading', message, duration: 0 });
    }, []),
    info: useCallback((message: string, duration = 2000) => {
      setToastState({ visible: true, type: 'info', message, duration });
    }, []),
    dismiss: useCallback(() => {
      setToastState(prev => ({ ...prev, visible: false }));
    }, []),
  };

  // Sheet API
  const sheet: SheetAPI = {
    show: useCallback((config: SheetConfig) => {
      sheetChildrenRef.current = config.children || null;
      setSheetConfig(config);
      setSheetVisible(true);
    }, []),
    hide: useCallback(() => {
      setSheetVisible(false);
    }, []),
  };

  // 便捷方法
  const confirm = useCallback((config: Parameters<OverlayAPI['confirm']>[0]) => {
    setSheetConfig({
      preset: 'confirm',
      title: config.title || '确认',
      message: config.message,
      confirmText: config.confirmText,
      cancelText: config.cancelText,
      onConfirm: config.onConfirm,
      onCancel: config.onCancel,
      theme: config.theme,
    });
    sheetChildrenRef.current = null;
    setSheetVisible(true);
  }, []);

  const alert = useCallback((config: Parameters<OverlayAPI['alert']>[0]) => {
    setSheetConfig({
      preset: 'alert',
      title: config.title || '提示',
      message: config.message,
      confirmText: config.confirmText,
      onConfirm: config.onConfirm,
      theme: config.theme,
    });
    sheetChildrenRef.current = null;
    setSheetVisible(true);
  }, []);

  const api: OverlayAPI = { toast, sheet, confirm, alert };

  return (
    <OverlayContext.Provider value={api}>
      <ToastStateContext.Provider value={toastState}>
        {children}

        <GlassBottomSheet
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
          preset={sheetConfig.preset}
          title={sheetConfig.title}
          message={sheetConfig.message}
          confirmText={sheetConfig.confirmText}
          cancelText={sheetConfig.cancelText}
          onConfirm={sheetConfig.onConfirm}
          onCancel={sheetConfig.onCancel}
          actions={sheetConfig.actions}
          showClose={sheetConfig.showClose}
          dismissOnOverlay={sheetConfig.dismissOnOverlay}
          theme={sheetConfig.theme || theme}
        >
          {sheetChildrenRef.current}
        </GlassBottomSheet>

        <GlassToast
          visible={toastState.visible}
          type={toastState.type}
          message={toastState.message}
          duration={toastState.duration}
          onDismiss={() => setToastState(prev => ({ ...prev, visible: false }))}
          theme={theme}
        />
      </ToastStateContext.Provider>
    </OverlayContext.Provider>
  );
};

export default OverlayProvider;
