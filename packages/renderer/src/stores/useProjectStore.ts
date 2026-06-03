import { create } from 'zustand';
import {
  createEmptyDocumentState,
  generateId,
  syncDocumentWithState,
  WritingPhase,
  type QiuAiDocument,
} from '@qiuai/shared';

interface ProjectState {
  doc: QiuAiDocument;
  setDoc: (doc: QiuAiDocument) => void;
  setTitle: (title: string) => void;
  setCurrentPhase: (phase: WritingPhase) => void;
  reset: () => void;
}

function createEmptyDoc(): QiuAiDocument {
  const now = new Date().toISOString();

  return syncDocumentWithState({
    id: generateId(),
    title: '未命名文档',
    createdAt: now,
    updatedAt: now,
    currentPhase: WritingPhase.FRAMEWORK,
    framework: [],
    slotAssignments: {},
    editorContent: {},
    referenceMaterials: [],
    documentPlan: '',
    documentState: createEmptyDocumentState(),
  });
}

export const useProjectStore = create<ProjectState>((set) => ({
  doc: createEmptyDoc(),
  setDoc: (doc) => set({ doc: syncDocumentWithState(doc) }),
  setTitle: (title) =>
    set((state) => ({
      doc: syncDocumentWithState({
        ...state.doc,
        title,
        updatedAt: new Date().toISOString(),
      }),
    })),
  setCurrentPhase: (phase) =>
    set((state) => ({
      doc: syncDocumentWithState({
        ...state.doc,
        currentPhase: phase,
        updatedAt: new Date().toISOString(),
      }),
    })),
  reset: () => set({ doc: createEmptyDoc() }),
}));
