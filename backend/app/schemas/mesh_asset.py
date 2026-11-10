"""MeshAsset schema。"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MeshAssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    source_format: str
    vertex_count: int
    triangle_count: int
    file_path: str
    checksum: str
    status: str
    bbox_json: dict
    uv_channel_count: int
    created_at: datetime
    thumb_url: str | None = None
    owner_name: str | None = None


class MeshAssetDuplicate(BaseModel):
    asset: MeshAssetOut
    duplicate: bool = True
    message: str
