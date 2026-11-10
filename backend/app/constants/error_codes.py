"""错误码集中定义：service 抛 AppError(code)，由 error_handler 统一出参。"""
from dataclasses import dataclass


@dataclass(frozen=True)
class ErrorSpec:
    status_code: int
    message: str


ERROR_CODES: dict[str, ErrorSpec] = {
    "E_BAD_REQUEST": ErrorSpec(400, "请求参数不合法"),
    "E_UNAUTHORIZED": ErrorSpec(401, "未认证或登录已过期"),
    "E_FORBIDDEN": ErrorSpec(403, "当前角色无权执行该操作"),
    "E_NOT_FOUND": ErrorSpec(404, "资源不存在"),
    "E_CONFLICT": ErrorSpec(409, "资源状态冲突"),
    "E_UNSUPPORTED_FORMAT": ErrorSpec(415, "仅支持 obj/glb/gltf 网格文件"),
    "E_FILE_TOO_LARGE": ErrorSpec(413, "文件超过上传体积上限"),
    "E_EMPTY_FILE": ErrorSpec(400, "文件为空或解析不到几何体"),
    "E_MESH_PARSE_FAIL": ErrorSpec(422, "网格解析失败，无法读取顶点/三角面"),
    "E_ASSET_INVALID": ErrorSpec(409, "无效资产不允许进入管线"),
    "E_QUOTA_EXCEEDED": ErrorSpec(429, "并发运行配额已用尽"),
    "E_RUN_NOT_CANCELABLE": ErrorSpec(409, "仅 queued/running 状态可取消"),
    "E_LOD_LEVEL_MISSING": ErrorSpec(404, "该 LOD 层级不存在或产物缺失"),
    "E_UV_MISSING": ErrorSpec(422, "缺少 TEXCOORD_0（UV 通道），管线在 uv_check 阶段中止"),
    "E_PIPELINE_INVALID": ErrorSpec(422, "管线参数不合法（比例链必须严格递减且末项 > 0）"),
    "E_NO_PIPELINE": ErrorSpec(409, "尚未配置默认管线"),
    "E_ARTIFACT_MISSING": ErrorSpec(410, "产物文件已不存在"),
    "E_INTERNAL": ErrorSpec(500, "服务器内部错误"),
}


def get_spec(code: str) -> ErrorSpec:
    return ERROR_CODES.get(code, ERROR_CODES["E_INTERNAL"])
