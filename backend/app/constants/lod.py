"""LodStrategy：减面策略枚举（与前端 constants/lodStrategy.ts 一一对应）。"""
from enum import Enum


class LodStrategy(str, Enum):
    RATIO_CHAIN = "ratio_chain"
    TARGET_ERROR = "target_error"
    ADAPTIVE = "adaptive"


LOD_STRATEGIES = [s.value for s in LodStrategy]
STRATEGY_LABELS = {
    LodStrategy.RATIO_CHAIN: "比例链",
    LodStrategy.TARGET_ERROR: "误差预算",
    LodStrategy.ADAPTIVE: "自适应面数",
}
