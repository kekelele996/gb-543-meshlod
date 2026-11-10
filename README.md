# MeshLOD · 三维网格减面与 LOD 管线平台

**上传网格 → 后端真实减面（焊接 / 去退化 / 法线 / UV 检查 + QEM）→ 多级 LOD 与屏幕空间误差 → 可下载 GLB。**
所有统计与误差都来自后端对真实几何的测量，前端只负责查看与对比。

英文短名 `meshlod`，端口：前端 `18112` / 后端 `19112` / PostgreSQL 映射 `17612`。

## 快速启动

```bash
cp .env.example .env
docker compose up -d
# 等 5 个容器 healthy（backend 首次启动会自动执行 seed）
docker compose ps
```

访问：

- 前端 `http://localhost:18112`
- 后端文档 `http://localhost:19112/docs`
- 健康检查 `http://localhost:19112/api/health`

### 演示账号

| 角色 | 说明 | 邮箱 | 密码 |
|---|---|---|---|
| `admin` | TA · 管线负责人（全部读写、可删他人资产、改模板管线） | `admin@meshlod.dev` | `Demo@2026` |
| `artist` | 模型师（上传 / 发起运行 / 改自己的管线） | `artist@meshlod.dev` | `Demo@2026` |
| `viewer` | 引擎组（只读、可下载产物、不能发起或取消运行） | `viewer@meshlod.dev` | `Demo@2026` |

## 主要功能

- **资产库与检查器**：拖拽上传 `.obj/.glb/.gltf`（单文件 ≤ 80MB，前端先拦 + 后端双校验），上传即解析顶点数、三角面、包围盒、UV 通道并生成线框缩略图；五种 InspectMode（solid / wireframe / normals / uv / material）切换。
- **管线构建**：`ratio_chain` / `target_error` / `adaptive` 三种策略，比例链严格递减且末项 > 0（前端即时校验 + 后端二次校验），四项修复开关，保存或保存为模板。
- **异步运行与进度**：run 入队交给 Celery worker，每级更新 `progress` 并通过 Redis 发布；`/runs` 按真实 progress 推进，仅 `queued/running` 可取消。
- **LOD 对比与统计**：`/runs/:id` 双视口左右对照（左原始、右当前级）、LOD 滑杆（120ms debounce）、每级顶点/三角面/减面率/SSE、日志按 `after_id` 游标增量滚动。
- **逐级下载**：每级 GLB 用 `StreamingResponse` + `Content-Disposition` 下载，另有 `stats.json`（含 SSE 参数与每级统计）。

## 典型使用场景

模拟客户 **云图数孪**：80 人数字孪生公司，已交付 20+ 智慧园区项目；3D 资产组 9 人 = 2 名 TA + 5 名模型师 + 2 名引擎组。
系统内三种角色：TA = `admin`、模型师 = `artist`、引擎组 = `viewer`。

**一个真实工作日**：

1. 09:30 模型师把客户新扫的 `campus_A_tower.glb` 拖进 `/assets`，后端解析顶点数/三角面/包围盒并生成缩略图，`status` 从 `uploaded` 走到 `ready`。
2. 09:40 TA 在 `/pipelines/new` 打开 `园区标准 LOD` 模板：策略 `ratio_chain`、比例链 `100/50/25/10`、修复开关 `weld + degnerate + normals + uv_check` 全开，另存为新版本。
3. 09:45 模型师在 `/assets/:id` 点「用默认管线跑一次」，run 进入 `queued → running`，`/runs/:id` 的进度按真实阶段推进（load → preprocess → plan → level_0…）。
4. 运行结束：四级 LOD 出齐，`/runs/:id` 的统计表给出每级三角面与 SSE（0 / 0.8 / 2.1 / 5.4 px 量级，实际值由真实几何测得）。
5. 10:10 引擎组在 `/runs/:id` 核对 LOD 表格与 SSE，切 `wireframe`、`uv` 各看一眼，下载 LOD2/LOD3 的 GLB 与统计 JSON，把 SSE 数值抄进集成单。
6. 14:00 另一条运行失败：`bench_scan.glb` 没有 `TEXCOORD_0`，`/runs/:id` 显示 `failed`，错误信息写明 UV 通道缺失，日志停在 `uv_check` 阶段；模型师补 UV 后**新建一次 run** 重跑（旧 run 保持 `failed`，历史留证）。
7. 17:00 TA 在 `/runs` 按 `succeeded` 过滤，确认当天 2 条运行 1 成功 1 失败；`/assets/:id` 的审计时间线里能看到上传、运行、重试三类操作。

