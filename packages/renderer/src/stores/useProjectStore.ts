import { create } from 'zustand';
import { generateId, WritingPhase, type QiuAiDocument } from '@qiuai/shared';

interface ProjectState {
  doc: QiuAiDocument;
  setDoc: (doc: QiuAiDocument) => void;
  setTitle: (title: string) => void;
  setCurrentPhase: (phase: WritingPhase) => void;
  reset: () => void;
}

function createEmptyDoc(): QiuAiDocument {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: '未命名申报书',
    createdAt: now,
    updatedAt: now,
    currentPhase: WritingPhase.FRAMEWORK,
    framework: [],
    slotAssignments: {},
    editorContent: {},
    referenceMaterials: [],
    documentPlan: '',
  };
}

export const useProjectStore = create<ProjectState>((set) => ({
  doc: createEmptyDoc(),
  setDoc: (doc) => set({ doc }),
  setTitle: (title) =>
    set((s) => ({
      doc: { ...s.doc, title, updatedAt: new Date().toISOString() },
    })),
  setCurrentPhase: (phase) =>
    set((s) => ({
      doc: { ...s.doc, currentPhase: phase, updatedAt: new Date().toISOString() },
    })),
  reset: () => set({ doc: createEmptyDoc() }),
}));
