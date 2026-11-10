import { create } from 'zustand';
import type { RunStatus } from '../constants/runStatus';

interface RunState {
  statusFilter: RunStatus | '';
  logCursor: Record<string, number>;
  setStatusFilter: (status: RunStatus | '') => void;
  setLogCursor: (runId: string, cursor: number) => void;
}

export const useRunStore = create<RunState>((set) => ({
  statusFilter: '',
  logCursor: {},
  setStatusFilter: (status) => set({ statusFilter: status }),
  setLogCursor: (runId, cursor) =>
    set((state) => ({ logCursor: { ...state.logCursor, [runId]: cursor } })),
}));
