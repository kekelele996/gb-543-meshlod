"""QEM 减面封装：trimesh.simplify_quadric_decimation（底层 fast_simplification），
不可用时退化为顶点聚类实现并写 warn（不静默造假数据）。
"""
import numpy as np
import trimesh

from app.utils import logger


def _cluster_decimate(mesh: trimesh.Trimesh, target_faces: int) -> trimesh.Trimesh:
    """降级实现：体素聚类合并顶点（保留真实几何，非 QEM）。"""
    vertices = np.asarray(mesh.vertices, dtype=np.float64)
    faces = np.asarray(mesh.faces, dtype=np.int64)
    if len(vertices) == 0 or len(faces) == 0:
        return mesh
    ratio = max(min(target_faces / max(len(faces), 1), 1.0), 0.01)
    resolution = max(int(round(np.sqrt(len(vertices) / max(ratio, 1e-6)))), 4)
    lo, hi = vertices.min(axis=0), vertices.max(axis=0)
    extent = np.maximum(hi - lo, 1e-9)
    grid = np.floor((vertices - lo) / extent * (resolution - 1)).astype(np.int64)
    keys, inverse = np.unique(grid, axis=0, return_inverse=True)
    clustered = np.zeros((len(keys), 3))
    counts = np.bincount(inverse, minlength=len(keys))
    for axis in range(3):
        clustered[:, axis] = np.bincount(inverse, weights=vertices[:, axis], minlength=len(keys)) / counts
    new_faces = inverse[faces]
    valid = (new_faces[:, 0] != new_faces[:, 1]) & (new_faces[:, 1] != new_faces[:, 2]) & (
        new_faces[:, 0] != new_faces[:, 2]
    )
    new_faces = new_faces[valid]
    out = trimesh.Trimesh(vertices=clustered, faces=new_faces, process=False)
    return out


def decimate(mesh: trimesh.Trimesh, target_faces: int) -> tuple[trimesh.Trimesh, str]:
    """返回 (简化网格, 实际使用的实现名)。"""
    target = int(max(target_faces, 4))
    try:
        simplified = mesh.simplify_quadric_decimation(face_count=target)
        if simplified is not None and len(simplified.faces) > 0:
            return simplified, "trimesh.simplify_quadric_decimation"
    except Exception as exc:  # noqa: BLE001
        logger.warn("LOD_LEVEL_SKIPPED", index="-", target=target, base=len(mesh.faces))
        _ = exc
    fallback = _cluster_decimate(mesh, target)
    return fallback, "cluster-fallback"


def decimation_warning(impl: str) -> str | None:
    if impl == "trimesh.simplify_quadric_decimation":
        return None
    return "QEM 库不可用，本级使用顶点聚类降级减面（数值仍来自真实几何）"
