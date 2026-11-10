export const ASSET_STATUSES = ['uploaded', 'inspecting', 'ready', 'invalid'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  uploaded: '已上传',
  inspecting: '解析中',
  ready: '可进管线',
  invalid: '无效',
};
