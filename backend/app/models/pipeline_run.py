"""PipelineRun：一次真实运行（参数快照 + 统计 + 进度）。"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, SmallInteger, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base
from app.constants.run import RunStatus


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("process_pipelines.id"), nullable=False)
    mesh_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("mesh_assets.id"), nullable=False)
    requested_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(
        Enum(RunStatus, name="run_status", native_enum=False, length=16),
        nullable=False,
        default=RunStatus.QUEUED.value,
    )
    progress: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    stats_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    pipeline = relationship("ProcessPipeline", back_populates="runs")
    mesh = relationship("MeshAsset", back_populates="runs")
    requested_by = relationship("User", back_populates="runs")
    levels = relationship(
        "LodLevel", back_populates="run", cascade="all, delete-orphan", order_by="LodLevel.level_index"
    )
    logs = relationship("RunLog", back_populates="run", cascade="all, delete-orphan")