## 演示数据初始化（必须，幂等）

```bash
cp .env.example .env
docker compose up -d
# 等 5 个容器 healthy
docker compose exec backend python -m scripts.seed_demo
```

`SEED_DEMO=true` 时 backend 的 lifespan 也会自动执行一次 seed；失败只写 `SEED_FAILED` 警告，不阻塞启动（容器仍必须 healthy）。

seed **幂等**：以固定 uuid（uuid5）与 `name` 为幂等键，重复执行只补齐缺失记录，不重复插入、不改写已有 run 的 `status`、统计与 `LodLevel`。连续执行两次，资产/管线/运行数量不翻倍。

执行后可对照：

| 类型 | 名称 | 说明 |
|---|---|---|
| 资产 | `campus_A_tower.glb` | 程序化塔楼，UV 完整（约 12.4 万三角面） |
| 资产 | `bench_scan.glb` | 长椅扫描件，**故意缺 `TEXCOORD_0`**（约 7.7 千三角面） |
| 资产 | `sculpture.glb` | 雕塑，法线未重算（约 3.9 万三角面） |
| 管线 | `园区标准 LOD` | `ratio_chain` + 100/50/25/10 + weld/degnerate/normals/uv_check 全开，`is_template=true` |
| 管线 | `快速预览` | `ratio_chain` + 100/50，仅 `weld` |
| 运行 | `succeeded` | `campus_A_tower.glb × 园区标准 LOD`，四级 LOD 由真实 pipeline 产出 |
| 运行 | `failed` | `bench_scan.glb × 园区标准 LOD`，在 `uv_check` 阶段因缺 UV 中止，`RunLog` 停在 uv_check |

> 为控制容器内演示时长，seed 的程序化网格规模约为提示词剧本的 1/10（12.4 万而不是 124 万三角面）；比例链、QEM 减面、SSE 公式与统计口径与真实生产完全一致，页面展示的每个数字都由本次运行真实测得。

## 本地开发

```bash
# 1) 先起 PostgreSQL 与 Redis（可用 docker compose 只起 db/redis）
docker compose up -d db redis

# 2) 后端
cd backend
pip install -r requirements.txt
export DB_HOST=localhost DB_PORT=17612 DB_NAME=meshlod_db DB_USER=meshlod_user DB_PASSWORD=meshlod_pwd
export REDIS_URL=redis://localhost:6379/0 ARTIFACT_DIR=$PWD/artifacts PYTHONPATH=$PWD
uvicorn app.main:app --reload --port 19112

# 3) worker（另开终端，项目根目录）
cd ..
PYTHONPATH=$PWD/backend:$PWD celery -A worker.celery_app.celery_app worker -Q lod -l info

# 4) 前端
cd frontend
npm install --registry=https://registry.npmjs.org
npm run dev   # http://localhost:5173（/api 代理到 19112）
```

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | React 18 + TypeScript 5 + Vite 5 + Zustand + TanStack Query v5 + Tailwind CSS 3 + CSS 变量 token + Three.js（GLTFLoader / OBJLoader / OrbitControls） |
| 后端 | Python 3.11 + FastAPI + SQLAlchemy 2.0（`Mapped` 声明式）+ Alembic + Pydantic v2 + JWT（python-jose）+ passlib[bcrypt] |
| 计算 | numpy + trimesh（含 `fast_simplification` QEM、`rtree` 最近点查询、`pygltflib`/`networkx`）+ Pillow（缩略图） |
| 数据库 | PostgreSQL 16（`postgres:16-alpine`，题目写 15，16 兼容；本机镜像复用）+ Redis 7（Celery broker/result + 进度发布） |
| 部署 | Docker Compose，5 服务 frontend / backend / worker / db / redis，Nginx 托管前端并反代 `/api/` |

## 目录结构

