import type { LodStrategy } from '../constants/lodStrategy';

export interface RepairFlags {
  weld: boolean;
  degnerate: boolean;
  normals: boolean;
  uv_check: boolean;
}

export interface StrategyParams {
  target_error_px?: number | null;
  min_faces?: number | null;
  max_faces?: number | null;
}

export interface ProcessPipeline {
  id: string;
  owner_id: string;
  name: string;
  strategy: LodStrategy;
  target_ratios_json: number[];
  strategy_params_json: StrategyParams;
  repair_flags_json: RepairFlags;
  is_template: boolean;
  created_at: string;
  owner_name?: string | null;
}

export interface PipelineInput {
  name: string;
  strategy: LodStrategy;
  target_ratios: number[];
  repair_flags: RepairFlags;
  strategy_params: StrategyParams;
  is_template: boolean;
}
