"""run_lod_pipeline 主任务：加载 → 预处理 → 逐级 QEM 减面 → SSE → 导出，带取消检查点。"""
import time
import uuid

from app.config.storage import asset_path
from app.constants.lod import LodStrategy
from app.constants.run import RunStatus
from app.models.lod_level import LodLevel
from app.models.mesh_asset import MeshAsset
from app.models.process_pipeline import ProcessPipeline
from app.utils import logger
from worker.celery_app import celery_app
from worker.pipeline.context import PipelineAbort, RunCanceled, RunContext
from worker.pipeline.decimate import decimate, decimation_warning
from worker.pipeline.export import export_glb
from worker.pipeline.loader import load_mesh, mesh_stats
from worker.pipeline.plan import build_plan
from worker.pipeline.preprocess import preprocess
from worker.pipeline.sse import geometric_error, screen_space_error


def _snapshot(ctx: RunContext, run) -> tuple[str, list[float], dict, dict]:
    snapshot = (run.stats_json or {}).get("pipeline_snapshot") or {}
    pipeline = ctx.db.get(ProcessPipeline, run.pipeline_id)
    strategy = snapshot.get("strategy") or (pipeline.strategy if pipeline else LodStrategy.RATIO_CHAIN.value)
    ratios = snapshot.get("target_ratios") or (pipeline.target_ratios_json if pipeline else [1.0, 0.5, 0.25, 0.1])
    flags = snapshot.get("repair_flags") or (pipeline.repair_flags_json if pipeline else {})
    params = snapshot.get("strategy_params") or (pipeline.strategy_params_json if pipeline else {})
    return strategy, [float(r) for r in ratios], dict(flags or {}), dict(params or {})


