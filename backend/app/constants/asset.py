"""AssetStatus：资产状态枚举（与前端 constants/assetStatus.ts 一一对应）。"""
from enum import Enum


class AssetStatus(str, Enum):
    UPLOADED = "uploaded"
    INSPECTING = "inspecting"
    READY = "ready"
    INVALID = "invalid"


ASSET_STATUSES = [s.value for s in AssetStatus]
STATUS_LABELS = {
    AssetStatus.UPLOADED: "已上传",
    AssetStatus.INSPECTING: "解析中",
    AssetStatus.READY: "可进管线",
    AssetStatus.INVALID: "无效",
}
