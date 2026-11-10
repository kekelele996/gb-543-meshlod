"""LOD 层级读取与下载路径解析。"""
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.storage import asset_path
from app.models.lod_level import LodLevel
from app.utils.errors import AppError


def list_levels(db: Session, run_id: uuid.UUID) -> list[LodLevel]:
    return list(
        db.scalars(
            select(LodLevel).where(LodLevel.run_id == run_id).order_by(LodLevel.level_index)
        ).all()
    )


def get_level(db: Session, level_id: uuid.UUID) -> LodLevel:
    level = db.get(LodLevel, level_id)
    if level is None:
        raise AppError("E_LOD_LEVEL_MISSING", entity="lod_level", field="id")
    return level


def resolve_artifact(level: LodLevel) -> Path:
    path = asset_path(level.file_path)
    if not path.exists():
        raise AppError("E_ARTIFACT_MISSING", entity="lod_level", field="file_path")
    return path


def level_payload(level: LodLevel, base_faces: int) -> dict:
    reduction = 0.0
    if base_faces:
        reduction = round((1 - (level.triangle_count / base_faces)) * 100, 2)
    return {
        "id": str(level.id),
        "run_id": str(level.run_id),
        "level_index": level.level_index,
        "ratio": float(level.ratio),
        "vertex_count": level.vertex_count,
        "triangle_count": level.triangle_count,
        "file_path": level.file_path,
        "screen_space_error": float(level.screen_space_error),
        "download_url": f"/api/levels/{level.id}/download",
        "reduction_pct": reduction,
    }
