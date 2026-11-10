"""LOD 层级路由：逐级下载。"""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers import level_controller
from app.middlewares.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/levels", tags=["levels"])


@router.get("/run/{run_id}")
def list_by_run(run_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return level_controller.list_by_run(db, run_id)


@router.get("/{level_id}/download")
def download(level_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return level_controller.download(db, level_id)
