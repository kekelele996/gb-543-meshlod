import { create } from 'zustand';
import type { Quota } from '../types/api';

interface QuotaState {
  quota: Quota | null;
  setQuota: (quota: Quota | null) => void;
  canStartRun: () => boolean;
  remaining: () => number;
}

export const useQuotaStore = create<QuotaState>((set, get) => ({
  quota: null,
  setQuota: (quota) => set({ quota }),
  canStartRun: () => {
    const quota = get().quota;
    if (!quota) return true;
    return quota.remaining_runs > 0;
  },
  remaining: () => get().quota?.remaining_runs ?? 0,
}));
