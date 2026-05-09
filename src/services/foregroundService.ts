/**
 * Android 前台服务 - 后台生成进度通知
 * 用于在 App 后台运行时显示标书生成进度
 * 使用 @supersami/rn-foreground-service 库
 */
import { Platform, PermissionsAndroid, Alert, DeviceEventEmitter } from 'react-native';
import { bidWriterApi } from '@/services/bidWriter';
import { useMessageStore } from '@/stores/useMessageStore';

const REGISTER_GUARD_KEY = '__lingjian_foreground_service_registered__';
const LISTENER_GUARD_KEY = '__lingjian_foreground_service_listener__';
const NOTIFICATION_ID = 1001;

let currentBidIdForLog: string | null = null;

let ReactNativeForegroundService: any = null;

// 前台服务任务循环器
const taskRunner = async () => {
  try {
    // 任务循环逻辑由库内部处理，这里只是占位
  } catch (error) {
    console.log('[ForegroundService] Task runner error:', error);
  }
};

if (Platform.OS === 'android') {
  try {
    const mod = require('@supersami/rn-foreground-service');
    ReactNativeForegroundService = mod?.default ?? mod;
    console.log('[ForegroundService] 库加载成功:', Object.keys(ReactNativeForegroundService || {}));

    const g: any = globalThis as any;
    if (!g?.[LISTENER_GUARD_KEY]) {
      g[LISTENER_GUARD_KEY] = true;
      DeviceEventEmitter.addListener('onServiceError', (message: any) => {
        console.warn('[ForegroundService] onServiceError event:', message);
        void bidWriterApi
          .clientLog({
            level: 'error',
            event: 'foreground_service_onServiceError_event',
            bid_id: currentBidIdForLog,
            ts: new Date().toISOString(),
            platform: Platform.OS,
            payload: { message },
          })
          .catch(() => {});
      });
      console.log('[ForegroundService] DeviceEventEmitter onServiceError listener 已注册');

      try {
        const eventListener = ReactNativeForegroundService?.eventListener;
        if (eventListener && typeof eventListener?.on === 'function') {
          eventListener.on('onServiceError', (payload: any) => {
            console.warn('[ForegroundService] eventListener onServiceError:', payload);
            void bidWriterApi
              .clientLog({
                level: 'error',
                event: 'foreground_service_onServiceError_listener',
                bid_id: currentBidIdForLog,
                ts: new Date().toISOString(),
                platform: Platform.OS,
                payload: { payload },
              })
              .catch(() => {});
          });
          console.log('[ForegroundService] ForegroundService.eventListener onServiceError listener 已注册');
        }
      } catch (e) {
        console.warn('[ForegroundService] 注册 eventListener 失败:', e);
      }
    }
    if (!g?.[REGISTER_GUARD_KEY] && typeof ReactNativeForegroundService?.register === 'function') {
      g[REGISTER_GUARD_KEY] = true;
      ReactNativeForegroundService.register({
        config: {
          alert: false,
          onServiceErrorCallBack: (...args: any[]) => {
            console.warn('[ForegroundService] Service Error callback triggered', ...args);
            void bidWriterApi
              .clientLog({
                level: 'error',
                event: 'foreground_service_onServiceError_callback',
                bid_id: currentBidIdForLog,
                ts: new Date().toISOString(),
                platform: Platform.OS,
                payload: { args },
              })
              .catch(() => {});
          },
        },
      });
      console.log('[ForegroundService] register 已执行');
    }
  } catch (e) {
    console.warn('[ForegroundService] 库加载失败:', e);
  }
} else {
  console.log('[ForegroundService] iOS平台，跳过前台服务初始化');
}

class ForegroundServiceManager {
  private _isRunning = false;
  private totalSections = 0;
  private currentTitle = '';
  private currentBidId: string | null = null;
  private lastPercent: number | null = null;
  private lastPercentUpdatedAt = 0;
  private lastPercentMessage: string | null = null;

  private reportError(event: string, payload: any) {
    const bidId = this.currentBidId;
    if (bidId) {
      void bidWriterApi
        .clientLog({
          level: 'error',
          event,
          bid_id: bidId,
          ts: new Date().toISOString(),
          platform: Platform.OS,
          payload,
        })
        .catch(() => {});
    }
  }

  private async checkNotificationPermission(): Promise<boolean> {
    if (Platform.OS === 'ios') return true;
    if (Platform.Version < 33) return true;
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return granted;
  }

