"""健康检查路由（中间件白名单）。"""
from fastapi import APIRouter

from app.controllers import health_controller

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return health_controller.health()


@router.get("/health/ready")
def ready():
    return health_controller.ready()
