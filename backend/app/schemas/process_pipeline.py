"""ProcessPipeline schema：比例链校验在前端即时校验 + 后端二次校验。"""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.constants.lod import LodStrategy
from app.constants.messages import MSG_PIPELINE_SAVED


class RepairFlags(BaseModel):
    weld: bool = True
    degnerate: bool = True
    normals: bool = True
    uv_check: bool = True


class StrategyParams(BaseModel):
    target_error_px: float | None = None
    min_faces: int | None = None
    max_faces: int | None = None


class PipelineIn(BaseModel):
    name: str = Field(min_length=1, max_length=96)
    strategy: Literal["ratio_chain", "target_error", "adaptive"] = "ratio_chain"
    target_ratios: list[float] = Field(default_factory=lambda: [1.0, 0.5, 0.25, 0.1])
    repair_flags: RepairFlags = Field(default_factory=RepairFlags)
    strategy_params: StrategyParams = Field(default_factory=StrategyParams)
    is_template: bool = False

    @model_validator(mode="after")
    def _validate_chain(self) -> "PipelineIn":
        ratios = [float(r) for r in self.target_ratios]
        if not ratios:
            raise ValueError("比例链不能为空")
        if any(r <= 0 or r > 1 for r in ratios):
            raise ValueError("每个比例必须满足 0 < ratio <= 1")
        for prev, cur in zip(ratios, ratios[1:]):
            if cur >= prev:
                raise ValueError("比例链必须严格递减（例如 100/50/25/10）")
        if ratios[-1] <= 0:
            raise ValueError("比例链最后一项必须 > 0")
        if self.strategy == LodStrategy.TARGET_ERROR.value and not (self.strategy_params.target_error_px or 0) > 0:
            raise ValueError("target_error 策略必须给出 > 0 的误差预算（px）")
        if self.strategy == LodStrategy.ADAPTIVE.value:
            lo = self.strategy_params.min_faces or 0
            hi = self.strategy_params.max_faces or 0
            if hi <= 0 or lo <= 0 or hi <= lo:
                raise ValueError("adaptive 策略需要 0 < min_faces < max_faces")
        return self


class PipelineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    strategy: str
    target_ratios_json: list[float]
    strategy_params_json: dict
    repair_flags_json: dict
    is_template: bool
    created_at: datetime
    owner_name: str | None = None


class PipelineSaved(BaseModel):
    pipeline: PipelineOut
    message: str = MSG_PIPELINE_SAVED
