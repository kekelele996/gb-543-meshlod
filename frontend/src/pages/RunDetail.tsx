/** /runs/:id LOD 对比与统计：双视口对照、LOD 滑杆、每级统计表、日志增量、逐级下载。 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '../components/layout/TopBar';
import InspectorPanel, { InspectorRow, InspectorSection } from '../components/layout/InspectorPanel';
import MeshViewport, { type CameraPreset } from '../components/common/MeshViewport';
import LodSlider from '../components/common/LodSlider';
import StatTable from '../components/common/StatTable';
import ErrorPanel from '../components/common/ErrorPanel';
import EmptyState from '../components/common/EmptyState';
import RequireRole from '../components/common/RequireRole';
import { StageBadge, StatusBadge } from '../components/common/StageBadge';
import { getAsset, assetFileUrl } from '../api/assets';
import { cancelRun, retryRun } from '../api/runs';
import { downloadLevelFile, levelDownloadUrl } from '../api/levels';
import { listAudit } from '../api/audit';
import { useRunPolling } from '../hooks/useRunPolling';
import { useUiStore } from '../stores/uiStore';
import { INSPECT_MODES, INSPECT_MODE_LABELS, type InspectMode } from '../constants/inspectMode';
import { readToken } from '../utils/request';
import { compactNumber, formatDate, formatMs, formatNumber, formatSse, formatPercent } from '../utils/formatNumber';
import type { LodLevel } from '../types/lodLevel';

const CAMERA_PRESETS: CameraPreset[] = ['iso', 'front', 'top'];

export default function RunDetail() {
  const { id } = useParams<{ id: string }>();
  const pushToast = useUiStore((state) => state.pushToast);
  const inspectMode = useUiStore((state) => state.inspectMode);
  const setInspectMode = useUiStore((state) => state.setInspectMode);
  const { run, logs, loading, error: pollError, refresh } = useRunPolling(id);
  const [levelIndex, setLevelIndex] = useState(0);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('iso');
  const [actionError, setActionError] = useState<string | null>(null);
  const logBoxRef = useRef<HTMLDivElement>(null);

  const assetQuery = useQuery({
    queryKey: ['asset', run?.mesh_id],
    queryFn: () => getAsset(run?.mesh_id as string),
    enabled: Boolean(run?.mesh_id),
  });

  const levels = run?.levels ?? [];
  const currentLevel: LodLevel | undefined = levels.find((level) => level.level_index === levelIndex) ?? levels[0];

  useEffect(() => {
    if (levels.length && levelIndex === 0 && run?.status === 'succeeded') {
      setLevelIndex(levels[levels.length - 1].level_index);
    }
  }, [levels, levelIndex, run?.status]);

  useEffect(() => {
    const box = logBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [logs.length]);

  const auditQuery = useQuery({
    queryKey: ['run-audit', id, run?.status],
    queryFn: () => listAudit('run', id as string),
    enabled: Boolean(id),
  });

  const levelRows = useMemo(
    () =>
      levels.map((level) => ({
        ...level,
        reduction: run?.mesh_triangle_count ? 1 - level.triangle_count / run.mesh_triangle_count : 0,
      })),
    [levels, run?.mesh_triangle_count],
  );

  const downloadStats = async () => {
    if (!run) return;
    const token = readToken();
    const response = await fetch(`/api/runs/${run.id}/stats.json`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `meshlod_run_${run.id.slice(0, 8)}_stats.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const action = async (kind: 'cancel' | 'retry') => {
    if (!run) return;
    setActionError(null);
    try {
      const next = kind === 'cancel' ? await cancelRun(run.id) : await retryRun(run.id);
      pushToast(kind === 'cancel' ? '运行已取消' : '已创建新的运行（旧记录保留）');
      refresh();
      if (kind === 'retry') window.location.assign(`/runs/${next.id}`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : '操作失败');
    }
  };

  if (loading && !run) {
    return <p className="num p-6 text-[11px] text-ink/50">LOADING RUN…</p>;
  }
  if (!run) {
    return (
      <div className="p-6">
        <EmptyState
          title="运行不存在"
          description={pollError ?? '该运行记录可能已被删除。'}
          actions={
            <Link to="/runs" className="btn-primary">
              回到运行历史
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar
        breadcrumb="RUN"
        title={`run ${run.id.slice(0, 8)}`}
        subtitle={`${run.mesh_name ?? ''} × ${run.pipeline_name ?? ''}`}
        meta={`${formatDate(run.created_at)} · ${formatMs(run.stats_json?.duration_ms)}`}
        actions={
          <>
            <StatusBadge status={run.status} />
            <StatsJsonButton onClick={() => void downloadStats()} />
            {run.status === 'failed' || run.status === 'canceled' ? (
              <RequireRole roles={['admin', 'artist']}>
                <button type="button" className="btn" onClick={() => void action('retry')}>
                  重试（新建 run）
                </button>
              </RequireRole>
            ) : null}
            {run.cancelable ? (
              <RequireRole roles={['admin', 'artist']}>
                <button type="button" className="btn btn-danger" onClick={() => void action('cancel')}>
                  取消运行
                </button>
              </RequireRole>
            ) : null}
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
        <div className="flex items-center gap-3">
          <StageBadge stage={run.stage ?? undefined} />
          <span className="num text-[10px] text-ink/45">{run.progress}%</span>
        </div>
      </div>

      <div className="h-[3px] w-full bg-[var(--paper-2)]">
        <div
          className={`h-full transition-[width] duration-500 ease-draw ${
            run.status === 'failed' ? 'bg-engineering' : run.status === 'running' ? 'bg-[var(--amber)]' : 'bg-blueprint'
          }`}
          style={{ width: `${run.progress}%` }}
        />
      </div>

      {run.status === 'failed' || actionError ? (
        <div className="px-5 pt-3">
          <ErrorPanel
            title={`运行失败 · 停在 ${run.stats_json?.stage ?? 'unknown'} 阶段`}
            message={actionError ?? run.error_message ?? '未知错误'}
            code={run.stats_json?.error_code}
            onRetry={() => void action('retry')}
          />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1">
          <div className="relative min-w-0 flex-1 border-r hairline">
            <MeshViewport
              meshUrl={assetQuery.data ? assetFileUrl(assetQuery.data.id) : null}
              format={assetQuery.data?.source_format}
              inspectMode={inspectMode}
              cameraPreset={cameraPreset}
              caption={`原始 · ${assetQuery.data?.name ?? 'mesh'} · ${compactNumber(run.mesh_triangle_count ?? 0)} tris`}
              emptyHint="原始网格加载中"
            />
          </div>
          <div className="relative min-w-0 flex-1">
            {currentLevel ? (
              <MeshViewport
                key={currentLevel.id}
                meshUrl={levelDownloadUrl(currentLevel.id)}
                format="glb"
                inspectMode={inspectMode}
                cameraPreset={cameraPreset}
                caption={`L${currentLevel.level_index} · ${Math.round(currentLevel.ratio * 100)}% · ${compactNumber(
                  currentLevel.triangle_count,
                )} tris · ${formatSse(currentLevel.screen_space_error)}px`}
                emptyHint="该级 GLB 尚未产出"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-8 text-center">
                <p className="max-w-xs text-[12px] leading-5 text-ink/50">
                  {run.status === 'running' || run.status === 'queued'
                    ? 'worker 正在逐级生成 LOD，完成后这里显示当前级网格'
                    : '本次运行没有产出 LOD 层级'}
                </p>
              </div>
            )}
          </div>
        </div>

        <InspectorPanel>
          <InspectorSection title="LOD 阶梯 / LEVELS" hint={`${levels.length} 级`}>
            <LodSlider
              levels={levels}
              value={currentLevel?.level_index ?? 0}
              onChange={setLevelIndex}
              baseFaces={run.mesh_triangle_count ?? undefined}
            />
          </InspectorSection>

          <InspectorSection title="每级统计 / STATS" hint="权威值来自 LodLevel 表">
            <StatTable<LodLevel & { reduction: number }>
              rowHeight={32}
              highlightIndex={levelRows.findIndex((row) => row.level_index === currentLevel?.level_index)}
              onRowClick={(row) => setLevelIndex(row.level_index)}
              columns={[
                { key: 'level', label: '级', mono: true, render: (row) => `L${row.level_index}` },
                { key: 'ratio', label: '比例', align: 'right', mono: true, render: (row) => formatPercent(row.ratio, 0) },
                {
                  key: 'triangle_count',
                  label: '三角面',
                  align: 'right',
                  mono: true,
                  render: (row) => formatNumber(row.triangle_count),
                },
                {
                  key: 'vertex_count',
                  label: '顶点',
                  align: 'right',
                  mono: true,
                  render: (row) => compactNumber(row.vertex_count),
                },
                {
                  key: 'reduction',
                  label: '减面率',
                  align: 'right',
                  mono: true,
                  render: (row) => `-${Math.round(row.reduction * 100)}%`,
                },
                {
                  key: 'sse',
                  label: 'SSE px',
                  align: 'right',
                  mono: true,
                  render: (row) => formatSse(row.screen_space_error),
                },
              ]}
              rows={levelRows}
              getRowKey={(row) => row.id}
            />
          </InspectorSection>

          <InspectorSection title="下载 / ARTIFACTS">
            <div className="space-y-1">
              {levels.map((level) => (
                <button
                  key={level.id}
                  type="button"
                  className="flex w-full items-baseline justify-between border-b hairline py-1 text-left hover:bg-paper-2"
                  onClick={() =>
                    void downloadLevelFile(level.id, `meshlod_${run.id.slice(0, 6)}_lod${level.level_index}.glb`)
                  }
                >
                  <span className="num text-[11px] text-blueprint">L{level.level_index} · GLB</span>
                  <span className="num text-[10px] text-ink/45">{compactNumber(level.triangle_count)} tris ↓</span>
                </button>
              ))}
              <button
                type="button"
                className="flex w-full items-baseline justify-between py-1 text-left hover:bg-paper-2"
                onClick={() => void downloadStats()}
              >
                <span className="num text-[11px] text-blueprint">统计 JSON ↓</span>
                <span className="num text-[10px] text-ink/45">run + levels</span>
              </button>
            </div>
          </InspectorSection>

          <InspectorSection title="运行参数 / FROZEN">
            <InspectorRow label="策略" value={run.stats_json?.pipeline_snapshot?.strategy ?? '—'} />
            <InspectorRow
              label="比例链"
              value={(run.stats_json?.pipeline_snapshot?.target_ratios ?? [])
                .map((ratio) => Math.round(ratio * 100))
                .join(' / ')}
            />
            <InspectorRow label="基准三角面" value={formatNumber(run.stats_json?.base_triangle_count ?? run.mesh_triangle_count ?? 0)} />
            <InspectorRow label="最终三角面" value={formatNumber(run.stats_json?.final_triangle_count ?? 0)} />
            <InspectorRow label="总耗时" value={formatMs(run.stats_json?.duration_ms)} />
            <InspectorRow label="减面实现" value={(run.stats_json?.decimation_impl ?? []).join(', ') || '—'} />
            <InspectorRow
              label="UV 通道"
              value={run.stats_json?.preprocess?.uv_channel_count ?? '—'}
              tone={run.stats_json?.preprocess?.uv_channel_count ? undefined : 'error'}
            />
            <InspectorRow label="SSE 视场" value={`${run.stats_json?.sse?.fov_y_deg ?? 60}° / ${run.stats_json?.sse?.viewport_height ?? 1080}p`} />
            <InspectorRow label="SSE 距离" value={`${run.stats_json?.sse?.distance_factor ?? 3} × R`} />
          </InspectorSection>

          {(run.stats_json?.warnings ?? []).length ? (
            <InspectorSection title="警告 / WARNINGS">
              <ul className="space-y-1">
                {(run.stats_json?.warnings ?? []).map((warning, index) => (
                  <li key={index} className="text-[10px] leading-4 text-[var(--amber)]">
                    · {warning}
                  </li>
                ))}
              </ul>
            </InspectorSection>
          ) : null}

          <InspectorSection title="运行日志 / LOGS" hint={`${logs.length}`}>
            <div ref={logBoxRef} className="max-h-56 overflow-y-auto border-t hairline pt-1">
              {logs.length === 0 ? (
                <p className="text-[10px] text-ink/45">等待 worker 写入日志…</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex gap-2 border-b hairline py-0.5">
                    <span
                      className={`num w-8 shrink-0 text-[9px] uppercase ${
                        log.level === 'error'
                          ? 'text-engineering'
                          : log.level === 'warn'
                            ? 'text-[var(--amber)]'
                            : 'text-ink/35'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="text-[10px] leading-4 text-ink/70">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </InspectorSection>

          <InspectorSection title="审计 / AUDIT" hint={`${auditQuery.data?.total ?? 0}`}>
            <ul className="space-y-1">
              {(auditQuery.data?.items ?? []).map((log) => (
                <li key={log.id} className="border-b hairline pb-1">
                  <span className="num text-[10px] uppercase text-ink/55">{log.action}</span>
                  <span className="num ml-2 text-[9px] text-ink/40">{formatDate(log.created_at).slice(5)}</span>
                </li>
              ))}
              {!auditQuery.data?.items?.length ? <li className="text-[10px] text-ink/45">暂无审计记录</li> : null}
            </ul>
          </InspectorSection>

          <p className="num text-[9px] uppercase tracking-[0.14em] text-ink/35">{pollError ?? 'poll 2s · after_id 增量'}</p>
        </InspectorPanel>
      </div>
    </div>
  );
}

function StatsJsonButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn" onClick={onClick}>
      统计 JSON
    </button>
  );
}
