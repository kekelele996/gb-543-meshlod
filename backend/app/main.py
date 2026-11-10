"""MeshLOD backend 入口：5 服务中的 backend（worker 复用同一镜像）。"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401  确保所有模型注册到 metadata
from app.config.database import Base, SessionLocal, engine
from app.config.logging import configure_logging
from app.config.settings import settings
from app.config.storage import ensure_dirs
from app.middlewares.audit_logger import AuditMiddleware
from app.middlewares.auth import AuthMiddleware
from app.middlewares.error_handler import register_exception_handlers
from app.routes import assets, audit, auth, health, levels, pipelines, quota, runs
from app.utils import logger

configure_logging("INFO")
log = logging.getLogger("meshlod.main")


def _seed_if_enabled() -> None:
    if not settings.SEED_DEMO:
        return
    try:
        from app.scripts.seed_demo import seed

        logger.info("SEED_DEMO_START", users=3)
        result = seed()
        logger.info(
            "SEED_DEMO_DONE",
            assets=result.get("assets", 0),
            pipelines=result.get("pipelines", 0),
            runs=result.get("runs", 0),
        )
    except Exception as exc:  # noqa: BLE001  seed 失败不能阻塞启动
        logger.warn("SEED_FAILED", error=str(exc)[:300])
        log.warning("seed failed, continue startup: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("APP_START", env=settings.ENV, seed=str(settings.SEED_DEMO))
    ensure_dirs()
    from app.scripts.wait_for_db import wait_for_db

    wait_for_db()
    Base.metadata.create_all(bind=engine)
    logger.info("DB_READY", host=settings.DB_HOST, db=settings.DB_NAME)
    try:
        from app.config.redis import get_redis

        get_redis().ping()
        logger.info("REDIS_CONNECTED", url=settings.REDIS_URL)
    except Exception:
        log.warning("redis not reachable at startup")
    _seed_if_enabled()
    yield


app = FastAPI(
    title="MeshLOD · 三维网格减面与 LOD 管线平台",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    openapi_url="/openapi.json",
)
register_exception_handlers(app)
app.add_middleware(AuthMiddleware)
app.add_middleware(AuditMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (health, auth, assets, pipelines, runs, levels, quota, audit):
    app.include_router(module.router, prefix="/api")


@app.get("/")
def root():
    return {"service": "meshlod-backend", "docs": "/docs", "health": "/api/health"}
