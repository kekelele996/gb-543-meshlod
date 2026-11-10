"""JWT 生成与校验（access 12h / refresh 7d，sub 存 user id）。"""
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config.settings import settings
from app.constants.roles import Role

ACCESS_TYPE = "access"
REFRESH_TYPE = "refresh"


def _create(sub: str, role: str, token_type: str, expires: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "role": role,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires).timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: str, role: Role | str) -> str:
    role_value = role.value if isinstance(role, Role) else role
    return _create(user_id, role_value, ACCESS_TYPE, timedelta(hours=settings.ACCESS_TOKEN_HOURS))


def create_refresh_token(user_id: str, role: Role | str) -> str:
    role_value = role.value if isinstance(role, Role) else role
    return _create(user_id, role_value, REFRESH_TYPE, timedelta(days=settings.REFRESH_TOKEN_DAYS))


def decode_token(token: str, expected_type: str = ACCESS_TYPE) -> dict:
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("type") != expected_type:
        raise JWTError("wrong token type")
    return payload
