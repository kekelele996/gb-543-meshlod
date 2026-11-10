"""配额路由。"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers import quota_controller
from app.middlewares.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/quota", tags=["quota"])


@router.get("/me")
def me(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return quota_controller.me(db, user)
