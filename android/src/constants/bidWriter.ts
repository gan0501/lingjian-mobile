// AI模型图标 - 本地资源
export const MODEL_ICONS = {
  deepseek: require('@/assets/images/models/deepseek.png'),
  qwen: require('@/assets/images/models/qwen.png'),
  doubao: require('@/assets/images/models/doubao.png'),
  zhipu: require('@/assets/images/models/zhipu.png'),
  kimi: require('@/assets/images/models/moonshot.png'),
  minimax: require('@/assets/images/models/minimax.png'),
};

// AI模型品牌列表（只显示品牌，后端自动使用最新顶级模型）
export const AI_MODELS = [
  {
    id: 'deepseek',
    name: '深索DeepSeek',
    desc: '深度推理 · 逻辑严谨',
    color: '#4A6CF7',
    icon: MODEL_ICONS.deepseek,
    provider: 'deepseek',
    code: 'deepseek-chat',
  },
  {
    id: 'qwen',
    name: '阿里Qwen',
    desc: '通用能力 · 响应快速',
    color: '#615DF8',
    icon: MODEL_ICONS.qwen,
    provider: 'qianwen',
    code: 'qwen-max',
  },
  {
    id: 'doubao',
    name: '字节Doubao',
    desc: '创意写作 · 表达流畅',
    color: '#00D4AA',
    icon: MODEL_ICONS.doubao,
    provider: 'doubao',
    code: 'doubao-pro-128k',
  },
  {
    id: 'zhipu',
    name: '智谱GLM',
    desc: '专业领域 · 知识丰富',
    color: '#3B82F6',
    icon: MODEL_ICONS.zhipu,
    provider: 'zhipu',
    code: 'glm-4',
  },
  {
    id: 'kimi',
    name: '月暗Kimi',
    desc: '长文处理 · 理解深入',
    color: '#000000',
    icon: MODEL_ICONS.kimi,
    provider: 'kimi',
    code: 'moonshot-v1-128k',
  },
  {
    id: 'minimax',
    name: '稀宇MiniMax',
    desc: '多模态 · 全能助手',
    color: '#EC4899',
    icon: MODEL_ICONS.minimax,
    provider: 'minimax',
    code: 'abab6-chat',
  },
];

// 封面选项
export const COVER_OPTIONS = [
  { id: 'cover1', name: '牛皮纸', image: require('@/assets/images/covers/1.png') },
  { id: 'cover2', name: '简约红', image: require('@/assets/images/covers/2.png') },
  { id: 'cover3', name: '科技蓝', image: require('@/assets/images/covers/3.png') },
  { id: 'cover4', name: '环保绿', image: require('@/assets/images/covers/4.png') },
  { id: 'cover5', name: '典雅灰', image: require('@/assets/images/covers/5.png') },
  { id: 'cover6', name: '政务蓝', image: require('@/assets/images/covers/6.png') },
];

// 版式选项
export const LAYOUT_OPTIONS = [
  { id: 'image', name: '文+图', image: require('@/assets/images/layouts/2.png'), hasImages: true, hasPageBorder: false },
  { id: 'frame', name: '文+表', image: require('@/assets/images/layouts/3.png'), hasImages: false, hasPageBorder: true },
  { id: 'frame-image', name: '文+表+图', image: require('@/assets/images/layouts/4.png'), hasImages: true, hasPageBorder: true },
];

// 色系选项
export const COLOR_OPTIONS = [
  { id: 'black', name: '黑', color: '#1a1a1a' },
  { id: 'red', name: '红', color: '#B20000' },
  { id: 'orange', name: '橙', color: '#FF6B00' },
  { id: 'green', name: '绿', color: '#16A34A' },
  { id: 'cyan', name: '青', color: '#06B6D4' },
  { id: 'blue', name: '蓝', color: '#2563EB' },
  { id: 'purple', name: '紫', color: '#7C3AED' },
];
