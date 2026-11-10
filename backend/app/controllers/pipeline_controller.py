"""管线 controller。"""
import uuid

from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.process_pipeline import PipelineIn
from app.services import audit_service, permission_service, pipeline_service


def _payload(pipeline) -> dict:
    return {
        "id": str(pipeline.id),
        "owner_id": str(pipeline.owner_id),
        "name": pipeline.name,
        "strategy": pipeline.strategy,
        "target_ratios_json": [float(r) for r in (pipeline.target_ratios_json or [])],
        "strategy_params_json": pipeline.strategy_params_json or {},
        "repair_flags_json": pipeline.repair_flags_json or {},
        "is_template": pipeline.is_template,
        "created_at": pipeline.created_at,
        "owner_name": pipeline.owner.display_name if pipeline.owner else None,
    }


def list_pipelines(db: Session, templates_only: bool) -> dict:
    pipelines = pipeline_service.list_pipelines(db, templates_only)
    return {"items": [_payload(p) for p in pipelines], "total": len(pipelines)}


def detail(db: Session, pipeline_id: uuid.UUID) -> dict:
    return _payload(pipeline_service.get_pipeline(db, pipeline_id))


def create(db: Session, user: User, payload: PipelineIn) -> dict:
    permission_service.require_write(user, "pipeline:create")
    pipeline = pipeline_service.create_pipeline(db, user, payload)
    audit_service.write(
        db,
        actor_id=user.id,
        action="pipeline.create",
        entity_type="pipeline",
        entity_id=str(pipeline.id),
        payload={"name": payload.name, "strategy": payload.strategy, "ratios": payload.target_ratios},
    )
    return {"pipeline": _payload(pipeline), "message": "管线已保存"}


def update(db: Session, user: User, pipeline_id: uuid.UUID, payload: PipelineIn) -> dict:
    pipeline = pipeline_service.get_pipeline(db, pipeline_id)
    permission_service.require_edit_pipeline(user, pipeline)
    pipeline = pipeline_service.update_pipeline(db, pipeline, payload, user)
    audit_service.write(
        db,
        actor_id=user.id,
        action="pipeline.update",
        entity_type="pipeline",
        entity_id=str(pipeline.id),
        payload={"name": payload.name, "ratios": payload.target_ratios},
    )
    return {"pipeline": _payload(pipeline), "message": "管线已保存"}
