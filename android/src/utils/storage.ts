import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV();

export const StorageKeys = {
  TOKEN: 'auth_token',
  USER: 'user_info',
  SETTINGS: 'settings',
} as const;

export const setItem = <T>(key: string, value: T): void => {
  storage.set(key, JSON.stringify(value));
};

export const getItem = <T>(key: string): T | null => {
  const value = storage.getString(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const removeItem = (key: string): void => {
  storage.delete(key);
};

export const clearAll = (): void => {
  storage.clearAll();
};
