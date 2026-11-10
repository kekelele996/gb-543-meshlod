export interface LodLevel {
  id: string;
  run_id: string;
  level_index: number;
  ratio: number;
  vertex_count: number;
  triangle_count: number;
  file_path: string;
  screen_space_error: number;
  download_url: string;
  reduction_pct: number;
}
