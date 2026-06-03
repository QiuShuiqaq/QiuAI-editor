import { create } from 'zustand';
import type { PageHeaderFooterVariant } from '@qiuai/shared';

export type PageEditMode = 'none' | 'header' | 'footer';

interface PageViewState {
  editMode: PageEditMode;
  activeVariant: PageHeaderFooterVariant;
  setEditMode: (mode: PageEditMode) => void;
  setActiveVariant: (variant: PageHeaderFooterVariant) => void;
}

export const usePageViewStore = create<PageViewState>((set) => ({
  editMode: 'none',
  activeVariant: 'default',
  setEditMode: (mode) => set({ editMode: mode }),
  setActiveVariant: (variant) => set({ activeVariant: variant }),
}));
