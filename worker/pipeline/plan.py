"""策略分支：把 LodStrategy 变成逐级 (ratio, target_faces) 计划。"""
from dataclasses import dataclass

from app.constants.lod import LodStrategy


@dataclass
class PlannedLevel:
    index: int
    ratio: float
    target_faces: int
    skip: bool = False
    note: str | None = None


def _chain_plan(ratios: list[float], base_faces: int) -> list[PlannedLevel]:
    plan: list[PlannedLevel] = []
    for index, ratio in enumerate(ratios):
        ratio = float(ratio)
        target = int(round(base_faces * ratio))
        skip = (index > 0 and target >= base_faces) or target < 4
        plan.append(
            PlannedLevel(
                index=index,
                ratio=ratio,
                target_faces=target,
                skip=skip,
                note=None if not skip else f"target {target} >= base {base_faces} 或过小，跳过",
            )
        )
    return plan


def _target_error_plan(params: dict, base_faces: int) -> list[PlannedLevel]:
    budget = float(params.get("target_error_px") or 6.0)
    ratios: list[float] = [1.0]
    level = 1
    # 经验估算：每减半一次，几何误差约增长 1.6 倍；用预算反推需要的级数
    while level <= 5:
        ratio = round(0.5 ** level, 4)
        estimated = 1.6 ** (level - 1) * 1.2
        if estimated > budget * 1.5:
            break
        ratios.append(ratio)
        level += 1
    if len(ratios) == 1:
        ratios.append(0.5)
    return _chain_plan(ratios, base_faces)


def _adaptive_plan(params: dict, base_faces: int) -> list[PlannedLevel]:
    min_faces = int(params.get("min_faces") or 2000)
    max_faces = int(params.get("max_faces") or max(base_faces // 2, min_faces + 1000))
    top = min(max_faces, base_faces)
    bottom = max(min_faces, 100)
    ratios = [1.0]
    current = top
    while current > bottom and len(ratios) < 6:
        current = max(int(current * 0.5), bottom)
        ratios.append(round(min(current / base_faces, 1.0), 4))
        if current == bottom:
            break
    unique: list[float] = []
    for ratio in ratios:
        if not unique or ratio < unique[-1]:
            unique.append(ratio)
    return _chain_plan(unique, base_faces)


def build_plan(strategy: str, ratios: list[float], params: dict, base_faces: int) -> list[PlannedLevel]:
    if strategy == LodStrategy.TARGET_ERROR.value:
        return _target_error_plan(params or {}, base_faces)
    if strategy == LodStrategy.ADAPTIVE.value:
        return _adaptive_plan(params or {}, base_faces)
    return _chain_plan(ratios or [1.0, 0.5, 0.25, 0.1], base_faces)
