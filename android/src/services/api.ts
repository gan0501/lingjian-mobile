import { Alert } from 'react-native';
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores';
import { API_CONFIG } from '@/constants/config';
import { navigationRef } from '@/navigation/RootNavigator';
import { showSystemAlert } from '@/components/common/CustomAlert';

const API_BASE_URL = API_CONFIG.BASE_URL;
const API_TIMEOUT = API_CONFIG.TIMEOUT;

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];
let authAlertShowing = false;

const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
};

const showAuthExpiredAlert = (message: string) => {
  if (authAlertShowing) return;
  authAlertShowing = true;
  showSystemAlert(
    '登录已过期',
    message,
    [
      {
        text: '去登录',
        onPress: () => {
          authAlertShowing = false;
          useAuthStore.getState().logout();
          if (navigationRef.isReady()) {
            navigationRef.navigate('Login');
          }
        },
      },
    ]
  ).then(() => { authAlertShowing = false; });
};

const refreshAccessToken = async (): Promise<string | null> => {
  const { refreshToken, setTokens } = useAuthStore.getState();
  if (!refreshToken) return null;

  try {
    const response = await axios.post(`${API_BASE_URL}/api/auth/refresh-token`, {
      refresh_token: refreshToken,
    });

    if (response.data?.code === 200 && response.data?.result) {
      const { token, refresh_token, expires_at } = response.data.result;
      setTokens(token, refresh_token, expires_at);
      return token;
    }
    return null;
  } catch {
    return null;
  }
};

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (config.url?.includes('/refresh-token')) return config;

    console.log('[API请求]', config.method?.toUpperCase(), config.baseURL + config.url);

    const { token } = useAuthStore.getState();
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    const data = response.data;

    if (response.config.responseType === 'arraybuffer' || response.config.responseType === 'blob') {
      return response;
    }

    if (data && typeof data === 'object' && 'code' in data) {
      if (data.code === 200) return data.result;
      const errMsg = data.message || '请求失败';
      if (data.code === 401 || /其他设备登录|强制下线|token.*过期|token.*invalid/i.test(errMsg)) {
        showAuthExpiredAlert(errMsg.includes('其他设备') || errMsg.includes('强制下线')
          ? '您的账号已在其他设备登录，已被强制下线，请重新登录'
          : '您的登录状态已失效，请重新登录');
        return Promise.reject(new Error(errMsg));
      }
      return Promise.reject(new Error(errMsg));
    }

    return data;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const errMsg = (error.response?.data as any)?.message || (error.response?.data as any)?.detail || error.message || '';

    if (status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/refresh-token')) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await refreshAccessToken();
        isRefreshing = false;

        if (newToken) {
          onTokenRefreshed(newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } else {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      const isKicked = /其他设备登录|强制下线/i.test(errMsg);
      showAuthExpiredAlert(
        isKicked
          ? '您的账号已在其他设备登录，已被强制下线，请重新登录'
          : '您的登录状态已失效，请重新登录'
      );
      return Promise.reject(new Error(errMsg || '登录已过期，请重新登录'));
    }

    const message = errMsg || '网络错误';
    const apiError: any = new Error(message);
    apiError.status = status;
    apiError.data = error.response?.data;
    apiError.isAxiosError = true;
    return Promise.reject(apiError);
  }
);

export default api;
export { API_BASE_URL };
