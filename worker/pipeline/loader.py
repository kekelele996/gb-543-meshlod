"""格式加载与原始统计采集（trimesh.load，force='mesh'）。"""
from pathlib import Path

import numpy as np
import trimesh

from app.constants.mesh import MeshFormat
from app.utils import logger
from worker.pipeline.context import PipelineAbort


def load_mesh(path: Path, source_format: str) -> trimesh.Trimesh:
    if not path.exists():
        raise PipelineAbort("E_ARTIFACT_MISSING", f"源网格不存在：{path.name}")
    try:
        loaded = trimesh.load(str(path), force="mesh", process=True)
    except Exception as exc:  # noqa: BLE001
        raise PipelineAbort("E_MESH_PARSE_FAIL", f"trimesh 加载失败：{exc}")
    if not isinstance(loaded, trimesh.Trimesh):
        raise PipelineAbort("E_MESH_PARSE_FAIL", "加载结果不是单一网格")
    if len(loaded.faces) == 0:
        raise PipelineAbort("E_MESH_PARSE_FAIL", "网格没有三角面")
    logger.info("MESH_FORMAT_OBJ" if source_format == MeshFormat.OBJ.value else "MESH_FORMAT_GLB")
    return loaded


def mesh_stats(mesh: trimesh.Trimesh) -> dict:
    bounds = np.asarray(mesh.bounds, dtype=float)
    extents = np.asarray(mesh.extents, dtype=float)
    return {
        "vertex_count": int(len(mesh.vertices)),
        "triangle_count": int(len(mesh.faces)),
        "bbox": {
            "min": [round(float(v), 5) for v in bounds[0]],
            "max": [round(float(v), 5) for v in bounds[1]],
            "extents": [round(float(v), 5) for v in extents],
        },
        "sphere_radius": round(float(np.linalg.norm(extents / 2.0)), 6),
        "uv_channel_count": uv_channel_count(mesh),
    }


def uv_channel_count(mesh: trimesh.Trimesh) -> int:
    uv = getattr(mesh.visual, "uv", None)
    return 1 if uv is not None and len(uv) else 0
