"""健康检查 controller：给 compose healthcheck 用。"""
from sqlalchemy import text

from app.config.database import SessionLocal
from app.config.redis import get_redis
from app.config.settings import settings


def health() -> dict:
    return {"status": "ok", "service": settings.APP_NAME, "env": settings.ENV}


def ready() -> dict:
    db_ok = True
    redis_ok = True
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
    except Exception:
        db_ok = False
    try:
        get_redis().ping()
    except Exception:
        redis_ok = False
    return {"status": "ok" if (db_ok and redis_ok) else "degraded", "db": db_ok, "redis": redis_ok}
