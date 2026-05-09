/**
 * 主题上下文 - 渐进式迁移架构
 * 通过 ThemeProvider 统一控制日间/夜间主题色彩
 * 各页面通过 useTheme() 获取当前主题色彩，无需维护两套代码
 */
import React, { createContext, useContext, FC, useCallback } from 'react';
import { getMapTileStyle } from '@/constants';

// --- 色彩令牌定义 ---
export interface ThemeColors {
  // 基础色
  background: string;
  surface: string;
  surfaceTranslucent: string;
  text: string;
  textSub: string;
  textMuted: string;
  accent: string;
  accentLight: string;
  border: string;
  // 地图相关
  mapHeaderBg: string;
  mapStatsBg: string;
  mapStatsLabel: string;
  mapStatsValue: string;
  mapStatsAccent: string;
  // 状态栏
  statusBarStyle: 'light-content' | 'dark-content';
  // 地图瓦片样式
  mapTileFilter: {
    brightnessMax?: number;
    saturation?: number;
    contrast?: number;
  } | null;
}

export type ThemeMode = 'day' | 'cool';

const DAY_COLORS: ThemeColors = {
  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceTranslucent: 'rgba(255,255,255,0.95)',
  text: '#1A1A2E',
  textSub: '#6B7280',
  textMuted: '#9CA3AF',
  accent: '#B20000',  // 改为红色（原蓝绿色 #099b98）
  accentLight: '#FFE5E5',  // 红色浅色背景
  border: '#E5E7EB',
  mapHeaderBg: 'rgba(255,255,255,0.95)',
  mapStatsBg: '#FFFFFF',
  mapStatsLabel: '#9CA3AF',
  mapStatsValue: '#1A1A2E',
  mapStatsAccent: '#B20000',  // 改为红色（原蓝绿色 #099b98）
  statusBarStyle: 'dark-content',
  mapTileFilter: null,
};

const COOL_COLORS: ThemeColors = {
  background: '#0D0D1A',
  surface: 'rgba(28, 20, 45, 0.95)',
  surfaceTranslucent: 'rgba(20, 24, 34, 0.95)',
  text: '#FFFFFF',
  textSub: 'rgba(255,255,255,0.7)',
  textMuted: 'rgba(255,255,255,0.45)',
  accent: '#C084FC',
  accentLight: 'rgba(192,132,252,0.15)',
  border: 'rgba(255,255,255,0.08)',
  mapHeaderBg: 'rgba(20, 24, 34, 0.95)',
  mapStatsBg: 'rgba(20, 24, 34, 0.95)',
  mapStatsLabel: 'rgba(255,255,255,0.45)',
  mapStatsValue: '#FFFFFF',
  mapStatsAccent: '#C084FC',
  statusBarStyle: 'light-content',
  mapTileFilter: {
    brightnessMax: 0.35,
    saturation: -0.85,
    contrast: 0.2,
  },
};

// --- Context ---
interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'day',
  colors: DAY_COLORS,
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

interface ThemeProviderProps {
  initialMode?: ThemeMode;
  children: React.ReactNode;
}

export const ThemeProvider: FC<ThemeProviderProps> = ({ initialMode = 'day', children }) => {
  // 强制始终使用日间模式，禁用主题切换
  const mode: ThemeMode = 'day';

  const setTheme = useCallback((newMode: ThemeMode) => {
    // 禁用主题切换
    console.log('[Theme] 主题切换已禁用，始终使用日间模式');
  }, []);

  const toggleTheme = useCallback(() => {
    // 禁用主题切换
    console.log('[Theme] 主题切换已禁用，始终使用日间模式');
  }, []);

  const colors = DAY_COLORS;

  return (
    <ThemeContext.Provider value={{ mode, colors, isDark: false, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// --- 地图样式工具 ---
/**
 * 使用集中配置的瓦片源（高德/天地图双源策略）
 * 始终使用日间模式样式
 */
export const getMapStyle = (_mode?: ThemeMode) => {
  // 强制使用日间模式，不调暗底图
  return getMapTileStyle(null);
};

export default ThemeContext;
