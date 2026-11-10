"""管线路由：保存/另存模板要求 artist+。"""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers import pipeline_controller
from app.middlewares.auth import get_current_user
from app.models.user import User
from app.schemas.process_pipeline import PipelineIn

router = APIRouter(prefix="/pipelines", tags=["pipelines"])


@router.get("")
def list_pipelines(
    templates_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return pipeline_controller.list_pipelines(db, templates_only)


@router.post("")
def create(payload: PipelineIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return pipeline_controller.create(db, user, payload)


@router.get("/{pipeline_id}")
def detail(pipeline_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return pipeline_controller.detail(db, pipeline_id)


@router.put("/{pipeline_id}")
def update(
    pipeline_id: uuid.UUID,
    payload: PipelineIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return pipeline_controller.update(db, user, pipeline_id, payload)
