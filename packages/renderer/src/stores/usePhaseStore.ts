import { create } from 'zustand';
import { WritingPhase } from '@qiuai/shared';

interface PhaseState {
  currentPhase: WritingPhase;
  setPhase: (phase: WritingPhase) => void;
}

export const usePhaseStore = create<PhaseState>((set) => ({
  currentPhase: WritingPhase.FRAMEWORK,
  setPhase: (phase) => set({ currentPhase: phase }),
}));
