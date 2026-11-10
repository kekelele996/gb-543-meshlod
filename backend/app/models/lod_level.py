"""LodLevel：单级 LOD（顶点/三角面/SSE 均为真实计算值）。"""
import uuid

from sqlalchemy import ForeignKey, Integer, Numeric, SmallInteger, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base


class LodLevel(Base):
    __tablename__ = "lod_levels"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pipeline_runs.id", ondelete="CASCADE"), nullable=False
    )
    level_index: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    ratio: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    vertex_count: Mapped[int] = mapped_column(Integer, nullable=False)
    triangle_count: Mapped[int] = mapped_column(Integer, nullable=False)
    file_path: Mapped[str] = mapped_column(String(255), nullable=False)
    screen_space_error: Mapped[float] = mapped_column(Numeric(8, 3), nullable=False, default=0)

    run = relationship("PipelineRun", back_populates="levels")
