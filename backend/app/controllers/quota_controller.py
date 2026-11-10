"""配额 controller。"""
from sqlalchemy.orm import Session

from app.models.user import User
from app.services import quota_service


def me(db: Session, user: User) -> dict:
    return quota_service.snapshot(db, user)
