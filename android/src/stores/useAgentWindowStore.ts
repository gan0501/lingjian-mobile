/**
 * 牛马视窗窗口状态管理
 *
 * 管理 3D 场景的三种显示形态：
 * - home:  首页常驻（EmbeddedAgentWindow）
 * - float: 跨页面浮窗（GlobalAgentFloat）
 * - full:  全屏页面（AgentOfficeScreen）
 */
import { create } from 'zustand';

export type AgentWindowMode = 'home' | 'float' | 'full';

interface AgentWindowState {
  /** 当前浮窗是否显示 */
  floatVisible: boolean;

  /** 显示浮窗 */
  showFloat: () => void;

  /** 隐藏浮窗 */
  hideFloat: () => void;

  /** 从浮窗进入全屏（关闭浮窗，由外部 navigate） */
  enterFullFromFloat: () => void;
}

export const useAgentWindowStore = create<AgentWindowState>((set) => ({
  floatVisible: false,

  showFloat: () => set({ floatVisible: true }),
  hideFloat: () => set({ floatVisible: false }),
  enterFullFromFloat: () => set({ floatVisible: false }),
}));
