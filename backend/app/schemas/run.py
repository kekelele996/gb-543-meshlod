"""PipelineRun / RunLog schema。"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.lod_level import LodLevelOut


class RunCreate(BaseModel):
    pipeline_id: uuid.UUID
    mesh_id: uuid.UUID


class RunLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    run_id: uuid.UUID
    level: str
    message: str
    created_at: datetime


class RunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    pipeline_id: uuid.UUID
    mesh_id: uuid.UUID
    requested_by_id: uuid.UUID
    status: str
    progress: int
    stats_json: dict
    error_message: str | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
    pipeline_name: str | None = None
    mesh_name: str | None = None
    mesh_triangle_count: int | None = None
    mesh_format: str | None = None
    requested_by_name: str | None = None
    levels: list[LodLevelOut] = Field(default_factory=list)
    stage: str | None = None
    cancelable: bool = False


class RunDetail(RunOut):
    logs: list[RunLogOut] = Field(default_factory=list)