```
gb-543/
├── docker-compose.yml        # 顶层 name: meshlod，无 version:
├── .env / .env.example
├── frontend/                 # React + Vite，Nginx 托管
│   ├── nginx.conf            # /api/ 反代 backend:8000，SPA try_files
│   └── src/
│       ├── api/              # client/auth/assets/pipelines/runs/levels/quota/audit
│       ├── stores/           # auth/asset/pipeline/run/quota/ui
│       ├── types/            # user/meshAsset/pipeline/run/lodLevel/audit/api
│       ├── components/common/# MeshViewport, AssetThumb, StageBadge, StatTable, LodSlider,
│       │                     # EmptyState, QuotaHint, RequireRole, ErrorPanel, GridBackdrop
│       ├── components/layout/# AppShell, TopBar, InspectorPanel
│       ├── hooks/            # useMeshLoader, useRunPolling, useAuth, useQuota
│       ├── pages/            # Assets, AssetDetail, PipelineNew, Runs, RunDetail, Login
│       ├── router/           # index.tsx, guards.ts
│       ├── utils/            # meshStats, formatNumber, request, sseFormula, colors
│       ├── constants/        # meshFormat, lodStrategy, runStatus, inspectMode, assetStatus, errorCodes, messages
│       └── styles/           # tokens.css, global.css
├── backend/
│   ├── Dockerfile            # 与 worker 共用同一镜像（build context = 项目根目录）
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── scripts/              # seed_demo.py, wait_for_db.py（命令行入口，逻辑复用 app/scripts）
│   └── app/
│       ├── main.py
│       ├── config/           # settings, database, redis, storage, logging
│       ├── models/           # user, mesh_asset, process_pipeline, pipeline_run, lod_level, run_log, audit_log, quota
│       ├── schemas/          # 按实体分文件 + common.py
│       ├── routes/           # auth, assets, pipelines, runs, levels, quota, audit, health
│       ├── controllers/      # 按实体分文件，只做参数装配与响应包装
│       ├── services/         # mesh/pipeline/run/lod/quota/audit/permission/auth/thumbnail/mesh_generator
│       ├── middlewares/      # auth, audit_logger, upload_guard, error_handler
│       ├── utils/            # jwt, password, logger, formatters, hashing, pagination, sse, errors, colors?
│       ├── constants/        # mesh, lod, run, inspect, asset, roles, error_codes, log_templates(30 条), messages, limits
│       ├── alembic/          # env.py + versions/0001_initial.py
│       └── scripts/          # seed_demo.py（幂等）、wait_for_db.py
└── worker/                   # 独立容器，复用 backend 镜像
    ├── celery_app.py         # 队列声明、路由、超时与重试
    ├── tasks/
    │   ├── lod_tasks.py      # run_lod_pipeline 主任务 + 取消检查点
    │   └── thumb_tasks.py
    └── pipeline/
        ├── context.py        # 运行上下文（run_id、日志写入器、进度上报器、取消标记）
        ├── loader.py         # 格式加载与统计采集（trimesh.load force='mesh'）
        ├── preprocess.py     # 焊接顶点、去退化面、法线重算、UV 检查
        ├── decimate.py       # QEM 减面封装（simplify_quadric_decimation + 聚类降级）
        ├── sse.py            # 屏幕空间误差
        ├── export.py         # GLB 导出与路径登记
        └── plan.py           # 策略分支（ratio_chain / target_error / adaptive）
```

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `COMPOSE_PROJECT_NAME` | `meshlod` | 容器名前缀 |
| `DB_NAME` | `meshlod_db` | 数据库名 |
| `DB_USER` / `DB_PASSWORD` | `meshlod_user` / `meshlod_pwd` | 业务账号 |
| `DB_ADMIN_PASSWORD` | `meshlod_admin_pwd` | 数据库管理员密码（部署备用） |
| `JWT_SECRET` | `change_me_to_a_long_random_string` | JWT 签名密钥 |
| `FRONTEND_PORT` | `18112` | 前端端口 |
| `BACKEND_PORT` | `19112` | 后端端口 |
| `DB_PORT` | `17612` | PostgreSQL 映射端口 |
| `REDIS_URL` | `redis://redis:6379/0` | Celery broker / result backend |
| `ARTIFACT_DIR` | `/data/artifacts` | 命名卷内产物根目录（backend 与 worker 共享） |
| `MAX_UPLOAD_MB` | `80` | 单文件上传上限 |
| `SEED_DEMO` | `true` | 启动时自动执行 seed |

