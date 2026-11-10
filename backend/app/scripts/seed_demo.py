"""幂等演示数据 seed（docker compose exec backend python -m scripts.seed_demo）。

幂等键：固定 uuid（uuid5）+ 用户 email + 管线 name。
重复执行只补齐缺失记录；已存在的 run 的 status / 统计 / LodLevel 一律不改写。
"""
import logging
import uuid
from pathlib import Path

from sqlalchemy import select

from app.config.database import Base, SessionLocal, engine
from app.config.settings import settings
from app.config.storage import artifact_root, ensure_dirs
from app.constants.asset import AssetStatus
from app.constants.lod import LodStrategy
from app.constants.roles import Role
from app.models.mesh_asset import MeshAsset
from app.models.pipeline_run import PipelineRun
from app.models.process_pipeline import ProcessPipeline
from app.models.run_log import RunLog
from app.models.user import User
from app.schemas.process_pipeline import PipelineIn, RepairFlags, StrategyParams
from app.services import audit_service, mesh_generator, mesh_service, pipeline_service, quota_service
from app.utils.password import DEMO_PASSWORD, hash_password

log = logging.getLogger("meshlod.seed")

NAMESPACE = uuid.UUID("6f1b2c3d-1111-4000-8000-000000000000")


def fixed_id(key: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, key)


USERS = [
    ("admin@meshlod.dev", "TA · 云图数孪", Role.ADMIN, "user:admin"),
    ("artist@meshlod.dev", "模型师 · 云图数孪", Role.ARTIST, "user:artist"),
    ("viewer@meshlod.dev", "引擎组 · 云图数孪", Role.VIEWER, "user:viewer"),
]

ASSETS = [
    {
        "key": "asset:campus_A_tower.glb",
        "name": "campus_A_tower.glb",
        "builder": lambda: mesh_generator.build_tower(),
        "format": "glb",
    },
    {
        "key": "asset:bench_scan.glb",
        "name": "bench_scan.glb",
        "builder": lambda: mesh_generator.build_bench(),
        "format": "glb",
    },
    {
        "key": "asset:sculpture.glb",
        "name": "sculpture.glb",
        "builder": lambda: mesh_generator.build_sculpture(),
        "format": "glb",
    },
]

STANDARD_PIPELINE = PipelineIn(
    name="园区标准 LOD",
    strategy=LodStrategy.RATIO_CHAIN.value,
    target_ratios=[1.0, 0.5, 0.25, 0.1],
    repair_flags=RepairFlags(weld=True, degnerate=True, normals=True, uv_check=True),
    strategy_params=StrategyParams(),
    is_template=True,
)

PREVIEW_PIPELINE = PipelineIn(
    name="快速预览",
    strategy=LodStrategy.RATIO_CHAIN.value,
    target_ratios=[1.0, 0.5],
    repair_flags=RepairFlags(weld=True, degnerate=False, normals=False, uv_check=False),
    strategy_params=StrategyParams(),
    is_template=False,
)


