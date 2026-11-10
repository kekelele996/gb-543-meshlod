"""上传体积与并发运行配额。"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants.limits import MAX_CONCURRENT_RUNS_DEFAULT, MAX_UPLOAD_MB_DEFAULT, QUOTA_WINDOW_HOURS
from app.constants.run import RunStatus
from app.models.pipeline_run import PipelineRun
from app.models.quota import Quota
from app.models.user import User
from app.utils import logger
from app.utils.errors import AppError


def get_or_create(db: Session, user: User) -> Quota:
    quota = db.scalar(select(Quota).where(Quota.user_id == user.id))
    if quota is None:
        quota = Quota(
            user_id=user.id,
            max_upload_mb=MAX_UPLOAD_MB_DEFAULT,
            max_concurrent_runs=MAX_CONCURRENT_RUNS_DEFAULT,
            used_runs=0,
            window_start=datetime.now(timezone.utc),
        )
        db.add(quota)
        db.commit()
        db.refresh(quota)
    return quota


def _active_runs(db: Session, user: User) -> int:
    rows = db.scalars(
        select(PipelineRun).where(
            PipelineRun.requested_by_id == user.id,
            PipelineRun.status.in_([RunStatus.QUEUED.value, RunStatus.RUNNING.value]),
        )
    ).all()
    return len(rows)


def acquire(db: Session, user: User) -> Quota:
    quota = get_or_create(db, user)
    active = _active_runs(db, user)
    if active >= quota.max_concurrent_runs:
        logger.warn("QUOTA_REJECT", user=str(user.id), reason="max_concurrent")
        raise AppError(
            "E_QUOTA_EXCEEDED",
            f"并发运行已达上限（{active}/{quota.max_concurrent_runs}），请等待当前运行结束",
            entity="quota",
            field="max_concurrent_runs",
        )
    quota.used_runs += 1
    if quota.window_start is None or quota.window_start < datetime.now(timezone.utc) - timedelta(hours=QUOTA_WINDOW_HOURS):
        quota.window_start = datetime.now(timezone.utc)
    db.add(quota)
    db.commit()
    db.refresh(quota)
    return quota


def snapshot(db: Session, user: User) -> dict:
    quota = get_or_create(db, user)
    active = _active_runs(db, user)
    return {
        "user_id": str(quota.user_id),
        "max_upload_mb": quota.max_upload_mb,
        "max_concurrent_runs": quota.max_concurrent_runs,
        "used_runs": quota.used_runs,
        "window_start": quota.window_start,
        "remaining_runs": max(0, quota.max_concurrent_runs - active),
        "active_runs": active,
    }
