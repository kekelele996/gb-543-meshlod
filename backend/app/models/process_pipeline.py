"""ProcessPipeline：减面管线（保存模板 / 运行冻结快照）。"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base
from app.constants.lod import LodStrategy


class ProcessPipeline(Base):
    __tablename__ = "process_pipelines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(96), nullable=False)
    strategy: Mapped[str] = mapped_column(
        Enum(LodStrategy, name="lod_strategy", native_enum=False, length=16),
        nullable=False,
        default=LodStrategy.RATIO_CHAIN.value,
    )
    target_ratios_json: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    strategy_params_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    repair_flags_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    is_template: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    owner = relationship("User", back_populates="pipelines")
    runs = relationship("PipelineRun", back_populates="pipeline")
