export const MESSAGES = {
  emptyAssetsTitle: '还没有网格资产',
  emptyAssetsHint: '拖入 .glb 开始，或先载入一个示例立方体网格验证管线',
  emptyRunsTitle: '还没有运行记录',
  emptyRunsHint: '选一个资产 + 一条管线即可产出 LOD',
  uvMissing: '未检测到 TEXCOORD_0，material 视图不可用',
  quotaFull: '并发运行配额已用尽，请等待当前运行结束',
  viewerReadonly: '引擎组（viewer）只读：可核对规格与下载产物，不能发起或取消运行',
  sseNote: 'SSE 为 1080p / 60° 视场 / 3R 距离下的屏幕空间误差估算',
  uploadTooLarge: '文件超过 80MB，请先在 DCC 里做一次粗减面',
  uploadBadFormat: '仅支持 obj / glb / gltf 三种网格格式',
} as const;
