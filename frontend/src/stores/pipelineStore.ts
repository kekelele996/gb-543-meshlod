import { create } from 'zustand';
import type { LodStrategy } from '../constants/lodStrategy';
import type { RepairFlags, StrategyParams } from '../types/pipeline';

export interface ChainValidation {
  ok: boolean;
  errors: Record<number, string>;
  summary: string;
}

export function validateRatioChain(ratios: number[]): ChainValidation {
  const errors: Record<number, string> = {};
  if (!ratios.length) return { ok: false, errors: { 0: '至少需要一个比例' }, summary: '比例链为空' };
  ratios.forEach((ratio, index) => {
    if (!Number.isFinite(ratio) || ratio <= 0) errors[index] = '必须 > 0';
    else if (ratio > 100) errors[index] = '不能超过 100%';
  });
  for (let i = 1; i < ratios.length; i += 1) {
    if (!errors[i] && ratios[i] >= ratios[i - 1]) {
      errors[i] = `必须小于上一项 ${ratios[i - 1]}%`;
    }
  }
  const last = ratios[ratios.length - 1];
  if (last <= 0) errors[ratios.length - 1] = '末项必须 > 0';
  const ok = Object.keys(errors).length === 0;
  const summary = ok
    ? `比例链 ${ratios.join('/')} 严格递减，末项 > 0`
    : '比例链必须严格递减且末项 > 0（例如 100/50/25/10）';
  return { ok, errors, summary };
}

interface PipelineDraftState {
  name: string;
  strategy: LodStrategy;
  ratios: number[];
  repairFlags: RepairFlags;
  strategyParams: StrategyParams;
  isTemplate: boolean;
  setName: (name: string) => void;
  setStrategy: (strategy: LodStrategy) => void;
  setRatios: (ratios: number[]) => void;
  setRepairFlag: (key: keyof RepairFlags, value: boolean) => void;
  setStrategyParams: (params: StrategyParams) => void;
  setIsTemplate: (value: boolean) => void;
  reset: (init?: Partial<PipelineDraftState>) => void;
}

const defaults = {
  name: '园区标准 LOD',
  strategy: 'ratio_chain' as LodStrategy,
  ratios: [100, 50, 25, 10],
  repairFlags: { weld: true, degnerate: true, normals: true, uv_check: true },
  strategyParams: { target_error_px: 6, min_faces: 2000, max_faces: 200000 } as StrategyParams,
  isTemplate: true,
};

export const usePipelineStore = create<PipelineDraftState>((set) => ({
  ...defaults,
  setName: (name) => set({ name }),
  setStrategy: (strategy) => set({ strategy }),
  setRatios: (ratios) => set({ ratios }),
  setRepairFlag: (key, value) =>
    set((state) => ({ repairFlags: { ...state.repairFlags, [key]: value } })),
  setStrategyParams: (params) => set({ strategyParams: params }),
  setIsTemplate: (value) => set({ isTemplate: value }),
  reset: (init) => set({ ...defaults, ...init }),
}));
