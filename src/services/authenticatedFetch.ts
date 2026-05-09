import { Alert } from 'react-native';
import { useAuthStore } from '@/stores/useAuthStore';
import { API_CONFIG } from '@/constants/config';
import { navigationRef } from '@/navigation/RootNavigator';
import { showSystemAlert } from '@/components/common/CustomAlert';

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
let authAlertShowing = false;

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

async function tryRefreshToken(): Promise<string | null> {
  const { refreshToken, setTokens } = useAuthStore.getState();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = await response.json();
    if (data?.code === 200 && data?.result) {
      const { token, refresh_token, expires_at } = data.result;
      setTokens(token, refresh_token, expires_at);
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

export async function authenticatedFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const { token } = useAuthStore.getState();

  const headers: Record<string, string> = {};
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value: string, key: string) => {
        headers[key] = value;
      });
    } else if (Array.isArray(init.headers)) {
      init.headers.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, init.headers);
    }
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const mergedInit: RequestInit = {
    ...init,
    headers,
  };

  const response = await fetch(input, mergedInit);

  if (response.status !== 401) {
    return response;
  }

  if (!isRefreshing) {
    isRefreshing = true;
    refreshPromise = tryRefreshToken().finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
  }

  const newToken = await refreshPromise;
  if (!newToken) {
    const isKicked = /其他设备登录|强制下线/i.test(await response.clone().text().catch(() => ''));
    showAuthExpiredAlert(
      isKicked
        ? '您的账号已在其他设备登录，已被强制下线，请重新登录'
        : '您的登录状态已失效，请重新登录'
    );
    return response;
  }

  headers['Authorization'] = `Bearer ${newToken}`;
  return fetch(input, { ...mergedInit, headers });
}

export default authenticatedFetch;
