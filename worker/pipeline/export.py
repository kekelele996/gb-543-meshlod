"""GLB 导出与路径登记。"""
from pathlib import Path

import trimesh

from app.config.storage import artifact_root, rel
from app.utils import logger
from worker.pipeline.context import PipelineAbort


def export_glb(mesh: trimesh.Trimesh, run_id: str, level_index: int) -> tuple[str, int]:
    """导出到 ARTIFACT_DIR/runs/{run_id}/lod_{i}.glb，返回 (相对路径, 字节数)。"""
    out_dir = artifact_root() / "runs" / run_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"lod_{level_index}.glb"
    try:
        data = trimesh.exchange.gltf.export_glb(trimesh.Scene(mesh))
    except Exception:
        try:
            data = mesh.export(file_type="glb")
        except Exception as exc:  # noqa: BLE001
            raise PipelineAbort("E_ARTIFACT_MISSING", f"GLB 导出失败：{exc}")
    out_path.write_bytes(data)
    logger.info("LOD_EXPORT_DONE", index=level_index, path=str(out_path), bytes=len(data))
    return rel(out_path), len(data)
