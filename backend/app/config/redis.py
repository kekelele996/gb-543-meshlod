"""Redis 连接（进度发布、取消标记、Celery broker）。"""
from functools import lru_cache

import redis

from app.config.settings import settings


@lru_cache
def get_redis() -> "redis.Redis":
    return redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)


def publish_progress(run_id: str, payload: dict) -> None:
    import json

    try:
        client = get_redis()
        client.set(f"run:progress:{run_id}", json.dumps(payload), ex=3600)
        client.publish(f"run:channel:{run_id}", json.dumps(payload))
    except Exception:  # Redis 不可用时不能阻断业务
        pass


def request_cancel(run_id: str) -> None:
    try:
        get_redis().set(f"run:cancel:{run_id}", "1", ex=3600)
    except Exception:
        pass


def is_canceled(run_id: str) -> bool:
    try:
        return get_redis().get(f"run:cancel:{run_id}") == "1"
    except Exception:
        return False
