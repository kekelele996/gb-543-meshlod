import { create } from 'zustand';

export type AssetView = 'table' | 'grid';

interface AssetState {
  sort: 'created_at' | 'triangle_count' | 'name';
  order: 'asc' | 'desc';
  view: AssetView;
  status: string;
  uploadPercent: number | null;
  setSort: (sort: AssetState['sort']) => void;
  setOrder: (order: AssetState['order']) => void;
  setView: (view: AssetView) => void;
  setStatus: (status: string) => void;
  setUploadPercent: (value: number | null) => void;
}

export const useAssetStore = create<AssetState>((set) => ({
  sort: 'created_at',
  order: 'desc',
  view: 'table',
  status: '',
  uploadPercent: null,
  setSort: (sort) => set({ sort }),
  setOrder: (order) => set({ order }),
  setView: (view) => set({ view }),
  setStatus: (status) => set({ status }),
  setUploadPercent: (value) => set({ uploadPercent: value }),
}));