def _seed_users(db) -> dict[str, User]:
    users: dict[str, User] = {}
    for email, display_name, role, key in USERS:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(
                id=fixed_id(key),
                email=email,
                password_hash=hash_password(DEMO_PASSWORD),
                display_name=display_name,
                role=role.value,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            log.info("seed user created: %s (%s)", email, role.value)
        users[role.value] = user
    for role in users:
        quota_service.get_or_create(db, users[role])
    return users


def _seed_assets(db, artist: User) -> dict[str, MeshAsset]:
    ensure_dirs()
    seed_dir = artifact_root() / "seed"
    seed_dir.mkdir(parents=True, exist_ok=True)
    existing: dict[str, MeshAsset] = {}
    for item in ASSETS:
        asset_id = fixed_id(item["key"])
        asset = db.get(MeshAsset, asset_id)
        if asset is not None:
            existing[item["name"]] = asset
            continue
        path = seed_dir / item["name"]
        if not path.exists():
            mesh = item["builder"]()
            size = mesh_generator.export(mesh, path)
            log.info("seed mesh generated: %s (%d faces, %d bytes)", item["name"], len(mesh.faces), size)
        asset = mesh_service.save_from_path(db, artist, path, item["name"], asset_id=asset_id)
        existing[item["name"]] = asset
        log.info("seed asset registered: %s tris=%d uv=%d", asset.name, asset.triangle_count, asset.uv_channel_count)
    return existing


def _seed_pipelines(db, owner: User) -> dict[str, ProcessPipeline]:
    result: dict[str, ProcessPipeline] = {}
    for payload, key in ((STANDARD_PIPELINE, "pipeline:standard"), (PREVIEW_PIPELINE, "pipeline:preview")):
        pipeline_id = fixed_id(key)
        pipeline = db.get(ProcessPipeline, pipeline_id)
        if pipeline is None:
            pipeline = pipeline_service.create_pipeline(db, owner, payload, pipeline_id=pipeline_id)
            log.info("seed pipeline created: %s", pipeline.name)
        result[payload.name] = pipeline
    return result


def _seed_run(db, *, key: str, mesh: MeshAsset, pipeline: ProcessPipeline, requester: User) -> PipelineRun | None:
    run_id = fixed_id(key)
    run = db.get(PipelineRun, run_id)
    if run is not None:
        return run
    run = PipelineRun(
        id=run_id,
        pipeline_id=pipeline.id,
        mesh_id=mesh.id,
        requested_by_id=requester.id,
        status="queued",
        progress=0,
        stats_json={
            "pipeline_snapshot": pipeline_service.freeze_snapshot(pipeline, str(run_id)),
            "sse": {"viewport_height": 1080, "fov_y_deg": 60.0, "distance_factor": 3.0},
            "stage": "queued",
        },
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    from worker.tasks.lod_tasks import execute_run

    result = execute_run(str(run_id))
    log.info("seed run executed: %s -> %s", key, result.get("status"))
    return run


def _seed_audit(db, artist: User, assets: dict[str, MeshAsset], runs: dict[str, PipelineRun]) -> int:
    def exists(action: str, entity_id: str) -> bool:
        return db.scalar(
            select(audit_service.AuditLog.id).where(
                audit_service.AuditLog.action == action,
                audit_service.AuditLog.entity_id == entity_id,
            )
        ) is not None

    written = 0
    for name, asset in assets.items():
        if not exists("asset.upload", str(asset.id)):
            audit_service.write(
                db,
                actor_id=artist.id,
                action="asset.upload",
                entity_type="asset",
                entity_id=str(asset.id),
                payload={"name": name, "bytes": 0, "source": "seed"},
            )
            written += 1
    for key, run in runs.items():
        if run is None:
            continue
        asset_id = str(run.mesh_id)
        if not exists("asset.run", asset_id):
            audit_service.write(
                db,
                actor_id=run.requested_by_id,
                action="asset.run",
                entity_type="asset",
                entity_id=asset_id,
                payload={"run_id": str(run.id), "status": run.status},
            )
            written += 1
    bench = assets.get("bench_scan.glb")
    if bench is not None and not exists("asset.retry", str(bench.id)):
        audit_service.write(
            db,
            actor_id=artist.id,
            action="asset.retry",
            entity_type="asset",
            entity_id=str(bench.id),
            payload={"reason": "UV 通道缺失，补 UV 后重跑", "mode": "new_run"},
        )
        written += 1
    return written


def seed() -> dict:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        users = _seed_users(db)
        assets = _seed_assets(db, users[Role.ARTIST.value])
        pipelines = _seed_pipelines(db, users[Role.ADMIN.value])
        standard = pipelines["园区标准 LOD"]
        runs = {
            "succeeded": _seed_run(
                db,
                key="run:campus_A_tower:standard",
                mesh=assets["campus_A_tower.glb"],
                pipeline=standard,
                requester=users[Role.ARTIST.value],
            ),
            "failed": _seed_run(
                db,
                key="run:bench_scan:standard",
                mesh=assets["bench_scan.glb"],
                pipeline=standard,
                requester=users[Role.ARTIST.value],
            ),
        }
        _seed_audit(db, users[Role.ARTIST.value], assets, runs)
        counts = {
            "users": db.scalar(select(User.id).count()) if False else len(users),
            "assets": len(assets),
            "pipelines": len(pipelines),
            "runs": len([r for r in runs.values() if r is not None]),
            "logs": db.scalar(select(RunLog.id).limit(1)) is not None,
        }
        _ = AssetStatus
        return counts
    finally:
        db.close()


def main() -> None:
    from app.config.logging import configure_logging

    configure_logging("INFO")
    if not settings.DB_HOST:
        raise SystemExit("DB_HOST 未配置")
    result = seed()
    print(f"seed done: {result}")


if __name__ == "__main__":
    main()