## Docker 部署说明

- 端口映射：`18112:80`（frontend）、`19112:8000`（backend）、`17612:5432`（db）；redis 只在 compose 内网。
- 三个命名卷：`db_data`（PostgreSQL 数据）、`redis_data`（AOF）、`artifact_data`（`/data/artifacts`：上传的源网格、缩略图、`runs/{run_id}/lod_{i}.glb`）。
- backend 与 worker **共用同一镜像**（同一 build 配置，worker 仅 `command` 不同）；`worker/` 在镜像内位于 `/app/worker`，`PYTHONPATH=/app` 同时导入 `app.*` 与 `worker.*`。
- 常见问题：
  - 首次启动 backend 需要建表 + seed，约 20–60s，healthcheck `start_period=150s`；
  - 上传大网格超时：Nginx 已设 `client_max_body_size 100m` 与 `proxy_read_timeout 300s`；
  - run 卡在 `queued`：确认 `worker` 容器 healthy（`celery -A worker.celery_app.celery_app inspect ping`）。

## 减面算法说明

**预处理四步**（`worker/pipeline/preprocess.py`）：

1. `merge_vertices(digits_vertex=6)` 焊接重复顶点；
2. 删除面积 `< 1e-12` 的退化面（`mesh.area_faces` 过滤 + `update_faces`）；
3. `trimesh.repair.fix_normals()` + 顶点法线重建；
4. UV 检查：无 `TEXCOORD_0` 时写 `warn` 日志；若管线 `uv_check=true` 则在该阶段中止并置 `failed`（提示词剧本 14:00 的失败运行即此路径）。

**QEM 减面**：`trimesh.simplify_quadric_decimation(face_count=target)`，`target = round(base_faces * ratio)`；若 `target >= base_faces` 则跳过该级并写 `warn`（ratio=100% 的 LOD0 直接导出预处理后的原始网格）。底层为 `fast_simplification`；不可用时退化为顶点聚类实现并写 `warn`，绝不静默造假数据。

**SSE 公式**：

```
SSE(px) = geometric_error * viewport_height / (2 * distance * tan(fov_y / 2))
```

- `geometric_error`：该级相对上一级的顶点位移 95 分位 —— 对上一级表面采样最多 3000 个顶点，用 `trimesh.proximity`（`rtree` 最近点）求到当前级表面的最近距离，取 P95；
- 默认 `viewport_height = 1080`、`fov_y = 60°`、`distance = 3 × 包围球半径`，参数一并写入 `PipelineRun.stats_json.sse`；
- **手算示例**：某级 `geometric_error = 0.0456` 世界单位，包围球半径 `R = 24.0` → `distance = 72.0`，`tan(30°) = 0.57735`：
  `SSE = 0.0456 × 1080 / (2 × 72.0 × 0.57735) = 49.248 / 83.14 = 0.592 px`。

## 枚举出现位置清单

### MeshFormat（`obj` / `glb` / `gltf`）

- 后端定义：`backend/app/constants/mesh.py`（`class MeshFormat(str, Enum)`、`MESH_EXTENSIONS`）
- 后端使用：`models/mesh_asset.py`（列类型）、`schemas/mesh_asset.py`（响应字段）、`middlewares/upload_guard.py`（扩展名 + GLB magic bytes）、`services/mesh_service.py`（加载分支）、`services/mesh_generator.py`（导出格式）、`worker/pipeline/loader.py`（格式分支）、`constants/log_templates.py`（`MESH_FORMAT_GLB/GLTF/OBJ`）
- 前端定义：`frontend/src/constants/meshFormat.ts`（`MESH_FORMATS` + `MeshFormat`）
- 前端使用：`types/meshAsset.ts`、`components/common/MeshViewport.tsx`（loader 选择）、`hooks/useMeshLoader.ts`、`pages/Assets.tsx`（格式列 + accept）、`utils/meshStats.ts`、`constants/errorCodes.ts`（`E_UNSUPPORTED_FORMAT`）

### LodStrategy（`ratio_chain` / `target_error` / `adaptive`）

