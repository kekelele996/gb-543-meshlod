"""缩略图异步任务。"""
import uuid

from app.config.storage import artifact_root
from app.models.mesh_asset import MeshAsset
from app.services import mesh_service, thumbnail_service
from worker.celery_app import celery_app
from worker.pipeline.loader import load_mesh


@celery_app.task(name="lod.generate_thumbnail", max_retries=1)
def generate_thumbnail(asset_id: str) -> dict:
    from app.config.database import SessionLocal

    db = SessionLocal()
    try:
        asset = db.get(MeshAsset, uuid.UUID(str(asset_id)))
        if asset is None:
            return {"status": "missing"}
        mesh = load_mesh(artifact_root() / asset.file_path, asset.source_format)
        rel_path = thumbnail_service.render_thumbnail(mesh, str(asset.id))
        return {"status": "ok", "thumb": rel_path}
    finally:
        db.close()
