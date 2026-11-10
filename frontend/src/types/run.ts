import type { RunStatus } from '../constants/runStatus';
import type { LodLevel } from './lodLevel';

export interface RunLog {
  id: number;
  run_id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  created_at: string;
}

export interface RunStats {
  stage?: string;
  base_triangle_count?: number;
  final_triangle_count?: number;
  level_count?: number;
  level_ms?: Record<string, number>;
  decimation_impl?: string[];
  duration_ms?: number;
  warnings?: string[];
  error_code?: string;
  sse?: {
    viewport_height?: number;
    fov_y_deg?: number;
    distance_factor?: number;
    formula?: string;
  };
  pipeline_snapshot?: {
    name?: string;
    strategy?: string;
    target_ratios?: number[];
    repair_flags?: Record<string, boolean>;
  };
}

export interface PipelineRun {
  id: string;
  pipeline_id: string;
  mesh_id: string;
  requested_by_id: string;
  status: RunStatus;
  progress: number;
  stats_json: RunStats;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  pipeline_name?: string | null;
  mesh_name?: string | null;
  mesh_triangle_count?: number | null;
  mesh_format?: string | null;
  requested_by_name?: string | null;
  levels: LodLevel[];
  stage?: string | null;
  cancelable: boolean;
  logs?: RunLog[];
}
