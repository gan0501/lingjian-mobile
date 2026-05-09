import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

interface User {
  id: number;
  nickname?: string;
  avatar?: string;
  phone?: string;
  role?: string;
  created_at?: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;

  setToken: (token: string) => void;
  setTokens: (token: string, refreshToken: string, expiresAt: number) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  isTokenExpired: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      tokenExpiresAt: null,
      user: null,
      isLoggedIn: false,
      isLoading: false,

      setToken: (token) => set({ token, isLoggedIn: true }),

      setTokens: (token, refreshToken, expiresAt) => set({
        token,
        refreshToken,
        tokenExpiresAt: expiresAt,
        isLoggedIn: true,
      }),

      setUser: (user) => set({ user }),

      logout: () => set({
        token: null,
        refreshToken: null,
        tokenExpiresAt: null,
        user: null,
        isLoggedIn: false,
      }),

      setLoading: (isLoading) => set({ isLoading }),

      isTokenExpired: () => {
        const { tokenExpiresAt } = get();
        if (!tokenExpiresAt) return true;
        return Date.now() >= tokenExpiresAt;
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        tokenExpiresAt: state.tokenExpiresAt,
        user: state.user,
        isLoggedIn: state.isLoggedIn,
      }),
    }
  )
);
