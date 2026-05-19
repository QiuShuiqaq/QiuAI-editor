import { create } from 'zustand';

export type SidebarTab = 'text' | 'image' | 'table';

interface SidebarState {
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  activeTab: 'text',
  setActiveTab: (tab) => set({ activeTab: tab, isCollapsed: false }),
  isCollapsed: false,
  toggleCollapse: () => set((s) => ({ isCollapsed: !s.isCollapsed })),
}));
