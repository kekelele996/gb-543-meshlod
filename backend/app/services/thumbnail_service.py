"""缩略图：把真实几何投影成线框图，用 Pillow 落 PNG。"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from app.config.storage import artifact_root, rel

WIDTH, HEIGHT = 320, 240
MAX_LINES = 2600


def _apply(mesh, name):
    try:
        getattr(mesh, name)()
        return mesh
    except Exception:
        return mesh


def render_thumbnail(mesh, asset_id: str) -> str:
    """返回相对 ARTIFACT_DIR 的缩略图路径。"""
    vertices = np.asarray(mesh.vertices, dtype=np.float64)
    faces = np.asarray(mesh.faces, dtype=np.int64)
    if len(vertices) == 0 or len(faces) == 0:
        raise ValueError("empty mesh")

    center = (vertices.min(axis=0) + vertices.max(axis=0)) / 2.0
    pts = vertices - center
    radius = float(np.max(np.linalg.norm(pts, axis=1))) or 1.0
    pts = pts / radius

    yaw, pitch = np.deg2rad(35.0), np.deg2rad(22.0)
    r_yaw = np.array([[np.cos(yaw), 0, np.sin(yaw)], [0, 1, 0], [-np.sin(yaw), 0, np.cos(yaw)]])
    r_pitch = np.array([[1, 0, 0], [0, np.cos(pitch), -np.sin(pitch)], [0, np.sin(pitch), np.cos(pitch)]])
    proj = pts @ (r_pitch @ r_yaw).T
    xy = proj[:, :2] * 0.42 + 0.5
    xy[:, 1] = 1.0 - xy[:, 1]

    canvas = Image.new("RGB", (WIDTH, HEIGHT), (247, 246, 243))
    draw = ImageDraw.Draw(canvas)
    step = max(1, len(faces) // MAX_LINES)
    sample = faces[::step]
    coords = (xy * np.array([WIDTH, HEIGHT])).astype(np.int32)
    for tri in sample:
        a, b, c = coords[tri[0]], coords[tri[1]], coords[tri[2]]
        draw.line([tuple(a), tuple(b), tuple(c), tuple(a)], fill=(92, 108, 128), width=1)

    out_dir = artifact_root() / "thumbs"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{asset_id}.png"
    canvas.save(out_path, format="PNG")
    return rel(out_path)


def thumbnail_path(relative: str) -> Path:
    return artifact_root() / relative
