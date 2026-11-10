import { create } from 'zustand';
import type { InspectMode } from '../constants/inspectMode';

interface UiState {
  inspectMode: InspectMode;
  toast: { text: string; tone: 'info' | 'error' | 'warn' } | null;
  setInspectMode: (mode: InspectMode) => void;
  pushToast: (text: string, tone?: 'info' | 'error' | 'warn') => void;
  clearToast: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  inspectMode: 'solid',
  toast: null,
  setInspectMode: (mode) => set({ inspectMode: mode }),
  pushToast: (text, tone = 'info') => set({ toast: { text, tone } }),
  clearToast: () => set({ toast: null }),
}));
