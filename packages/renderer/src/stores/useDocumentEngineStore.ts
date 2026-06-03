import { create } from 'zustand';
import type { DocumentEngineAdapter } from '../types/documentEngine';

interface DocumentEngineState {
  adapter: DocumentEngineAdapter | null;
  setAdapter: (adapter: DocumentEngineAdapter | null) => void;
}

export const useDocumentEngineStore = create<DocumentEngineState>((set) => ({
  adapter: null,
  setAdapter: (adapter) => set({ adapter }),
}));
