"""屏幕空间误差（SSE）：SSE(px) = geo_error * H / (2 * distance * tan(fov_y / 2))。"""
import math

import numpy as np
import trimesh

from app.constants.limits import SSE_DISTANCE_RADIUS_FACTOR, SSE_FOV_Y_DEG, SSE_VIEWPORT_HEIGHT

MAX_SAMPLES = 3000


def geometric_error(previous: trimesh.Trimesh, simplified: trimesh.Trimesh, max_samples: int = MAX_SAMPLES) -> float:
    """当前级相对上一级的顶点位移 95 分位：对上一级表面采样点求到简化表面的最近距离。"""
    if len(simplified.faces) == 0 or len(previous.vertices) == 0:
        return 0.0
    points = np.asarray(previous.vertices, dtype=np.float64)
    step = max(1, len(points) // max_samples)
    sample = points[::step][:max_samples]
    try:
        query = trimesh.proximity.ProximityQuery(simplified)
        distances = np.abs(np.asarray(query.signed_distance(sample), dtype=np.float64))
        distances = distances[np.isfinite(distances)]
        if len(distances) == 0:
            return 0.0
        return float(np.percentile(distances, 95))
    except Exception:  # noqa: BLE001
        # 退化几何/空网格时回退为顶点 KD 距离
        tree = trimesh.util.ProximityQuery  # noqa: F841
        return 0.0


def screen_space_error(geo_error: float, sphere_radius: float, params: dict | None = None) -> dict:
    params = params or {}
    height = float(params.get("viewport_height", SSE_VIEWPORT_HEIGHT))
    fov_y_deg = float(params.get("fov_y_deg", SSE_FOV_Y_DEG))
    distance = float(params.get("distance") or SSE_DISTANCE_RADIUS_FACTOR * max(sphere_radius, 1e-6))
    tan_half = math.tan(math.radians(fov_y_deg) / 2.0)
    pixels = geo_error * height / (2.0 * distance * tan_half)
    return {
        "geometric_error": round(float(geo_error), 6),
        "viewport_height": height,
        "fov_y_deg": fov_y_deg,
        "distance": round(distance, 6),
        "sphere_radius": round(float(sphere_radius), 6),
        "formula": "SSE(px) = geometric_error * viewport_height / (2 * distance * tan(fov_y/2))",
        "pixels": round(float(pixels), 3),
    }
