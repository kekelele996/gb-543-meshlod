"""权限判定：读全局可读；写要求 artist+；删除仅 owner 或 admin。"""
import uuid

from app.constants.roles import WRITE_ROLES, Role
from app.models.mesh_asset import MeshAsset
from app.models.process_pipeline import ProcessPipeline
from app.models.user import User
from app.utils import logger
from app.utils.errors import AppError


def is_admin(user: User) -> bool:
    return user.role == Role.ADMIN.value


def can_write(user: User) -> bool:
    return user.role in WRITE_ROLES


def require_write(user: User, action: str) -> None:
    if not can_write(user):
        logger.warn("AUTH_FORBIDDEN", user_id=str(user.id), role=user.role, action=action)
        raise AppError("E_FORBIDDEN", entity=action)


def can_read_asset(user: User, asset: MeshAsset) -> bool:
    return True


def can_delete_asset(user: User, asset: MeshAsset) -> bool:
    return is_admin(user) or str(asset.owner_id) == str(user.id)


def require_delete_asset(user: User, asset: MeshAsset) -> None:
    if not can_delete_asset(user, asset):
        logger.warn("AUTH_FORBIDDEN", user_id=str(user.id), role=user.role, action="asset:delete")
        raise AppError("E_FORBIDDEN", entity="asset", field="owner_id")


def can_edit_pipeline(user: User, pipeline: ProcessPipeline) -> bool:
    return is_admin(user) or str(pipeline.owner_id) == str(user.id)


def require_edit_pipeline(user: User, pipeline: ProcessPipeline) -> None:
    if not can_edit_pipeline(user, pipeline):
        raise AppError("E_FORBIDDEN", entity="pipeline", field="owner_id")


def assert_uuid(value: str, field: str = "id") -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except Exception:
        raise AppError("E_BAD_REQUEST", entity=field, field=field)
