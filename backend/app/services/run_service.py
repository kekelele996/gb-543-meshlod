"""运行服务：入队、取消、重试、状态推进、日志游标。"""
import threading
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.redis import publish_progress
from app.config.settings import settings
from app.constants.asset import AssetStatus
from app.constants.limits import SSE_FOV_Y_DEG, SSE_VIEWPORT_HEIGHT
from app.constants.messages import MSG_RUN_CANCELED, MSG_RUN_QUEUED, MSG_RUN_RETRIED
from app.constants.run import CANCELABLE_STATUSES, RunStatus
from app.models.lod_level import LodLevel
from app.models.mesh_asset import MeshAsset
from app.models.pipeline_run import PipelineRun
from app.models.process_pipeline import ProcessPipeline
from app.models.run_log import RunLog
from app.models.user import User
from app.services import audit_service, lod_service, permission_service, pipeline_service, quota_service
from app.services.auth_service import logger
from app.utils.errors import AppError


def _stage_from(stats: dict | None) -> str | None:
    return (stats or {}).get("stage")


def run_payload(run: PipelineRun, base_faces: int | None = None, include_logs: bool = False) -> dict:
    levels = [lod_service.level_payload(level, base_faces or run.mesh.triangle_count if run.mesh else 0) for level in run.levels]
    payload = {
        "id": str(run.id),
        "pipeline_id": str(run.pipeline_id),
        "mesh_id": str(run.mesh_id),
        "requested_by_id": str(run.requested_by_id),
        "status": run.status,
        "progress": int(run.progress or 0),
        "stats_json": run.stats_json or {},
        "error_message": run.error_message,
        "started_at": run.started_at,
        "finished_at": run.finished_at,
        "created_at": run.created_at,
        "pipeline_name": run.pipeline.name if run.pipeline else None,
        "mesh_name": run.mesh.name if run.mesh else None,
        "mesh_triangle_count": run.mesh.triangle_count if run.mesh else None,
        "mesh_format": run.mesh.source_format if run.mesh else None,
        "requested_by_name": run.requested_by.display_name if run.requested_by else None,
        "levels": levels,
        "stage": _stage_from(run.stats_json),
        "cancelable": run.status in CANCELABLE_STATUSES,
    }
    if include_logs:
        payload["logs"] = [
            {
                "id": log.id,
                "run_id": str(log.run_id),
                "level": log.level,
                "message": log.message,
                "created_at": log.created_at,
            }
            for log in run.logs
        ]
    return payload


def get_run(db: Session, run_id: uuid.UUID) -> PipelineRun:
    run = db.get(PipelineRun, run_id)
    if run is None:
        raise AppError("E_NOT_FOUND", entity="run", field="id")
    return run


def list_runs(db: Session, status: str | None = None, limit: int = 100) -> list[PipelineRun]:
    stmt = select(PipelineRun).order_by(PipelineRun.created_at.desc()).limit(limit)
    if status:
        stmt = stmt.where(PipelineRun.status == status)
    return list(db.scalars(stmt).all())


