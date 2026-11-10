export interface ApiError {
  code: string;
  message: string;
  entity?: string | null;
  field?: string | null;
  request_id?: string | null;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  page?: number;
  page_size?: number;
}

export interface Quota {
  user_id: string;
  max_upload_mb: number;
  max_concurrent_runs: number;
  used_runs: number;
  window_start: string;
  remaining_runs: number;
  active_runs?: number;
}

export interface AssetUploadResponse {
  asset: import('./meshAsset').MeshAsset;
  duplicate: boolean;
  message: string;
}
