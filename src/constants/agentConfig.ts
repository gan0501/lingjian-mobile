/**
 * 智能体统一注册表
 *
 * 所有智能体的元数据（名称、角色、图标、颜色、路由等）只在此处定义，
 * 其他模块通过 import 引用，避免多处重复导致不一致。
 *
 * 新增智能体只需在 AGENT_REGISTRY 中添加一行即可。
 */

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  icon: string;
  color: string;
  valuePerTask: number;
  navRoute: string;
  createRoute: string;
}

export const AGENT_REGISTRY: Record<string, AgentConfig> = {
  bid_writer: {
    id: '1',
    name: '指尖标书',
    role: '智能标书撰写',
    icon: '📝',
    color: '#ff6b6b',
    valuePerTask: 600,
    navRoute: 'BidWriter',
    createRoute: 'BidWriter',
  },
  pile_compare: {
    id: '2',
    name: '桩基比选',
    role: '桩基方案对比分析',
    icon: '🏗️',
    color: '#4ecdc4',
    valuePerTask: 300,
    navRoute: 'PileComparison',
    createRoute: 'PileComparison',
  },
  project_finder: {
    id: '3',
    name: '自动找项目',
    role: '智能项目匹配',
    icon: '📊',
    color: '#45b7d1',
    valuePerTask: 200,
    navRoute: 'ProjectFinderResult',
    createRoute: 'ProjectMap',
  },
  enterprise_insight: {
    id: '4',
    name: '企业洞察',
    role: '企业深度分析',
    icon: '🏢',
    color: '#96e6a1',
    valuePerTask: 150,
    navRoute: '',
    createRoute: '',
  },
  personnel: {
    id: '5',
    name: '人员检索',
    role: '人才智能推荐',
    icon: '👥',
    color: '#dda0dd',
    valuePerTask: 100,
    navRoute: '',
    createRoute: '',
  },
  supplier: {
    id: '6',
    name: '厂家分析',
    role: '供应商智能匹配',
    icon: '🔗',
    color: '#f0e68c',
    valuePerTask: 100,
    navRoute: '',
    createRoute: '',
  },
  project_analysis: {
    id: '7',
    name: '项目分析',
    role: '项目全量分析',
    icon: '🔍',
    color: '#ff8c42',
    valuePerTask: 200,
    navRoute: 'ProjectFollow',
    createRoute: 'Home',
  },
};

export const AGENT_TYPE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(AGENT_REGISTRY).map(([key, cfg]) => [cfg.id, key]),
);

export function getAgentName(agentType: string): string {
  return AGENT_REGISTRY[agentType]?.name ?? agentType ?? '智能体';
}

export function getAgentList(): AgentConfig[] {
  return Object.values(AGENT_REGISTRY);
}