def create_run(db: Session, user: User, pipeline: ProcessPipeline, mesh: MeshAsset) -> PipelineRun:
    permission_service.require_write(user, "run:create")
    if mesh.status == AssetStatus.INVALID.value:
        raise AppError("E_ASSET_INVALID", entity="asset", field="status")
    if mesh.status != AssetStatus.READY.value:
        raise AppError("E_CONFLICT", "资产尚未完成解析，暂不能进入管线", entity="asset", field="status")
    quota_service.acquire(db, user)
    run = PipelineRun(
        pipeline_id=pipeline.id,
        mesh_id=mesh.id,
        requested_by_id=user.id,
        status=RunStatus.QUEUED.value,
        progress=0,
        stats_json={
            "pipeline_snapshot": pipeline_service.freeze_snapshot(pipeline, "pending"),
            "sse": {
                "viewport_height": SSE_VIEWPORT_HEIGHT,
                "fov_y_deg": SSE_FOV_Y_DEG,
                "distance_factor": 3.0,
            },
            "stage": "queued",
        },
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    run.stats_json = {**(run.stats_json or {}), "pipeline_snapshot": pipeline_service.freeze_snapshot(pipeline, str(run.id))}
    db.add(run)
    db.commit()
    publish_progress(str(run.id), {"progress": 0, "status": RunStatus.QUEUED.value, "stage": "queued"})
    audit_service.write(
        db,
        actor_id=user.id,
        action="run.create",
        entity_type="run",
        entity_id=str(run.id),
        payload={"pipeline": str(pipeline.id), "mesh": str(mesh.id)},
    )
    logger.info(
        "RUN_CREATED",
        run_id=str(run.id),
        pipeline=pipeline.name,
        mesh=mesh.name,
        user=user.email,
    )
    enqueue_run(str(run.id))
    return run


def enqueue_run(run_id: str) -> str:
    """优先交给 Celery worker；broker 不可用时退化为本进程线程，保证演示可用。"""
    try:
        from worker.tasks.lod_tasks import run_lod_pipeline

        run_lod_pipeline.delay(run_id)
        return "celery"
    except Exception as exc:  # noqa: BLE001
        logger.warning("celery enqueue failed (%s), fallback to in-process thread", exc)
        from worker.tasks.lod_tasks import run_lod_pipeline as task_fn

        threading.Thread(target=task_fn.run, args=(run_id,), daemon=True).start()
        return "thread"


def cancel_run(db: Session, user: User, run: PipelineRun) -> PipelineRun:
    permission_service.require_write(user, "run:cancel")
    if run.status not in CANCELABLE_STATUSES:
        raise AppError("E_RUN_NOT_CANCELABLE", entity="run", field="status")
    from app.config.redis import request_cancel

    request_cancel(str(run.id))
    run.status = RunStatus.CANCELED.value
    run.finished_at = datetime.now(timezone.utc)
    run.error_message = MSG_RUN_CANCELED
    run.stats_json = {**(run.stats_json or {}), "stage": "canceled"}
    db.add(run)
    db.commit()
    db.refresh(run)
    publish_progress(str(run.id), {"progress": run.progress, "status": run.status, "stage": "canceled"})
    audit_service.write(
        db, actor_id=user.id, action="run.cancel", entity_type="run", entity_id=str(run.id), payload={}
    )
    logger.info("RUN_CANCEL_REQUEST", run_id=str(run.id), actor=user.email)
    return run


def retry_run(db: Session, user: User, run: PipelineRun) -> PipelineRun:
    permission_service.require_write(user, "run:retry")
    pipeline = db.get(ProcessPipeline, run.pipeline_id)
    mesh = db.get(MeshAsset, run.mesh_id)
    if pipeline is None or mesh is None:
        raise AppError("E_NOT_FOUND", entity="run", field="pipeline_id")
    new_run = create_run(db, user, pipeline, mesh)
    audit_service.write(
        db,
        actor_id=user.id,
        action="run.retry",
        entity_type="run",
        entity_id=str(new_run.id),
        payload={"from_run": str(run.id)},
    )
    logger.info("RUN_CREATED", run_id=str(new_run.id), pipeline=pipeline.name, mesh=mesh.name, user=user.email)
    return new_run


def logs_after(db: Session, run_id: uuid.UUID, after_id: int = 0, limit: int = 200) -> list[dict]:
    rows = db.scalars(
        select(RunLog)
        .where(RunLog.run_id == run_id, RunLog.id > after_id)
        .order_by(RunLog.id.asc())
        .limit(limit)
    ).all()
    return [
        {
            "id": row.id,
            "run_id": str(row.run_id),
            "level": row.level,
            "message": row.message,
            "created_at": row.created_at,
        }
        for row in rows
    ]


def run_stats_payload(run: PipelineRun) -> dict:
    stats = dict(run.stats_json or {})
    stats["run_id"] = str(run.id)
    stats["status"] = run.status
    stats["pipeline_name"] = run.pipeline.name if run.pipeline else None
    stats["mesh_name"] = run.mesh.name if run.mesh else None
    stats["levels"] = [
        {
            "level_index": level.level_index,
            "ratio": float(level.ratio),
            "vertex_count": level.vertex_count,
            "triangle_count": level.triangle_count,
            "screen_space_error": float(level.screen_space_error),
        }
        for level in run.levels
    ]
    return stats


def mark_levels(run: PipelineRun) -> None:
    """调试辅助：读取 LodLevel 行（供 controller 直接使用）。"""
    _ = [level for level in run.levels]
    _ = LodLevel