- 后端定义：`backend/app/constants/lod.py`
- 后端使用：`models/process_pipeline.py`、`schemas/process_pipeline.py`（校验分支）、`services/pipeline_service.py`（比例链二次校验 + 策略日志）、`services/run_service.py`（快照）、`worker/pipeline/plan.py`（策略分支）、`constants/log_templates.py`（`LOD_STRATEGY_*`）
- 前端定义：`frontend/src/constants/lodStrategy.ts`
- 前端使用：`types/pipeline.ts`、`components/common/StageBadge.tsx`（文案映射）、`pages/PipelineNew.tsx`（三选一表单）、`stores/pipelineStore.ts`、`utils/formatters` 对应 `constants/messages.ts`

### RunStatus（`queued` / `running` / `succeeded` / `failed` / `canceled`）

- 后端定义：`backend/app/constants/run.py`
- 后端使用：`models/pipeline_run.py`、`services/run_service.py`（取消守卫 + 状态推进）、`worker/pipeline/context.py`、`worker/tasks/lod_tasks.py`（终态回写）、`routes/runs.py`（取消路由）、`constants/log_templates.py`（`RUN_STATUS_TRANSITION` 等）
- 前端定义：`frontend/src/constants/runStatus.ts`
- 前端使用：`types/run.ts`、`components/common/StageBadge.tsx`、`hooks/useRunPolling.ts`（终止条件）、`pages/Runs.tsx`（筛选 + 取消按钮可见性）、`pages/RunDetail.tsx`

### InspectMode（`solid` / `wireframe` / `normals` / `uv` / `material`）

- 后端定义：`backend/app/constants/inspect.py`（离屏渲染/截图参数校验用）
- 后端使用：`schemas/run.py`（重跑参数）、`constants/messages.ts` 对应前端文案、`constants/log_templates.py` 摘要
- 前端定义：`frontend/src/constants/inspectMode.ts`
- 前端使用：`components/common/MeshViewport.tsx`（材质切换）、`stores/uiStore.ts`、`pages/AssetDetail.tsx`（工具栏）、`pages/RunDetail.tsx`（双视口工具栏）、`utils/meshStats.ts`

### AssetStatus（`uploaded` / `inspecting` / `ready` / `invalid`）

- 后端定义：`backend/app/constants/asset.py`
- 后端使用：`models/mesh_asset.py`、`services/mesh_service.py`（上传后置 `ready`）、`services/run_service.py`（`invalid` 拒绝进管线）、`routes/assets.py`（筛选）、`constants/log_templates.py`
- 前端定义：`frontend/src/constants/assetStatus.ts`
- 前端使用：`types/meshAsset.ts`、`components/common/AssetThumb.tsx`（角标）、`pages/Assets.tsx`（筛选器 + 状态列）

## 安全与权限

- JWT：access 12h / refresh 7d，`sub` 存 user id；`middlewares/auth.py` 解析 `Authorization: Bearer` 注入 `request.state.user`，白名单 `/api/health`、`/api/auth/login`、`/api/auth/refresh`。
- 路由守卫：`services/permission_service.py` 判定「能否读/改/删该资产」「能否发起运行」；写操作要求 `artist` 及以上，删除他人资产仅 `admin`；前端 `components/common/RequireRole.tsx` 包裹危险操作按钮，`router/guards.ts` 守卫登录态。
- 审计：`middlewares/audit_logger.py` 对所有写请求落 `audit_logs`（失败请求记 `result=rejected`），`password/token/authorization` 字段脱敏；`/assets/:id` 与 `/runs/:id` 页脚拉取时间线。
- 配额：`quotas(user_id, max_upload_mb, max_concurrent_runs, used_runs, window_start)`；`middlewares/upload_guard.py` 做 Content-Length 预检 + 流式字节计数双校验（超限 413），`services/quota_service.py` 在创建运行前 `acquire()`，失败返回 429 `E_QUOTA_EXCEEDED`。

## 已知差异 / 取舍

详见 `test-artifacts/gb-543/TESTING.md`「已知差异」：程序化网格规模为剧本的约 1/10、worker 使用同一镜像但 `celery -A worker.celery_app.celery_app` 入口（等价于 `celery_app.celery_app`）、`target_error` 策略用经验估算推导级数、前端统计只作即时展示（权威值来自 `LodLevel` 表）。

## License

MIT
