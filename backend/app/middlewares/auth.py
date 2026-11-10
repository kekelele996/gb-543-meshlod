"""认证中间件：解析 Authorization: Bearer，注入 request.state.user。"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config.database import SessionLocal
from app.models.user import User
from app.utils.errors import AppError
from app.utils.jwt import decode_token

WHITELIST = {
    "/api/health",
    "/api/health/ready",
    "/api/auth/login",
    "/api/auth/refresh",
    "/api/auth/register",
}
WHITELIST_PREFIX = ("/docs", "/openapi.json", "/redoc")


def _unauthorized(message: str = "未认证或登录已过期") -> JSONResponse:
    return JSONResponse(
        status_code=401,
        content={"code": "E_UNAUTHORIZED", "message": message, "entity": None, "field": None, "request_id": None},
    )


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.user = None
        if request.method == "OPTIONS":
            return await call_next(request)
        path = request.url.path
        if path in WHITELIST or path.startswith(WHITELIST_PREFIX):
            return await call_next(request)

        header = request.headers.get("authorization") or ""
        token = header[7:].strip() if header.lower().startswith("bearer ") else None
        if not token:
            return _unauthorized()
        try:
            payload = decode_token(token)
        except Exception:
            return _unauthorized()

        db = SessionLocal()
        try:
            user = db.get(User, payload["sub"])
            if user is None:
                return _unauthorized()
            db.expunge(user)
        finally:
            db.close()
        request.state.user = user
        request.state.user_id = str(user.id)
        return await call_next(request)


def get_current_user(request: Request) -> User:
    user = getattr(request.state, "user", None)
    if user is None:
        raise AppError("E_UNAUTHORIZED")
    return user


def get_optional_user(request: Request) -> User | None:
    return getattr(request.state, "user", None)
