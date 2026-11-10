"""认证服务：登录、刷新、用户读取。"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.constants.messages import MSG_LOGIN_FAIL, MSG_LOGIN_OK
from app.models.user import User
from app.utils import logger
from app.utils.errors import AppError
from app.utils.jwt import create_access_token, create_refresh_token, decode_token
from app.utils.password import verify_password


def authenticate(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == email.lower()))
    if not user or not verify_password(password, user.password_hash):
        logger.warn("AUTH_LOGIN_FAIL", email=email, reason="bad_credentials")
        raise AppError("E_UNAUTHORIZED", MSG_LOGIN_FAIL)
    logger.info("AUTH_LOGIN_OK", email=user.email, role=user.role)
    return user


def issue_tokens(user: User) -> dict:
    return {
        "access_token": create_access_token(str(user.id), user.role),
        "refresh_token": create_refresh_token(str(user.id), user.role),
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_HOURS * 3600,
        "user": user,
    }


def refresh(db: Session, refresh_token: str) -> dict:
    payload = decode_token(refresh_token, expected_type="refresh")
    user = db.get(User, payload["sub"])
    if not user:
        raise AppError("E_UNAUTHORIZED")
    logger.info("AUTH_TOKEN_REFRESH", user_id=str(user.id))
    return issue_tokens(user)
