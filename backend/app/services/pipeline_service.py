"""管线服务：比例链二次校验、模板保存、运行参数快照。"""
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants.lod import LodStrategy, STRATEGY_LABELS
from app.constants.messages import MSG_PIPELINE_SAVED
from app.models.process_pipeline import ProcessPipeline
from app.models.user import User
from app.schemas.process_pipeline import PipelineIn
from app.utils import logger
from app.utils.errors import AppError


def validate_chain(ratios: list[float]) -> list[float]:
    values = [float(r) for r in ratios]
    if not values:
        raise AppError("E_PIPELINE_INVALID", "比例链不能为空", entity="pipeline", field="target_ratios")
    for value in values:
        if value <= 0 or value > 1:
            raise AppError(
                "E_PIPELINE_INVALID", "每个比例必须满足 0 < ratio <= 1", entity="pipeline", field="target_ratios"
            )
    for index in range(1, len(values)):
        if values[index] >= values[index - 1]:
            raise AppError(
                "E_PIPELINE_INVALID",
                f"第 {index + 1} 项（{values[index] * 100:.0f}%）必须小于上一项（{values[index - 1] * 100:.0f}%）",
                entity="pipeline",
                field=f"target_ratios[{index}]",
            )
    return values


def list_pipelines(db: Session, templates_only: bool = False) -> list[ProcessPipeline]:
    stmt = select(ProcessPipeline).order_by(ProcessPipeline.created_at.asc())
    if templates_only:
        stmt = stmt.where(ProcessPipeline.is_template.is_(True))
    return list(db.scalars(stmt).all())


def get_pipeline(db: Session, pipeline_id: uuid.UUID) -> ProcessPipeline:
    pipeline = db.get(ProcessPipeline, pipeline_id)
    if pipeline is None:
        raise AppError("E_NOT_FOUND", entity="pipeline", field="id")
    return pipeline


def default_pipeline(db: Session) -> ProcessPipeline | None:
    return db.scalar(
        select(ProcessPipeline)
        .where(ProcessPipeline.is_template.is_(True))
        .order_by(ProcessPipeline.created_at.asc())
    ) or db.scalar(select(ProcessPipeline).order_by(ProcessPipeline.created_at.asc()))


def create_pipeline(
    db: Session, user: User, payload: PipelineIn, pipeline_id: uuid.UUID | None = None
) -> ProcessPipeline:
    ratios = validate_chain(payload.target_ratios)
    _log_strategy(payload.strategy, ratios, payload)
    pipeline = ProcessPipeline(
        id=pipeline_id,
        owner_id=user.id,
        name=payload.name,
        strategy=payload.strategy,
        target_ratios_json=ratios,
        strategy_params_json=payload.strategy_params.model_dump(),
        repair_flags_json=payload.repair_flags.model_dump(),
        is_template=payload.is_template,
    )
    db.add(pipeline)
    db.commit()
    db.refresh(pipeline)
    logger.info("PIPELINE_SAVED", pipeline_id=str(pipeline.id), actor=user.email, is_template=pipeline.is_template)
    return pipeline


def update_pipeline(db: Session, pipeline: ProcessPipeline, payload: PipelineIn, user: User) -> ProcessPipeline:
    ratios = validate_chain(payload.target_ratios)
    _log_strategy(payload.strategy, ratios, payload)
    pipeline.name = payload.name
    pipeline.strategy = payload.strategy
    pipeline.target_ratios_json = ratios
    pipeline.strategy_params_json = payload.strategy_params.model_dump()
    pipeline.repair_flags_json = payload.repair_flags.model_dump()
    pipeline.is_template = payload.is_template
    db.add(pipeline)
    db.commit()
    db.refresh(pipeline)
    logger.info("PIPELINE_SAVED", pipeline_id=str(pipeline.id), actor=user.email, is_template=pipeline.is_template)
    return pipeline


def _log_strategy(strategy: str, ratios: list[float], payload: PipelineIn) -> None:
    if strategy == LodStrategy.RATIO_CHAIN.value:
        logger.info("LOD_STRATEGY_RATIO_CHAIN", ratios="/".join(f"{r * 100:.0f}" for r in ratios))
    elif strategy == LodStrategy.TARGET_ERROR.value:
        logger.info("LOD_STRATEGY_TARGET_ERROR", budget=payload.strategy_params.target_error_px)
    else:
        logger.info(
            "LOD_STRATEGY_ADAPTIVE",
            min_faces=payload.strategy_params.min_faces,
            max_faces=payload.strategy_params.max_faces,
        )


def freeze_snapshot(pipeline: ProcessPipeline, run_id: str) -> dict:
    """运行冻结参数快照：之后改管线不影响历史 run。"""
    snapshot = {
        "pipeline_id": str(pipeline.id),
        "name": pipeline.name,
        "strategy": pipeline.strategy,
        "strategy_label": STRATEGY_LABELS.get(pipeline.strategy, pipeline.strategy),
        "target_ratios": [float(r) for r in (pipeline.target_ratios_json or [])],
        "strategy_params": pipeline.strategy_params_json or {},
        "repair_flags": pipeline.repair_flags_json or {},
        "frozen_at_run": run_id,
    }
    logger.info("PIPELINE_FROZEN", run_id=run_id)
    return snapshot
