"""认证 controller：只做参数装配与响应包装。"""
from sqlalchemy.orm import Session

from app.schemas.auth import LoginRequest, RefreshRequest
from app.services import auth_service


def login(db: Session, payload: LoginRequest) -> dict:
    user = auth_service.authenticate(db, payload.email, payload.password)
    tokens = auth_service.issue_tokens(user)
    tokens["user"] = user
    return tokens


def refresh(db: Session, payload: RefreshRequest) -> dict:
    return auth_service.refresh(db, payload.refresh_token)
