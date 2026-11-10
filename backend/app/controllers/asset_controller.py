"""资产 controller。"""
import uuid

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.config.storage import artifact_root
from app.middlewares import upload_guard
from app.models.user import User
from app.schemas.mesh_asset import MeshAssetOut
from app.services import audit_service, mesh_service, permission_service, quota_service
from app.services.thumbnail_service import thumbnail_path


async def upload(request, db: Session, user: User, file: UploadFile) -> dict:
    quota = quota_service.get_or_create(db, user)
    upload_guard.preflight(request, quota.max_upload_mb)
    fmt = upload_guard.check_extension(file.filename or "")
    data = await upload_guard.read_limited(file, quota.max_upload_mb)
    upload_guard.check_magic(fmt, data[:8])
    asset, duplicate = mesh_service.save_upload(db, user, file.filename or f"upload.{fmt}", data)
    audit_service.write(
        db,
        actor_id=user.id,
        action="asset.upload",
        entity_type="asset",
        entity_id=str(asset.id),
        payload={"name": asset.name, "bytes": len(data), "duplicate": duplicate},
        ip=request.client.host if request.client else None,
    )
    payload = mesh_service.asset_payload(asset)
    return {"asset": payload, "duplicate": duplicate, "message": "内容相同，已返回既有资产" if duplicate else "网格已解析并生成统计"}


def list_assets(db: Session, sort: str, order: str, status: str | None) -> dict:
    assets = mesh_service.list_assets(db, sort=sort, order=order, status=status)
    items = [mesh_service.asset_payload(asset) for asset in assets]
    return {"items": items, "total": len(items), "page": 1, "page_size": len(items)}


def detail(db: Session, asset_id: uuid.UUID) -> dict:
    asset = mesh_service.get_asset(db, asset_id)
    return mesh_service.asset_payload(asset)


def remove(request, db: Session, user: User, asset_id: uuid.UUID) -> dict:
    asset = mesh_service.get_asset(db, asset_id)
    permission_service.require_delete_asset(user, asset)
    mesh_service.delete_asset(db, asset)
    audit_service.write(
        db,
        actor_id=user.id,
        action="asset.delete",
        entity_type="asset",
        entity_id=str(asset_id),
        payload={"name": asset.name},
        ip=request.client.host if request.client else None,
    )
    return {"message": "资产已删除"}


def thumbnail(db: Session, asset_id: uuid.UUID):
    asset = mesh_service.get_asset(db, asset_id)
    path = artifact_root() / f"thumbs/{asset.id}.png"
    if not path.exists() and asset.file_path:
        from app.services import thumbnail_service

        mesh = mesh_service.parse_mesh(artifact_root() / asset.file_path)
        thumbnail_service.render_thumbnail(mesh, str(asset.id))
    return thumbnail_path(f"thumbs/{asset.id}.png")


def source_file(db: Session, asset_id: uuid.UUID):
    asset = mesh_service.get_asset(db, asset_id)
    return mesh_service.asset_file(db, asset), asset


def sample(db: Session, user: User) -> dict:
    asset = mesh_service.create_sample_cube(db, user)
    return {"asset": mesh_service.asset_payload(asset), "message": "已载入示例立方体网格"}
