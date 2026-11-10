"""资产路由：上传要求 artist+；删除他人资产仅 admin。"""
import uuid

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers import asset_controller
from app.middlewares.auth import get_current_user
from app.models.user import User
from app.services import audit_service, permission_service

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("")
def list_assets(
    sort: str = "created_at",
    order: str = "desc",
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return asset_controller.list_assets(db, sort, order, status)


@router.post("")
async def upload(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    permission_service.require_write(user, "asset:upload")
    return await asset_controller.upload(request, db, user, file)


@router.post("/sample")
def sample(request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    permission_service.require_write(user, "asset:upload")
    result = asset_controller.sample(db, user)
    audit_service.write(
        db,
        actor_id=user.id,
        action="asset.sample",
        entity_type="asset",
        entity_id=result["asset"]["id"],
        payload={"name": "sample_cube.glb"},
        ip=request.client.host if request.client else None,
    )
    return result


@router.get("/{asset_id}")
def detail(asset_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return asset_controller.detail(db, asset_id)


@router.get("/{asset_id}/runs")
def asset_runs(asset_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from app.models.pipeline_run import PipelineRun
    from app.services import run_service
    from sqlalchemy import select

    rows = db.scalars(
        select(PipelineRun).where(PipelineRun.mesh_id == asset_id).order_by(PipelineRun.created_at.desc())
    ).all()
    return {"items": [run_service.run_payload(run) for run in rows], "total": len(rows)}


@router.get("/{asset_id}/thumbnail")
def thumbnail(asset_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    path = asset_controller.thumbnail(db, asset_id)
    return FileResponse(path, media_type="image/png")


@router.get("/{asset_id}/file")
def source_file(asset_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    path, asset = asset_controller.source_file(db, asset_id)
    return FileResponse(path, media_type="application/octet-stream", filename=asset.name)


@router.get("/{asset_id}/audit")
def asset_audit(
    asset_id: uuid.UUID, limit: int = 50, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    from app.controllers import audit_controller

    return audit_controller.list_by_entity(db, "asset", str(asset_id), limit)


@router.delete("/{asset_id}")
def remove(
    request: Request, asset_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return asset_controller.remove(request, db, user, asset_id)
