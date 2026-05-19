import { create } from 'zustand';
import type { Editor } from '@tiptap/react';

interface EditorState {
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  wordCount: number;
  setWordCount: (count: number) => void;
  selectedText: string;
  setSelectedText: (text: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  editor: null,
  setEditor: (editor) => set({ editor }),
  isDirty: false,
  setDirty: (dirty) => set({ isDirty: dirty }),
  wordCount: 0,
  setWordCount: (count) => set({ wordCount: count }),
  selectedText: '',
  setSelectedText: (text) => set({ selectedText: text }),
}));
