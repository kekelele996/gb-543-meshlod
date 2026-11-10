"""日志模板集中定义：controller/service/middleware/worker 全部经 utils/logger.py 引用。"""
LOG_TEMPLATES: dict[str, str] = {
    # 启动与基础设施
    "APP_START": "MeshLOD backend starting (env={env}, seed={seed})",
    "DB_READY": "database is reachable (host={host}, db={db})",
    "SEED_DEMO_START": "seed_demo start, users={users}",
    "SEED_DEMO_DONE": "seed_demo done: assets={assets}, pipelines={pipelines}, runs={runs}",
    "SEED_FAILED": "seed_demo failed, continue startup: {error}",
    "REDIS_CONNECTED": "redis connected at {url}",
    # 认证
    "AUTH_LOGIN_OK": "user login ok: {email}, role={role}",
    "AUTH_LOGIN_FAIL": "user login failed: {email}, reason={reason}",
    "AUTH_TOKEN_REFRESH": "token refreshed for user={user_id}",
    "AUTH_FORBIDDEN": "forbidden: user={user_id} role={role} action={action}",
    # 网格
    "MESH_UPLOAD_OK": "mesh uploaded: name={name}, format={format}, tris={tris}, bytes={bytes}",
    "MESH_UPLOAD_DUPLICATE": "duplicate checksum {checksum} -> asset {asset_id}",
    "MESH_PARSE_FAIL": "mesh parse failed: name={name}, error={error}",
    "MESH_FORMAT_GLB": "detected GLB container (magic=glTF)",
    "MESH_FORMAT_GLTF": "detected glTF json scene",
    "MESH_FORMAT_OBJ": "detected OBJ wavefront text",
    "MESH_UV_MISSING": "asset {asset_id} has no TEXCOORD_0",
    "MESH_THUMB_DONE": "thumbnail written for asset {asset_id}",
    "MESH_DELETE": "asset {asset_id} deleted by {actor}",
    # 管线
    "LOD_STRATEGY_RATIO_CHAIN": "strategy=ratio_chain, ratios={ratios}",
    "LOD_STRATEGY_TARGET_ERROR": "strategy=target_error, budget_px={budget}",
    "LOD_STRATEGY_ADAPTIVE": "strategy=adaptive, min_faces={min_faces}, max_faces={max_faces}",
    "PIPELINE_SAVED": "pipeline {pipeline_id} saved by {actor} (template={is_template})",
    "PIPELINE_FROZEN": "pipeline snapshot frozen into run {run_id}",
    # 运行
    "RUN_CREATED": "run {run_id} created: pipeline={pipeline} mesh={mesh} user={user}",
    "RUN_STATUS_TRANSITION": "run {run_id} {from_status} -> {to_status}",
    "RUN_QUOTA_REJECT": "run rejected by quota: user={user} used={used}/{max}",
    "RUN_CANCEL_REQUEST": "cancel requested for run {run_id} by {actor}",
    "RUN_CANCELED": "run {run_id} canceled at stage {stage}",
    "RUN_FAILED": "run {run_id} failed at stage {stage}: {error}",
    "RUN_SUCCEEDED": "run {run_id} succeeded: levels={levels}, tris={tris}",
    # 阶段
    "LOD_STAGE_LOAD": "stage load: vertices={vertices} faces={faces}",
    "LOD_STAGE_PREPROCESS": "stage preprocess: welded={welded}, degenerate_removed={removed}, normals={normals}",
    "LOD_STAGE_UV_CHECK": "stage uv_check: channels={channels}",
    "LOD_LEVEL_START": "level {index} start: ratio={ratio} target_faces={target}",
    "LOD_LEVEL_DONE": "level {index} done: faces={faces}, sse_px={sse}, ms={ms}",
    "LOD_LEVEL_SKIPPED": "level {index} skipped: target {target} >= base {base}",
    "LOD_EXPORT_DONE": "level {index} exported to {path} ({bytes} bytes)",
    "LOD_SSE_COMPUTED": "level {index} sse: geo_error={geo_error}, distance={distance}, px={px}",
    # 审计
    "AUDIT_WRITE": "audit {action} on {entity_type}/{entity_id} result={result}",
    # 配额
    "QUOTA_REJECT": "quota rejected for user={user}: reason={reason}",
}
assert len(LOG_TEMPLATES) >= 24, "log_templates 必须 >= 24 条"
