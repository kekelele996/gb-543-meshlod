import type { AssetStatus } from '../constants/assetStatus';
import type { MeshFormat } from '../constants/meshFormat';

export interface BBox {
  min?: number[];
  max?: number[];
  extents?: number[];
  sphere_radius?: number;
}

export interface MeshAsset {
  id: string;
  owner_id: string;
  name: string;
  source_format: MeshFormat;
  vertex_count: number;
  triangle_count: number;
  file_path: string;
  checksum: string;
  status: AssetStatus;
  bbox_json: BBox;
  uv_channel_count: number;
  created_at: string;
  thumb_url?: string | null;
  owner_name?: string | null;
}
