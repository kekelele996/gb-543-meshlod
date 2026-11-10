"""LOD 层级 controller：列表与逐级下载。"""
import uuid

from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.models.run_log import RunLog  # noqa: F401  (确保 relationship 解析)
from app.services import lod_service, run_service


def list_by_run(db: Session, run_id: uuid.UUID) -> dict:
    run = run_service.get_run(db, run_id)
    base = run.mesh.triangle_count if run.mesh else 0
    levels = lod_service.list_levels(db, run.id)
    return {
        "items": [lod_service.level_payload(level, base) for level in levels],
        "total": len(levels),
        "base_triangle_count": base,
    }


def download(db: Session, level_id: uuid.UUID) -> StreamingResponse:
    level = lod_service.get_level(db, level_id)
    path = lod_service.resolve_artifact(level)

    def iterator():
        with open(path, "rb") as fh:
            while True:
                chunk = fh.read(1024 * 256)
                if not chunk:
                    break
                yield chunk

    filename = f"{level.file_path.split('/')[-1]}"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(iterator(), media_type="model/gltf-binary", headers=headers)
