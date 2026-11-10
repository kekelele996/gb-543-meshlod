"""RunStatus：运行状态枚举（与前端 constants/runStatus.ts 一一对应）。"""
from enum import Enum


class RunStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELED = "canceled"


RUN_STATUSES = [s.value for s in RunStatus]
TERMINAL_STATUSES = {
    RunStatus.SUCCEEDED.value,
    RunStatus.FAILED.value,
    RunStatus.CANCELED.value,
}
CANCELABLE_STATUSES = {RunStatus.QUEUED.value, RunStatus.RUNNING.value}
STATUS_LABELS = {
    RunStatus.QUEUED: "排队中",
    RunStatus.RUNNING: "运行中",
    RunStatus.SUCCEEDED: "已完成",
    RunStatus.FAILED: "失败",
    RunStatus.CANCELED: "已取消",
}


class LogLevel(str, Enum):
    INFO = "info"
    WARN = "warn"
    ERROR = "error"
