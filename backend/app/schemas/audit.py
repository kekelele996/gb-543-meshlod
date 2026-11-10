"""AuditLog schema（与前端 types/audit.ts 字段一一对应）。"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_id: uuid.UUID | None
    action: str
    entity_type: str
    entity_id: str
    payload_json: dict
    ip: str | None
    result: str
    created_at: datetime
    actor_name: str | None = None
