"""运行上下文：run_id、日志写入器、进度上报器、取消检查点。"""
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config.database import SessionLocal
from app.config.redis import is_canceled, publish_progress
from app.constants.run import LogLevel, RunStatus
from app.models.pipeline_run import PipelineRun
from app.models.run_log import RunLog
from app.utils import logger


class RunCanceled(Exception):
    """worker 在检查点发现取消标记。"""


class PipelineAbort(Exception):
    """业务失败（带错误码），run 进入 failed。"""

    def __init__(self, code: str, message: str, stage: str | None = None) -> None:
        self.code = code
        self.message = message
        self.stage = stage
        super().__init__(message)


class RunContext:
    def __init__(self, run_id: str | uuid.UUID) -> None:
        self.run_id = uuid.UUID(str(run_id))
        self.db: Session = SessionLocal()

    def close(self) -> None:
        self.db.close()

    # ---- 日志 ----
    def log(self, level: str, message: str) -> None:
        self.db.add(RunLog(run_id=self.run_id, level=level, message=message))
        self.db.commit()
        if level == LogLevel.WARN.value:
            logger.warn("LOD_LEVEL_DONE", index="-", faces=0, sse=0, ms=0) if False else None

    def info(self, message: str) -> None:
        self.log(LogLevel.INFO.value, message)

    def warn(self, message: str) -> None:
        self.log(LogLevel.WARN.value, message)

    def error(self, message: str) -> None:
        self.log(LogLevel.ERROR.value, message)

    # ---- 状态 ----
    def _run(self) -> PipelineRun:
        run = self.db.get(PipelineRun, self.run_id)
        if run is None:
            raise PipelineAbort("E_NOT_FOUND", f"run {self.run_id} 不存在")
        return run

    def get_run(self) -> PipelineRun:
        return self._run()

    def mark_running(self, stage: str = "load") -> None:
        run = self._run()
        previous = run.status
        run.status = RunStatus.RUNNING.value
        run.started_at = run.started_at or datetime.now(timezone.utc)
        run.stats_json = {**(run.stats_json or {}), "stage": stage}
        self.db.add(run)
        self.db.commit()
        logger.info("RUN_STATUS_TRANSITION", run_id=str(self.run_id), from_status=previous, to_status=run.status)

    def set_progress(self, progress: int, stage: str) -> None:
        run = self._run()
        run.progress = max(0, min(100, int(progress)))
        run.stats_json = {**(run.stats_json or {}), "stage": stage}
        self.db.add(run)
        self.db.commit()
        publish_progress(
            str(self.run_id), {"progress": run.progress, "status": run.status, "stage": stage}
        )

    def set_stage(self, stage: str) -> None:
        run = self._run()
        run.stats_json = {**(run.stats_json or {}), "stage": stage}
        self.db.add(run)
        self.db.commit()

    def update_stats(self, updates: dict) -> None:
        run = self._run()
        stats = dict(run.stats_json or {})
        stats.update(updates)
        run.stats_json = stats
        self.db.add(run)
        self.db.commit()

    def finish(self, status: str, error_message: str | None = None, stats: dict | None = None) -> None:
        run = self._run()
        previous = run.status
        run.status = status
        run.finished_at = datetime.now(timezone.utc)
        if error_message:
            run.error_message = error_message
        if stats:
            merged = dict(run.stats_json or {})
            merged.update(stats)
            run.stats_json = merged
        else:
            run.stats_json = {**(run.stats_json or {}), "stage": status}
        self.db.add(run)
        self.db.commit()
        publish_progress(str(self.run_id), {"progress": run.progress, "status": run.status, "stage": status})
        logger.info("RUN_STATUS_TRANSITION", run_id=str(self.run_id), from_status=previous, to_status=status)

    # ---- 取消 ----
    def check_cancel(self, stage: str) -> None:
        if is_canceled(str(self.run_id)):
            raise RunCanceled(f"canceled at {stage}")
