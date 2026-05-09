/**
 * 领建 - 统一色彩系统
 *
 * 分层设计：
 *   - 夜间主色（首页使用）
 *   - 日间主色（地图三页面使用）
 *   - 业务色（项目/建企/厂家类型色）
 *   - 语义色（成功/警告/错误/信息）
 */

// ─── 夜间模式（首页 Silk 风格） ───

export const NightColors = {
  background: '#0B0F19',
  surface: '#0A0E14',
  surfaceSecondary: '#1A222D',
  surfaceElevated: '#1E2736',
  text: '#F0F4F8',
  textSecondary: '#A0AEC0',
  textTertiary: '#718096',
  accent: '#C084FC',
  border: 'rgba(255, 255, 255, 0.08)',
  borderMedium: 'rgba(255, 255, 255, 0.15)',
  glass: 'rgba(20, 24, 34, 0.55)',
  overlay: 'rgba(0, 0, 0, 0.7)',
} as const;

// ─── 日间模式（地图页面） ───

export const DayColors = {
  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceSecondary: '#F9FAFB',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  accent: '#099b98',
  accentLight: '#E0F7F6',
  border: '#E5E7EB',
  borderLight: 'rgba(0, 0, 0, 0.04)',
  shadow: 'rgba(0, 0, 0, 0.06)',
  overlay: 'rgba(0, 0, 0, 0.2)',
  cardBackground: 'rgba(255, 255, 255, 0.95)',
} as const;

// ─── 业务色板 ───

export const BusinessColors = {
  project: {
    planning: '#B20000',
    landAuction: '#B20000',
    bidding: '#B20000',
    procurement: '#B20000',
    custom: '#B20000',
  },
  enterprise: {
    consultancy: '#4CAF50',
    design: '#2196F3',
    construction: '#FF9800',
    supervision: '#9C27B0',
  },
  manufacturer: {
    material: '#4CAF50',
    labor: '#2196F3',
    equipment: '#FF9800',
    service: '#9C27B0',
  },
} as const;

// ─── 语义色 ───

export const SemanticColors = {
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
} as const;

// ─── 统一导出（兼容旧引用） ───

export const Colors = {
  primary: {
    50: '#F5F3FF',
    100: '#EDE9FE',
    200: '#DDD6FE',
    300: '#C4B5FD',
    400: '#A78BFA',
    500: '#8B5CF6',
    600: '#7C3AED',
    700: '#6D28D9',
    800: '#5B21B6',
    900: '#4C1D95',
  },
  background: {
    primary: NightColors.background,
    secondary: NightColors.surfaceSecondary,
    tertiary: NightColors.surface,
    elevated: NightColors.surfaceElevated,
    home: ['#80011A', '#000000'] as const,
    surface: NightColors.surface,
    modal: '#FFFFFF',
  },
  text: {
    primary: NightColors.text,
    secondary: NightColors.textSecondary,
    tertiary: NightColors.textTertiary,
    modal: DayColors.text,
  },
  border: {
    light: NightColors.border,
    medium: NightColors.borderMedium,
    dark: 'rgba(255, 255, 255, 0.25)',
  },
  accent: {
    primary: NightColors.accent,
    button: '#000000',
    success: SemanticColors.success,
    warning: SemanticColors.warning,
    error: SemanticColors.error,
  },
  glass: {
    border: 'rgba(255, 255, 255, 0.12)',
    highlight: 'rgba(255, 255, 255, 0.3)',
    overlay: NightColors.overlay,
    sidebar: 'rgba(28, 20, 45, 0.98)',
    sidebarBorder: 'rgba(192, 132, 252, 0.3)',
    background: 'rgba(255, 255, 255, 0.05)',
  },
  business: BusinessColors.project,
  status: SemanticColors,
} as const;

// ─── 业务色映射函数 ───

export const getProjectColor = (type: number): string => {
  const map: Record<number, string> = {
    1: BusinessColors.project.planning,
    2: BusinessColors.project.landAuction,
    3: BusinessColors.project.bidding,
    4: BusinessColors.project.procurement,
    5: BusinessColors.project.custom,
  };
  return map[type] || DayColors.accent;
};

export const getEnterpriseColor = (type: number): string => {
  const map: Record<number, string> = {
    1: BusinessColors.enterprise.consultancy,
    2: BusinessColors.enterprise.design,
    3: BusinessColors.enterprise.construction,
    4: BusinessColors.enterprise.supervision,
  };
  return map[type] || DayColors.accent;
};

export const getManufacturerColor = (type: number): string => {
  const map: Record<number, string> = {
    1: BusinessColors.manufacturer.material,
    2: BusinessColors.manufacturer.labor,
    3: BusinessColors.manufacturer.equipment,
    4: BusinessColors.manufacturer.service,
  };
  return map[type] || DayColors.accent;
};

export default Colors;
