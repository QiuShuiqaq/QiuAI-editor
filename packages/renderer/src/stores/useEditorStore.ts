import { create } from 'zustand';
import type { Editor } from '@tiptap/react';

export interface SelectionFormattingState {
  fontFamily: string;
  fontSize: string;
  color: string;
  highlightColor: string | null;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrike: boolean;
  isSuperscript: boolean;
  isSubscript: boolean;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  lineHeight: string;
  spaceBefore: string;
  spaceAfter: string;
  textIndent: string;
  marginLeft: string;
  marginRight: string;
  styleLabel: string;
  isBulletList: boolean;
  isOrderedList: boolean;
  activeObject: 'text' | 'image' | 'table' | 'header' | 'footer';
  activeRevisionKind: 'insert' | 'delete' | null;
}

export const DEFAULT_SELECTION_FORMATTING: SelectionFormattingState = {
  fontFamily: 'FangSong',
  fontSize: '16pt',
  color: '#000000',
  highlightColor: null,
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrike: false,
  isSuperscript: false,
  isSubscript: false,
  textAlign: 'left',
  lineHeight: '1.5',
  spaceBefore: '0pt',
  spaceAfter: '8px',
  textIndent: '2em',
  marginLeft: '0pt',
  marginRight: '0pt',
  styleLabel: '正文',
  isBulletList: false,
  isOrderedList: false,
  activeObject: 'text',
  activeRevisionKind: null,
};

interface EditorState {
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  wordCount: number;
  setWordCount: (count: number) => void;
  pageCount: number;
  setPageCount: (count: number) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  selectedText: string;
  setSelectedText: (text: string) => void;
  activeSectionId: string | null;
  activeSectionTitle: string;
  setActiveSection: (section: { id: string | null; title: string }) => void;
  formatting: SelectionFormattingState;
  setFormatting: (formatting: SelectionFormattingState) => void;
  revisionRefreshKey: number;
  bumpRevisionRefreshKey: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  editor: null,
  setEditor: (editor) => set({ editor }),
  isDirty: false,
  setDirty: (dirty) => set({ isDirty: dirty }),
  wordCount: 0,
  setWordCount: (count) => set({ wordCount: count }),
  pageCount: 1,
  setPageCount: (count) => set({ pageCount: Math.max(1, count) }),
  currentPage: 1,
  setCurrentPage: (page) => set({ currentPage: Math.max(1, page) }),
  selectedText: '',
  setSelectedText: (text) => set({ selectedText: text }),
  activeSectionId: null,
  activeSectionTitle: '',
  setActiveSection: (section) =>
    set({
      activeSectionId: section.id,
      activeSectionTitle: section.title,
    }),
  formatting: DEFAULT_SELECTION_FORMATTING,
  setFormatting: (formatting) => set({ formatting }),
  revisionRefreshKey: 0,
  bumpRevisionRefreshKey: () =>
    set((state) => ({
      revisionRefreshKey: state.revisionRefreshKey + 1,
    })),
}));
