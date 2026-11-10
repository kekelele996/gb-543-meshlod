"""审计中间件：写请求在响应后落一条 audit_logs，失败请求记 result=rejected。"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.config.database import SessionLocal
from app.services import audit_service

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
SKIP_PATHS = {"/api/auth/login", "/api/auth/refresh", "/api/auth/register"}
ENTITY_MAP = {
    "assets": "asset",
    "pipelines": "pipeline",
    "runs": "run",
    "levels": "level",
    "quota": "quota",
    "audit": "audit",
    "auth": "auth",
}


def _entity_from_path(path: str) -> tuple[str, str]:
    parts = [p for p in path.split("/") if p]
    if len(parts) < 2:
        return "unknown", "unknown"
    entity_type = ENTITY_MAP.get(parts[1], parts[1])
    entity_id = parts[2] if len(parts) > 2 else "-"
    return entity_type, entity_id


def _action(method: str, entity_type: str) -> str:
    mapping = {"POST": "create", "PUT": "update", "PATCH": "update", "DELETE": "delete"}
    return f"{entity_type}.{mapping.get(method, method.lower())}"


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.method not in WRITE_METHODS or request.url.path in SKIP_PATHS:
            return response
        if not request.url.path.startswith("/api/"):
            return response
        user = getattr(request.state, "user", None)
        entity_type, entity_id = _entity_from_path(request.url.path)
        db = SessionLocal()
        try:
            audit_service.write(
                db,
                actor_id=getattr(user, "id", None),
                action=_action(request.method, entity_type),
                entity_type=entity_type,
                entity_id=entity_id,
                payload={"method": request.method, "path": request.url.path, "query": dict(request.query_params)},
                ip=request.client.host if request.client else None,
                result="accepted" if response.status_code < 400 else "rejected",
            )
        except Exception:
            pass
        finally:
            db.close()
        return response
