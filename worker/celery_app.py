"""Celery 应用：队列声明、任务路由、超时与重试策略。"""
from celery import Celery

from app.config.settings import settings

celery_app = Celery(
    "meshlod",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["worker.tasks.lod_tasks", "worker.tasks.thumb_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_default_queue="lod",
    task_routes={
        "lod.run_lod_pipeline": {"queue": "lod"},
        "lod.generate_thumbnail": {"queue": "lod"},
    },
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=60 * 20,
    task_time_limit=60 * 25,
    broker_connection_retry_on_startup=True,
    result_expires=3600,
)
