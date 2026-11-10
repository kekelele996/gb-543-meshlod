"""预处理四步：焊接顶点 → 去退化面 → 法线重算 → UV 检查。"""
from dataclasses import dataclass, field

import numpy as np
import trimesh

from app.utils import logger
from worker.pipeline.context import PipelineAbort
from worker.pipeline.loader import uv_channel_count

DEGENERATE_AREA_EPS = 1e-12


@dataclass
class PreprocessResult:
    mesh: trimesh.Trimesh
    welded_removed: int = 0
    degenerate_removed: int = 0
    normals_fixed: bool = False
    uv_channel_count: int = 0
    warnings: list[str] = field(default_factory=list)


def _weld(mesh: trimesh.Trimesh, ctx) -> int:
    before = len(mesh.vertices)
    mesh.merge_vertices(digits_vertex=6)
    removed = before - len(mesh.vertices)
    logger.info("LOD_STAGE_PREPROCESS", welded=removed, removed=0, normals=False)
    return max(removed, 0)


def _remove_degenerate(mesh: trimesh.Trimesh) -> int:
    areas = np.asarray(mesh.area_faces, dtype=float)
    keep = np.isfinite(areas) & (areas >= DEGENERATE_AREA_EPS)
    removed = int((~keep).sum())
    if removed:
        mesh.update_faces(keep)
    return removed


def _fix_normals(mesh: trimesh.Trimesh) -> bool:
    try:
        trimesh.repair.fix_normals(mesh, multibody=True)
    except Exception:
        try:
            trimesh.repair.fix_normals(mesh)
        except Exception:
            return False
    return True


def preprocess(mesh: trimesh.Trimesh, flags: dict, ctx) -> PreprocessResult:
    result = PreprocessResult(mesh=mesh)
    if flags.get("weld", True):
        ctx.info("预处理 · 焊接顶点（digits_vertex=6）")
        result.welded_removed = _weld(mesh, ctx)
        ctx.info(f"焊接完成：合并 {result.welded_removed} 个重复顶点")
    if flags.get("degnerate", True):
        ctx.info("预处理 · 删除面积 < 1e-12 的退化面")
        result.degenerate_removed = _remove_degenerate(mesh)
        ctx.info(f"退化面清理完成：删除 {result.degenerate_removed} 个三角面")
    if flags.get("normals", True):
        ctx.info("预处理 · 重算面法线与顶点法线")
        result.normals_fixed = _fix_normals(mesh)
        mesh.remove_unreferenced_vertices()
        ctx.info("法线重算完成（fix_normals + 顶点法线重建）")

    ctx.set_stage("uv_check")
    channels = uv_channel_count(mesh)
    result.uv_channel_count = channels
    ctx.info(f"UV 检查：TEXCOORD_0 {'存在' if channels else '缺失'}")
    if channels == 0:
        message = "未检测到 TEXCOORD_0（UV 通道），material 视图不可用"
        if flags.get("uv_check", True):
            ctx.error("UV 检查失败：缺少 TEXCOORD_0，管线在 uv_check 阶段中止")
            raise PipelineAbort("E_UV_MISSING", message, stage="uv_check")
        ctx.warn(message)
        result.warnings.append(message)
    logger.info(
        "LOD_STAGE_PREPROCESS",
        welded=result.welded_removed,
        removed=result.degenerate_removed,
        normals=result.normals_fixed,
    )
    return result
