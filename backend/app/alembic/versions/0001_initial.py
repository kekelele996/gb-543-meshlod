"""初始表结构（起步阶段与 create_all 等价，后续用 autogenerate 增量迁移）。

Revision ID: 0001_initial
"""
from alembic import op

import app.models  # noqa: F401
from app.config.database import Base

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())
