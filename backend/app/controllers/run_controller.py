"""运行 controller：创建、取消、重试、日志游标、SSE 事件流。"""
import asyncio
import uuid

from sqlalchemy.orm import Session

from app.config.database import SessionLocal
from app.constants.run import TERMINAL_STATUSES
from app.models.pipeline_run import PipelineRun
from app.models.user import User
from app.schemas.run import RunCreate
from app.services import mesh_service, pipeline_service, run_service
from app.utils.sse import sse_event


def list_runs(db: Session, status: str | None, limit: int) -> dict:
    runs = run_service.list_runs(db, status=status, limit=limit)
    return {"items": [run_service.run_payload(run) for run in runs], "total": len(runs)}


def detail(db: Session, run_id: uuid.UUID) -> dict:
    run = run_service.get_run(db, run_id)
    return run_service.run_payload(run, include_logs=True)


def create(db: Session, user: User, payload: RunCreate) -> dict:
    pipeline = pipeline_service.get_pipeline(db, payload.pipeline_id)
    mesh = mesh_service.get_asset(db, payload.mesh_id)
    run = run_service.create_run(db, user, pipeline, mesh)
    db.refresh(run)
    return run_service.run_payload(run)


def cancel(db: Session, user: User, run_id: uuid.UUID) -> dict:
    run = run_service.get_run(db, run_id)
    run = run_service.cancel_run(db, user, run)
    return run_service.run_payload(run)


def retry(db: Session, user: User, run_id: uuid.UUID) -> dict:
    run = run_service.get_run(db, run_id)
    new_run = run_service.retry_run(db, user, run)
    db.refresh(new_run)
    return run_service.run_payload(new_run)


def logs(db: Session, run_id: uuid.UUID, after_id: int, limit: int) -> dict:
    run = run_service.get_run(db, run_id)
    rows = run_service.logs_after(db, run.id, after_id, limit)
    return {"items": rows, "total": len(rows), "last_id": rows[-1]["id"] if rows else after_id}


def stats(run_id: uuid.UUID) -> dict:
    db = SessionLocal()
    try:
        run = run_service.get_run(db, run_id)
        return run_service.run_stats_payload(run)
    finally:
        db.close()


def _poll(run_id: uuid.UUID, last_log_id: int) -> tuple[dict | None, list[dict]]:
    db = SessionLocal()
    try:
        run = db.get(PipelineRun, run_id)
        if run is None:
            return None, []
        payload = run_service.run_payload(run)
        rows = run_service.logs_after(db, run_id, last_log_id, 200)
        return payload, rows
    finally:
        db.close()


async def event_stream(run_id: uuid.UUID):
    """SSE：进度事件 + 增量日志；终态后发送 done 并关闭。"""
    last_log_id = 0
    while True:
        payload, rows = await asyncio.to_thread(_poll, run_id, last_log_id)
        if payload is None:
            yield sse_event("error", {"message": "run not found"})
            return
        yield sse_event(
            "progress",
            {
                "run_id": str(run_id),
                "status": payload["status"],
                "progress": payload["progress"],
                "stage": payload["stage"],
            },
        )
        for row in rows:
            last_log_id = row["id"]
            yield sse_event("log", row)
        if payload["status"] in TERMINAL_STATUSES:
            yield sse_event("done", {"status": payload["status"], "progress": payload["progress"]})
            return
        await asyncio.sleep(1.0)
