"""程序化网格生成：seed 用的三个 GLB（真实可被 pipeline 读取与减面）。

说明：为控制容器内演示时长，程序化网格规模按提示词剧本的约 1/10 生成，
比例链、QEM 减面与 SSE 计算流程与真实生产完全一致（详见 TESTING.md 已知差异）。
"""
import numpy as np
import trimesh


def _attach_uv(mesh: trimesh.Trimesh, base_color=(196, 192, 180, 255)) -> trimesh.Trimesh:
    """生成等距圆柱投影 UV，并挂上 PBR 材质（保证 GLB 带 TEXCOORD_0）。"""
    vertices = np.asarray(mesh.vertices, dtype=np.float64)
    lo, hi = vertices.min(axis=0), vertices.max(axis=0)
    extent = np.maximum(hi - lo, 1e-9)
    uv = np.zeros((len(vertices), 2), dtype=np.float64)
    uv[:, 0] = (vertices[:, 0] - lo[0]) / extent[0]
    uv[:, 1] = (vertices[:, 1] - lo[1]) / extent[1]
    material = trimesh.visual.material.PBRMaterial(
        baseColorFactor=list(base_color), metallicFactor=0.05, roughnessFactor=0.72
    )
    mesh.visual = trimesh.visual.TextureVisuals(uv=uv, material=material)
    return mesh


def _scaled_sphere(count: int, scale: tuple[float, float, float], twist: float = 0.0) -> trimesh.Trimesh:
    mesh = trimesh.creation.uv_sphere(count=[count, count], radius=1.0)
    vertices = np.asarray(mesh.vertices, dtype=np.float64).copy()
    if twist:
        angles = vertices[:, 1] * twist
        cos_a, sin_a = np.cos(angles), np.sin(angles)
        x = vertices[:, 0] * cos_a - vertices[:, 2] * sin_a
        z = vertices[:, 0] * sin_a + vertices[:, 2] * cos_a
        vertices[:, 0], vertices[:, 2] = x, z
    vertices = vertices * np.asarray(scale, dtype=np.float64)
    vertices[:, 1] -= vertices[:, 1].min()
    mesh.vertices = vertices
    return mesh


def build_tower(count: int = 178) -> trimesh.Trimesh:
    """园区 A 座塔楼：细高椭圆体 + 楼层收缩（约 1.24e5 三角面）。"""
    mesh = _scaled_sphere(count, (9.0, 46.0, 7.2))
    vertices = np.asarray(mesh.vertices, dtype=np.float64).copy()
    height = max(vertices[:, 1].max(), 1e-6)
    taper = 1.0 - 0.35 * (vertices[:, 1] / height)
    vertices[:, 0] *= taper
    vertices[:, 2] *= taper
    mesh.vertices = vertices
    return _attach_uv(mesh, (188, 196, 206, 255))


def build_bench() -> trimesh.Trimesh:
    """园区长椅扫描件：座面 + 靠背 + 4 条腿，**故意不带 TEXCOORD_0**（约 8e3 三角面）。"""
    parts = []
    seat = trimesh.creation.box(extents=[6.0, 0.35, 1.8])
    seat.apply_translation([0.0, 1.35, 0.0])
    parts.append(seat)
    back = trimesh.creation.box(extents=[6.0, 1.6, 0.22])
    back.apply_translation([0.0, 2.3, -0.8])
    parts.append(back)
    for x in (-2.6, 2.6):
        for z in (-0.7, 0.7):
            leg = trimesh.creation.box(extents=[0.22, 1.35, 0.22])
            leg.apply_translation([x, 0.68, z])
            parts.append(leg)
    mesh = trimesh.util.concatenate(parts)
    for _ in range(3):
        mesh = mesh.subdivide()
    mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh)
    return mesh


def build_sculpture(count: int = 98) -> trimesh.Trimesh:
    """园区雕塑：扭转椭球（法线未重算，约 4e4 三角面）。"""
    mesh = _scaled_sphere(count, (5.0, 7.0, 5.0), twist=1.4)
    return _attach_uv(mesh, (176, 168, 156, 255))


def export(mesh: trimesh.Trimesh, path) -> int:
    data = trimesh.exchange.gltf.export_glb(trimesh.Scene(mesh))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return len(data)
