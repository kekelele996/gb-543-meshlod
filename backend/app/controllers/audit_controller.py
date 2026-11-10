"""审计 controller。"""
from sqlalchemy.orm import Session

from app.services import audit_service


def list_by_entity(db: Session, entity_type: str, entity_id: str, limit: int) -> dict:
    items = audit_service.list_for_entity(db, entity_type, entity_id, limit)
    return {"items": items, "total": len(items)}
