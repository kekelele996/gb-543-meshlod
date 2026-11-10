"""MeshAsset：上传的网格资产（统计与包围盒来自真实解析）。"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base
from app.constants.asset import AssetStatus
from app.constants.mesh import MeshFormat


class MeshAsset(Base):
    __tablename__ = "mesh_assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    source_format: Mapped[str] = mapped_column(
        Enum(MeshFormat, name="mesh_format", native_enum=False, length=8), nullable=False
    )
    vertex_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    triangle_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    file_path: Mapped[str] = mapped_column(String(255), nullable=False)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        Enum(AssetStatus, name="asset_status", native_enum=False, length=16),
        nullable=False,
        default=AssetStatus.UPLOADED.value,
    )
    bbox_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    uv_channel_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    owner = relationship("User", back_populates="assets")
    runs = relationship("PipelineRun", back_populates="mesh")
