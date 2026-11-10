"""网格服务：上传解析、统计采集、缩略图、示例立方体。"""
import shutil
import uuid
from pathlib import Path

import numpy as np
import trimesh
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.storage import artifact_root, rel
from app.constants.asset import AssetStatus
from app.constants.limits import MAX_UPLOAD_MB_DEFAULT
from app.constants.mesh import MESH_EXTENSIONS, MeshFormat
from app.constants.messages import MSG_UPLOAD_DUPLICATE, MSG_UPLOAD_OK
from app.models.mesh_asset import MeshAsset
from app.models.user import User
from app.services import thumbnail_service
from app.utils import logger
from app.utils.errors import AppError
from app.utils.hashing import sha256_bytes


def detect_format(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix not in MESH_EXTENSIONS:
        raise AppError("E_UNSUPPORTED_FORMAT", entity="asset", field="source_format")
    return suffix.lstrip(".")


def mesh_uv_channels(mesh: trimesh.Trimesh) -> int:
    uv = getattr(mesh.visual, "uv", None)
    return 1 if uv is not None and len(uv) else 0


def parse_mesh(path: Path) -> trimesh.Trimesh:
    try:
        loaded = trimesh.load(str(path), force="mesh", process=True)
    except Exception as exc:  # noqa: BLE001
        logger.warn("MESH_PARSE_FAIL", name=path.name, error=str(exc)[:200])
        raise AppError("E_MESH_PARSE_FAIL", entity="asset", field="file")
    if not isinstance(loaded, trimesh.Trimesh) or len(loaded.faces) == 0:
        raise AppError("E_MESH_PARSE_FAIL", entity="asset", field="file")
    return loaded


def bbox_payload(mesh: trimesh.Trimesh) -> dict:
    bounds = np.asarray(mesh.bounds, dtype=float)
    return {
        "min": [round(float(v), 5) for v in bounds[0]],
        "max": [round(float(v), 5) for v in bounds[1]],
        "extents": [round(float(v), 5) for v in mesh.extents],
        "sphere_radius": round(float(np.linalg.norm(mesh.extents / 2.0)), 5),
    }


def _log_format(fmt: str) -> None:
    if fmt == MeshFormat.GLB.value:
        logger.info("MESH_FORMAT_GLB")
    elif fmt == MeshFormat.GLTF.value:
        logger.info("MESH_FORMAT_GLTF")
    else:
        logger.info("MESH_FORMAT_OBJ")


def _persist_asset(
    db: Session, user: User, name: str, fmt: str, data: bytes, asset_id: uuid.UUID | None = None
) -> MeshAsset:
    checksum = sha256_bytes(data)
    existing = db.scalar(select(MeshAsset).where(MeshAsset.checksum == checksum))
    if existing is not None:
        return existing

    asset_id = asset_id or uuid.uuid4()
    assets_dir = artifact_root() / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    target = assets_dir / f"{asset_id}.{fmt}"
    target.write_bytes(data)

    mesh = parse_mesh(target)
    uv_channels = mesh_uv_channels(mesh)
    thumb_rel = thumbnail_service.render_thumbnail(mesh, str(asset_id))
    asset = MeshAsset(
        id=asset_id,
        owner_id=user.id,
        name=name[:128],
        source_format=fmt,
        vertex_count=int(len(mesh.vertices)),
        triangle_count=int(len(mesh.faces)),
        file_path=rel(target),
        checksum=checksum,
        status=AssetStatus.READY.value,
        bbox_json=bbox_payload(mesh),
        uv_channel_count=uv_channels,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    logger.info(
        "MESH_UPLOAD_OK",
        name=asset.name,
        format=fmt,
        tris=asset.triangle_count,
        bytes=len(data),
    )
    if uv_channels == 0:
        logger.warn("MESH_UV_MISSING", asset_id=str(asset.id))
    logger.info("MESH_THUMB_DONE", asset_id=str(asset.id))
    return asset


def save_upload(db: Session, user: User, filename: str, data: bytes) -> tuple[MeshAsset, bool]:
    fmt = detect_format(filename)
    if not data:
        raise AppError("E_EMPTY_FILE", entity="asset", field="file")
    _log_format(fmt)
    if fmt == MeshFormat.GLB.value and data[:4] != b"glTF":
        raise AppError("E_UNSUPPORTED_FORMAT", "GLB 文件头不是 glTF magic bytes", entity="asset", field="file")
    existing = db.scalar(select(MeshAsset).where(MeshAsset.checksum == sha256_bytes(data)))
    asset = _persist_asset(db, user, Path(filename).name, fmt, data)
    duplicate = existing is not None
    if duplicate:
        logger.info("MESH_UPLOAD_DUPLICATE", checksum=asset.checksum, asset_id=str(asset.id))
    return asset, duplicate


def save_from_path(
    db: Session,
    user: User,
    path: Path,
    filename: str | None = None,
    asset_id: uuid.UUID | None = None,
) -> MeshAsset:
    """seed 使用：把已生成的网格文件登记为资产（可指定固定 uuid 保证幂等）。"""
    name = filename or path.name
    fmt = detect_format(name)
    data = path.read_bytes()
    attempt = 0
    if asset_id is not None and db.get(MeshAsset, asset_id) is not None:
        existing = db.get(MeshAsset, asset_id)
        if existing is not None:
            return existing
    while True:
        try:
            return _persist_asset(db, user, name, fmt, data, asset_id=asset_id)
        except Exception:
            if asset_id is None or attempt > 0:
                raise
            attempt += 1
            asset_id = uuid.uuid4()


def create_sample_cube(db: Session, user: User) -> MeshAsset:
    mesh = trimesh.creation.box(extents=[2.0, 2.0, 2.0])
    mesh = mesh.subdivide().subdivide()
    uv = np.zeros((len(mesh.vertices), 2), dtype=np.float64)
    uv[:, 0] = (mesh.vertices[:, 0] - mesh.vertices[:, 0].min()) / max(
        float(np.ptp(mesh.vertices[:, 0])), 1e-9
    )
    uv[:, 1] = (mesh.vertices[:, 1] - mesh.vertices[:, 1].min()) / max(
        float(np.ptp(mesh.vertices[:, 1])), 1e-9
    )
    material = trimesh.visual.material.PBRMaterial(
        baseColorFactor=[210, 208, 200, 255], metallicFactor=0.05, roughnessFactor=0.75
    )
    mesh.visual = trimesh.visual.TextureVisuals(uv=uv, material=material)
    tmp = artifact_root() / "assets" / f"sample_cube_{uuid.uuid4().hex[:8]}.glb"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    tmp.write_bytes(mesh.export(file_type="glb"))
    return save_from_path(db, user, tmp, "sample_cube.glb")


def list_assets(db: Session, sort: str = "created_at", order: str = "desc", status: str | None = None) -> list[MeshAsset]:
    stmt = select(MeshAsset)
    if status:
        stmt = stmt.where(MeshAsset.status == status)
    column = {
        "triangle_count": MeshAsset.triangle_count,
        "created_at": MeshAsset.created_at,
        "name": MeshAsset.name,
    }.get(sort, MeshAsset.created_at)
    stmt = stmt.order_by(column.desc() if order == "desc" else column.asc())
    return list(db.scalars(stmt).all())


def get_asset(db: Session, asset_id: uuid.UUID) -> MeshAsset:
    asset = db.get(MeshAsset, asset_id)
    if asset is None:
        raise AppError("E_NOT_FOUND", entity="asset", field="id")
    return asset


def asset_file(db: Session, asset: MeshAsset) -> Path:
    path = artifact_root() / asset.file_path
    if not path.exists():
        raise AppError("E_ARTIFACT_MISSING", entity="asset", field="file_path")
    return path


def delete_asset(db: Session, asset: MeshAsset) -> None:
    path = artifact_root() / asset.file_path
    thumb = artifact_root() / f"thumbs/{asset.id}.png"
    for candidate in (path, thumb):
        try:
            if candidate.exists():
                candidate.unlink()
        except OSError:
            pass
    db.delete(asset)
    db.commit()
    logger.info("MESH_DELETE", asset_id=str(asset.id), actor=str(asset.owner_id))


def max_upload_bytes() -> int:
    return MAX_UPLOAD_MB_DEFAULT * 1024 * 1024


def asset_payload(asset: MeshAsset) -> dict:
    return {
        "id": str(asset.id),
        "owner_id": str(asset.owner_id),
        "name": asset.name,
        "source_format": asset.source_format,
        "vertex_count": asset.vertex_count,
        "triangle_count": asset.triangle_count,
        "file_path": asset.file_path,
        "checksum": asset.checksum,
        "status": asset.status,
        "bbox_json": asset.bbox_json or {},
        "uv_channel_count": asset.uv_channel_count,
        "created_at": asset.created_at,
        "thumb_url": f"/api/assets/{asset.id}/thumbnail",
        "owner_name": getattr(asset.owner, "display_name", None) if hasattr(asset, "owner") else None,
    }