  private async requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS === 'ios') return true;
    if (Platform.Version < 33) return true;
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('[ForegroundService] 请求通知权限失败:', error);
      return false;
    }
  }

  public async startService(title: string, totalSections: number, forceRestart: boolean = false): Promise<void> {
    if (!ReactNativeForegroundService) {
      console.warn('[ForegroundService] 库未加载');
      return;
    }
    const hasPermission = await this.checkNotificationPermission();
    if (!hasPermission) {
      console.warn('[ForegroundService] 无通知权限');
      await this.requestNotificationPermission();
    }

    if (this._isRunning && !forceRestart) {
      console.log('[ForegroundService] 已在运行中');
      return;
    }

    // 如果强制重启，先停止当前服务
    if (this._isRunning && forceRestart) {
      console.log('[ForegroundService] 强制重启服务');
      await this.stop();
    }

    this.currentTitle = title;
    this.totalSections = totalSections;
    this._isRunning = true;
    currentBidIdForLog = this.currentBidId;

    console.log('[ForegroundService] 启动服务:', { title, totalSections });

    await ReactNativeForegroundService.start({
      id: NOTIFICATION_ID,
      title: `${title} - 生成进度`,
      message: '正在生成内容，请稍候...',
      importance: 'max',
      // @ts-ignore
      ServiceType: 'dataSync',
    });

    await ReactNativeForegroundService.update({
      id: NOTIFICATION_ID,
      title: `${title} - 生成进度`,
      message: `共 ${totalSections} 部分，正在生成第 1 部分...`,
      importance: 'max',
      // @ts-ignore
      ServiceType: 'dataSync',
    });
    console.log('[ForegroundService] 服务启动成功');
  }

  public async updateProgress(completed: number, total: number): Promise<void> {
    if (!ReactNativeForegroundService) {
      console.warn('[ForegroundService] 库未加载');
      return;
    }

    if (!this._isRunning) return;

    if (completed >= total) {
      await this.completeService(0);
      return;
    }

    const percentage = Math.round((completed / total) * 100);
    const message = `共 ${total} 部分，正在生成第 ${completed + 1} 部分...`;

    console.log('[ForegroundService] 进度更新:', { completed, total, percentage });

    await ReactNativeForegroundService.update({
      id: NOTIFICATION_ID,
      title: `${this.currentTitle} - 生成进度`,
      message,
      importance: 'max',
      // @ts-ignore
      ServiceType: 'dataSync',
      progress: { max: total, curr: completed },
    });
  }

  public async updatePercentage(percentage: number, message: string): Promise<void> {
    if (!ReactNativeForegroundService) {
      console.warn('[ForegroundService] 库未加载');
      return;
    }

    if (!this._isRunning) return;

    const now = Date.now();
    const messageChanged = message !== this.lastPercentMessage;
    const timeThreshold = now - this.lastPercentUpdatedAt >= 5000;
    const percentageChanged = percentage !== this.lastPercent;

    if ((messageChanged || timeThreshold || percentageChanged) && percentage > 0) {
      this.lastPercent = percentage;
      this.lastPercentUpdatedAt = now;
      this.lastPercentMessage = message;

      const progress = Math.round((percentage / 100) * this.totalSections);
      const displayMessage = message || `共 ${this.totalSections} 部分，正在生成第 ${progress + 1} 部分...`;

      console.log('[ForegroundService] 按百分比更新:', { percentage, progress, message });

      await ReactNativeForegroundService.update({
        id: NOTIFICATION_ID,
        title: `${this.currentTitle} - 生成进度`,
        message: displayMessage,
        importance: 'max',
        // @ts-ignore
        ServiceType: 'dataSync',
        progress: { max: 100, curr: percentage },
      });
    }
  }

  public setBidContext(bidId: string | null): void {
    this.currentBidId = bidId;
    currentBidIdForLog = bidId;
  }

  public async completeService(chars: number): Promise<void> {
    if (!ReactNativeForegroundService) {
      console.warn('[ForegroundService] 库未加载');
      return;
    }

    if (!this._isRunning) return;

    const title = this.currentTitle || '智能体任务';
    const body = chars > 0 ? `已完成，共生成约 ${chars} 字` : '内容生成完成';
    console.log('[ForegroundService] 完成通知:', { title, chars });

    await ReactNativeForegroundService.update({
      id: NOTIFICATION_ID,
      title: `${title} - 生成完成`,
      message: body,
      importance: 'max',
      // @ts-ignore
      ServiceType: 'dataSync',
    });

    // 同步到消息中心，触发桌面角标
    try {
      useMessageStore.getState().addLocalMessage({
        title: `${title} - 生成完成`,
        content: `${body}，可在「牛马视窗」中查看。`,
        category: 'system',
      });
    } catch (e) {
      console.warn('[ForegroundService] 添加消息中心失败:', e);
    }

    setTimeout(() => {
      this.stop();
    }, 3000);
  }

  public async failService(message: string): Promise<void> {
    if (!ReactNativeForegroundService) {
      console.warn('[ForegroundService] 库未加载');
      return;
    }

    if (!this._isRunning) return;

    const title = this.currentTitle || '智能体任务';
    const msg = String(message || '生成失败');
    console.log('[ForegroundService] 失败通知:', { title, message: msg });

    await ReactNativeForegroundService.update({
      id: NOTIFICATION_ID,
      title: `${title} - 生成失败`,
      message: msg,
      importance: 'max',
      // @ts-ignore
      ServiceType: 'dataSync',
    });

    // 同步到消息中心，触发桌面角标
    try {
      useMessageStore.getState().addLocalMessage({
        title: `${title} - 生成失败`,
        content: msg,
        category: 'system',
      });
    } catch (e) {
      console.warn('[ForegroundService] 添加消息中心失败:', e);
    }

    setTimeout(() => {
      this.stop();
    }, 3500);
  }

  public stop(): void {
    if (!ReactNativeForegroundService) {
      console.warn('[ForegroundService] 库未加载');
      return;
    }

    this._isRunning = false;
    this.lastPercent = null;
    this.lastPercentUpdatedAt = 0;
    this.lastPercentMessage = null;
    currentBidIdForLog = null;

    ReactNativeForegroundService.stop();
    console.log('[ForegroundService] 服务已停止');
  }
}

export const foregroundService = new ForegroundServiceManager();