def execute_run(run_id: str | uuid.UUID) -> dict:
    ctx = RunContext(run_id)
    stage = "load"
    started = time.time()
    try:
        ctx.mark_running(stage)
        run = ctx.get_run()
        mesh_asset = ctx.db.get(MeshAsset, run.mesh_id)
        if mesh_asset is None:
            raise PipelineAbort("E_NOT_FOUND", "资产不存在")
        strategy, ratios, flags, params = _snapshot(ctx, run)
        ctx.info(f"载入网格 {mesh_asset.name}（{mesh_asset.source_format}）")
        source = asset_path(mesh_asset.file_path)
        mesh = load_mesh(source, mesh_asset.source_format)
        stats = mesh_stats(mesh)
        base_faces = stats["triangle_count"]
        ctx.info(
            f"加载完成：vertices={stats['vertex_count']}, faces={base_faces}, "
            f"uv_channels={stats['uv_channel_count']}, sphere_radius={stats['sphere_radius']}"
        )
        ctx.set_progress(5, "preprocess")

        stage = "preprocess"
        ctx.check_cancel(stage)
        pre = preprocess(mesh, flags, ctx)
        working = pre.mesh
        ctx.set_progress(15, "preprocess")

        stage = "plan"
        plan = build_plan(strategy, ratios, params, base_faces)
        ctx.info(
            f"策略 {strategy}：共 {len(plan)} 级，比例链 "
            + " / ".join(f"{p.ratio * 100:.0f}" for p in plan)
        )

        sse_params = {
            "viewport_height": (run.stats_json or {}).get("sse", {}).get("viewport_height", 1080),
            "fov_y_deg": (run.stats_json or {}).get("sse", {}).get("fov_y_deg", 60.0),
        }
        sphere_radius = stats["sphere_radius"]
        level_ms: dict[str, int] = {}
        warnings: list[str] = list(pre.warnings)
        impls: list[str] = []
        prev_mesh = working
        created = 0
        final_faces = base_faces

        for item in plan:
            stage = f"level_{item.index}"
            ctx.check_cancel(stage)
            if item.skip:
                ctx.warn(f"LOD{item.index} 跳过：{item.note}")
                warnings.append(f"LOD{item.index} 跳过：{item.note}")
                continue
            t0 = time.time()
            if item.index == 0 or item.target_faces >= base_faces:
                ctx.info(f"LOD{item.index} = 预处理后原始网格（ratio={item.ratio:.2f}，不执行减面）")
                simplified = working
                impl = "identity"
            else:
                ctx.info(
                    f"LOD{item.index} 开始：ratio={item.ratio:.2f}, target_faces={item.target_faces}"
                )
                simplified, impl = decimate(prev_mesh, item.target_faces)
                note = decimation_warning(impl)
                if note:
                    ctx.warn(note)
                    warnings.append(note)
            feats = len(simplified.faces)
            if item.index == 0:
                geo_error = 0.0
            else:
                geo_error = geometric_error(prev_mesh, simplified)
            sse = screen_space_error(geo_error, sphere_radius, sse_params)
            rel_path, nbytes = export_glb(simplified, str(ctx.run_id), item.index)
            elapsed_ms = int((time.time() - t0) * 1000)
            level_ms[str(item.index)] = elapsed_ms
            impls.append(impl)
            ctx.db.add(
                LodLevel(
                    run_id=ctx.run_id,
                    level_index=item.index,
                    ratio=item.ratio,
                    vertex_count=int(len(simplified.vertices)),
                    triangle_count=int(feats),
                    file_path=rel_path,
                    screen_space_error=sse["pixels"],
                )
            )
            ctx.db.commit()
            ctx.info(
                f"LOD{item.index} 完成：faces={feats}, vertices={len(simplified.vertices)}, "
                f"geo_error={sse['geometric_error']:.6f}, SSE={sse['pixels']:.3f}px, "
                f"导出={nbytes} bytes, 耗时={elapsed_ms}ms"
            )
            final_faces = int(feats)
            prev_mesh = simplified
            created += 1
            progress = min(99, round((created / max(len(plan), 1)) * 100))
            ctx.set_progress(progress, stage)

        if created == 0:
            raise PipelineAbort("E_LOD_LEVEL_MISSING", "没有任何一级 LOD 生成成功")
        duration_ms = int((time.time() - started) * 1000)
        ctx.set_progress(100, "done")
        ctx.finish(
            RunStatus.SUCCEEDED.value,
            stats={
                "stage": "done",
                "base_triangle_count": base_faces,
                "final_triangle_count": final_faces,
                "level_count": created,
                "level_ms": level_ms,
                "decimation_impl": sorted(set(impls)),
                "preprocess": {
                    "welded_removed": pre.welded_removed,
                    "degenerate_removed": pre.degenerate_removed,
                    "normals_fixed": pre.normals_fixed,
                    "uv_channel_count": pre.uv_channel_count,
                },
                "sse": {
                    **sse_params,
                    "distance_factor": 3.0,
                    "formula": "SSE(px) = geometric_error * viewport_height / (2 * distance * tan(fov_y/2))",
                },
                "warnings": warnings,
                "duration_ms": duration_ms,
            },
        )
        logger.info("RUN_SUCCEEDED", run_id=str(ctx.run_id), levels=created, tris=final_faces)
        return {"status": "succeeded", "levels": created}
    except RunCanceled as exc:
        ctx.error(f"运行已取消（{exc}）")
        ctx.finish(RunStatus.CANCELED.value, error_message=str(exc), stats={"stage": "canceled"})
        logger.info("RUN_CANCELED", run_id=str(ctx.run_id), stage=stage)
        return {"status": "canceled"}
    except PipelineAbort as exc:
        failed_stage = exc.stage or stage
        ctx.error(f"运行失败（{exc.code}）：{exc.message}")
        ctx.finish(
            RunStatus.FAILED.value,
            error_message=exc.message,
            stats={
                "stage": failed_stage,
                "error_code": exc.code,
                "duration_ms": int((time.time() - started) * 1000),
            },
        )
        logger.info("RUN_FAILED", run_id=str(ctx.run_id), stage=failed_stage, error=exc.message)
        return {"status": "failed", "error": exc.message}
    except Exception as exc:  # noqa: BLE001
        ctx.error(f"运行异常：{exc}")
        ctx.finish(
            RunStatus.FAILED.value,
            error_message=str(exc)[:500],
            stats={"stage": stage, "error_code": "E_INTERNAL"},
        )
        logger.info("RUN_FAILED", run_id=str(ctx.run_id), stage=stage, error=str(exc)[:200])
        return {"status": "failed", "error": str(exc)[:200]}
    finally:
        ctx.close()


@celery_app.task(bind=True, name="lod.run_lod_pipeline", max_retries=0)
def run_lod_pipeline(self, run_id: str) -> dict:
    return execute_run(run_id)
