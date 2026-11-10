/** /assets/:id 资产检查器：五种 InspectMode + 运行历史 + 审计时间线 + 一键跑默认管线。 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '../components/layout/TopBar';
import InspectorPanel, { InspectorRow, InspectorSection } from '../components/layout/InspectorPanel';
import MeshViewport, { type CameraPreset } from '../components/common/MeshViewport';
import StatTable from '../components/common/StatTable';
import ErrorPanel from '../components/common/ErrorPanel';
import EmptyState from '../components/common/EmptyState';
import RequireRole from '../components/common/RequireRole';
import { StatusBadge } from '../components/common/StageBadge';
import { assetAudit, assetFileUrl, assetRuns, getAsset } from '../api/assets';
import { listPipelines } from '../api/pipelines';
import { createRun } from '../api/runs';
import { INSPECT_MODES, INSPECT_MODE_LABELS, type InspectMode } from '../constants/inspectMode';
import { useUiStore } from '../stores/uiStore';
import { useQuota } from '../hooks/useQuota';
import { MESSAGES } from '../constants/messages';
import { compactNumber, formatDate, formatNumber, shortHash } from '../utils/formatNumber';
import type { PipelineRun } from '../types/run';

const CAMERA_PRESETS: CameraPreset[] = ['iso', 'front', 'top'];

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const inspectMode = useUiStore((state) => state.inspectMode);
  const setInspectMode = useUiStore((state) => state.setInspectMode);
  const pushToast = useUiStore((state) => state.pushToast);
  const { canStartRun, quota } = useQuota();
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('iso');
  const [pipelineId, setPipelineId] = useState<string>('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assetQuery = useQuery({ queryKey: ['asset', id], queryFn: () => getAsset(id as string), enabled: Boolean(id) });
  const runsQuery = useQuery({ queryKey: ['asset-runs', id], queryFn: () => assetRuns(id as string), enabled: Boolean(id) });
  const auditQuery = useQuery({ queryKey: ['asset-audit', id], queryFn: () => assetAudit(id as string), enabled: Boolean(id) });
  const pipelinesQuery = useQuery({ queryKey: ['pipelines'], queryFn: () => listPipelines(false) });

  const asset = assetQuery.data;
  const pipelines = pipelinesQuery.data?.items ?? [];
  const defaultPipeline = useMemo(
    () => pipelines.find((pipeline) => pipeline.is_template) ?? pipelines[0],
    [pipelines],
  );
  const selectedPipelineId = pipelineId || defaultPipeline?.id || '';

  const startRun = async () => {
    if (!asset || !selectedPipelineId) return;
    setStarting(true);
    setError(null);
    try {
      const run = await createRun(asset.id, selectedPipelineId);
      pushToast(`运行已入队：${run.id.slice(0, 8)}`);
      navigate(`/runs/${run.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '发起运行失败');
    } finally {
      setStarting(false);
    }
  };

  if (assetQuery.isLoading) {
    return <p className="num p-6 text-[11px] text-ink/50">LOADING ASSET…</p>;
  }
  if (!asset) {
    return (
      <div className="p-6">
        <EmptyState
          title="资产不存在"
          description="该资产可能已被删除，或链接已失效。"
          actions={
            <Link to="/assets" className="btn-primary">
              回到资产库
            </Link>
          }
        />
      </div>
    );
  }

  const runs = runsQuery.data?.items ?? [];
  const audits = auditQuery.data?.items ?? [];

  return (
    <div className="flex h-full flex-col">
      <TopBar
        breadcrumb="ASSET"
        title={asset.name}
        subtitle={`${asset.source_format.toUpperCase()} · ${compactNumber(asset.triangle_count)} tris`}
        meta={`sha256:${shortHash(asset.checksum, 12)}`}
        actions={
          <>
            <select
              className="field h-[30px] w-44 text-[11px]"
              value={selectedPipelineId}
              onChange={(event) => setPipelineId(event.target.value)}
            >
              {pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                  {pipeline.is_template ? ' · 模板' : ''}
                </option>
              ))}
            </select>
            <RequireRole roles={['admin', 'artist']}>
              <button
                type="button"
                className="btn-primary"
                disabled={starting || !canStartRun()}
                title={canStartRun() ? undefined : MESSAGES.quotaFull}
                onClick={() => void startRun()}
              >
                {starting ? '入队中…' : '用默认管线跑一次'}
              </button>
            </RequireRole>
          </>
        }
      />

      <div className="flex shrink-0 items-center justify-between gap-3 border-b hairline px-5 py-1.5">
        <div className="flex items-center gap-1">
          {INSPECT_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setInspectMode(mode as InspectMode)}
              className={`h-[26px] px-2.5 text-[11px] transition-colors duration-150 ease-draw ${
                inspectMode === mode ? 'bg-[var(--blue-wash)] text-blueprint' : 'text-ink/60 hover:text-ink'
              }`}
            >
              {INSPECT_MODE_LABELS[mode]}
            </button>
          ))}
          <span className="mx-2 h-4 w-[1px] bg-[var(--rule-hair)]" />
          {CAMERA_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setCameraPreset(preset)}
              className={`h-[26px] px-2 text-[10px] uppercase tracking-[0.1em] ${
                cameraPreset === preset ? 'text-blueprint' : 'text-ink/45 hover:text-ink'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
        <p className="num text-[10px] text-ink/40">
          {asset.uv_channel_count ? `TEXCOORD_0 存在 · ${asset.uv_channel_count} 通道` : '⚠ TEXCOORD_0 缺失'}
        </p>
      </div>

      {error ? (
        <div className="px-5 pt-3">
          <ErrorPanel message={error} onRetry={() => void startRun()} />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1 border-r hairline">
          <MeshViewport
            meshUrl={assetFileUrl(asset.id)}
            format={asset.source_format}
            inspectMode={inspectMode}
            cameraPreset={cameraPreset}
            wireframeOverlay={inspectMode === 'solid'}
            caption={`${asset.name} · ${INSPECT_MODE_LABELS[inspectMode]} · ${cameraPreset}`}
            emptyHint="该资产没有可渲染几何"
          />
        </div>

        <InspectorPanel>
          <InspectorSection title="几何属性 / GEOMETRY">
            <InspectorRow label="三角面" value={formatNumber(asset.triangle_count)} />
            <InspectorRow label="顶点" value={formatNumber(asset.vertex_count)} />
            <InspectorRow
              label="UV 通道"
              value={asset.uv_channel_count ? asset.uv_channel_count : '缺失'}
              tone={asset.uv_channel_count ? undefined : 'error'}
            />
            <InspectorRow label="包围盒 X" value={(asset.bbox_json.extents?.[0] ?? 0).toFixed(2)} />
            <InspectorRow label="包围盒 Y" value={(asset.bbox_json.extents?.[1] ?? 0).toFixed(2)} />
            <InspectorRow label="包围球半径" value={(asset.bbox_json.sphere_radius ?? 0).toFixed(3)} />
            <InspectorRow label="状态" value={asset.status} />
            <InspectorRow label="上传" value={formatDate(asset.created_at)} />
          </InspectorSection>

          {!asset.uv_channel_count ? (
            <p className="border border-engineering/40 bg-[var(--red-wash)] px-2 py-1.5 text-[11px] leading-4 text-engineering">
              {MESSAGES.uvMissing}
            </p>
          ) : null}

          <InspectorSection title="运行历史 / RUNS" hint={`${runs.length}`}>
            {runs.length === 0 ? (
              <p className="text-[11px] leading-4 text-ink/50">
                还没有运行记录。选一条管线，点上方「用默认管线跑一次」即可产出 LOD。
              </p>
            ) : (
              <StatTable<PipelineRun>
                rowHeight={30}
                columns={[
                  {
                    key: 'id',
                    label: '运行',
                    render: (run) => (
                      <Link to={`/runs/${run.id}`} className="num text-[11px] text-blueprint hover:underline">
                        {run.id.slice(0, 8)}
                      </Link>
                    ),
                  },
                  { key: 'pipeline_name', label: '管线' },
                  {
                    key: 'status',
                    label: '状态',
                    render: (run) => <StatusBadge status={run.status} compact />,
                  },
                  {
                    key: 'created_at',
                    label: '时间',
                    align: 'right',
                    mono: true,
                    render: (run) => formatDate(run.created_at).slice(5),
                  },
                ]}
                rows={runs}
                getRowKey={(run) => run.id}
              />
            )}
          </InspectorSection>

          <InspectorSection title="审计时间线 / AUDIT" hint={`${audits.length}`}>
            <ul className="space-y-1.5">
              {audits.length === 0 ? <li className="text-[11px] text-ink/45">暂无审计记录</li> : null}
              {audits.map((log) => (
                <li key={log.id} className="border-b hairline pb-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="num text-[10px] uppercase tracking-[0.08em] text-ink/55">{log.action}</span>
                    <span className="num text-[9px] text-ink/40">{formatDate(log.created_at).slice(5)}</span>
                  </div>
                  <p className="text-[10px] text-ink/50">
                    {log.actor_name ?? 'system'} · {log.result}
                  </p>
                </li>
              ))}
            </ul>
          </InspectorSection>

          <p className="num text-[9px] uppercase tracking-[0.14em] text-ink/35">
            checksum · {shortHash(asset.checksum, 16)} · quota {quota?.remaining_runs ?? '-'} 并发可用
          </p>
        </InspectorPanel>
      </div>
    </div>
  );
}
