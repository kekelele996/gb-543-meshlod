export const ERROR_CODES = {
  E_BAD_REQUEST: '请求参数不合法',
  E_UNAUTHORIZED: '未认证或登录已过期',
  E_FORBIDDEN: '当前角色无权执行该操作',
  E_NOT_FOUND: '资源不存在',
  E_UNSUPPORTED_FORMAT: '仅支持 obj/glb/gltf 网格文件',
  E_FILE_TOO_LARGE: '文件超过上传体积上限',
  E_MESH_PARSE_FAIL: '网格解析失败，无法读取顶点/三角面',
  E_QUOTA_EXCEEDED: '并发运行配额已用尽',
  E_RUN_NOT_CANCELABLE: '仅 queued/running 状态可取消',
  E_LOD_LEVEL_MISSING: '该 LOD 层级不存在',
  E_UV_MISSING: '缺少 TEXCOORD_0（UV 通道）',
  E_PIPELINE_INVALID: '管线参数不合法',
  E_ARTIFACT_MISSING: '产物文件已不存在',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export function errorText(code?: string, fallback?: string): string {
  if (code && code in ERROR_CODES) return ERROR_CODES[code as ErrorCode];
  return fallback ?? '请求失败';
}
