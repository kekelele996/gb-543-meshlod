"""LodLevel schema。"""
import uuid

from pydantic import BaseModel, ConfigDict


class LodLevelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    run_id: uuid.UUID
    level_index: int
    ratio: float
    vertex_count: int
    triangle_count: int
    file_path: str
    screen_space_error: float
    download_url: str
    reduction_pct: float
