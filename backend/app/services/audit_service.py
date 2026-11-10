"""审计服务：写请求统一挂钩，payload 脱敏。"""
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User
from app.utils import logger

SENSITIVE_KEYS = {"password", "token", "access_token", "refresh_token", "authorization"}


def desensitize(payload: dict | None) -> dict:
    if not isinstance(payload, dict):
        return {}
    out = {}
    for key, value in payload.items():
        if key.lower() in SENSITIVE_KEYS:
            out[key] = "***"
        elif isinstance(value, dict):
            out[key] = desensitize(value)
        else:
            out[key] = value
    return out


def write(
    db: Session,
    *,
    actor_id: uuid.UUID | None,
    action: str,
    entity_type: str,
    entity_id: str,
    payload: dict | None = None,
    ip: str | None = None,
    result: str = "accepted",
) -> AuditLog:
    row = AuditLog(
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        payload_json=desensitize(payload),
        ip=ip,
        result=result,
    )
    db.add(row)
    try:
        db.commit()
    except Exception:
        db.rollback()
    logger.info("AUDIT_WRITE", action=action, entity_type=entity_type, entity_id=str(entity_id), result=result)
    return row


def list_for_entity(db: Session, entity_type: str, entity_id: str, limit: int = 50) -> list[dict]:
    rows = db.scalars(
        select(AuditLog)
        .where(AuditLog.entity_type == entity_type, AuditLog.entity_id == str(entity_id))
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    ).all()
    users = {u.id: u.display_name for u in db.scalars(select(User)).all()}
    out = []
    for row in rows:
        item = {
            "id": row.id,
            "actor_id": str(row.actor_id) if row.actor_id else None,
            "action": row.action,
            "entity_type": row.entity_type,
            "entity_id": row.entity_id,
            "payload_json": row.payload_json or {},
            "ip": row.ip,
            "result": row.result,
            "created_at": row.created_at,
            "actor_name": users.get(row.actor_id),
        }
        out.append(item)
    return out
