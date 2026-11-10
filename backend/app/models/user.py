"""User：3 角色（admin/artist/viewer）。"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base
from app.constants.roles import Role


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(64), nullable=False)
    role: Mapped[str] = mapped_column(
        Enum(Role, name="user_role", native_enum=False, length=16), nullable=False, default=Role.VIEWER.value
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    assets = relationship("MeshAsset", back_populates="owner")
    pipelines = relationship("ProcessPipeline", back_populates="owner")
    runs = relationship("PipelineRun", back_populates="requested_by")
    quota = relationship("Quota", back_populates="user", uselist=False)
