"""审计路由。"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers import audit_controller
from app.middlewares.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
def list_by_entity(
    entity_type: str,
    entity_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return audit_controller.list_by_entity(db, entity_type, entity_id, limit)
