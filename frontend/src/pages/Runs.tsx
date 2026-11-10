/** /runs 运行历史：状态筛选、真实 progress 进度条、仅 queued/running 可取消。 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import TopBar from '../components/layout/TopBar';
import AssetThumb from '../components/common/AssetThumb';
import EmptyState from '../components/common/EmptyState';
import ErrorPanel from '../components/common/ErrorPanel';
import RequireRole from '../components/common/RequireRole';
import { StageBadge, StatusBadge } from '../components/common/StageBadge';
import { cancelRun, listRuns } from '../api/runs';
import { listAssets } from '../api/assets';
import { CANCELABLE_RUN_STATUSES, RUN_STATUS_LABELS, RUN_STATUSES, TERMINAL_RUN_STATUSES, type RunStatus } from '../constants/runStatus';
import { useRunStore } from '../stores/runStore';
import { useUiStore } from '../stores/uiStore';
import { MESSAGES } from '../constants/messages';
import { compactNumber, formatDate, formatNumber } from '../utils/formatNumber';
import type { PipelineRun } from '../types/run';

export default function Runs() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { statusFilter, setStatusFilter } = useRunStore();
  const pushToast = useUiStore((state) => state.pushToast);
  const [error, setError] = useState<string | null>(null);

  const runsQuery = useQuery({
    queryKey: ['runs', statusFilter],
    queryFn: () => listRuns(statusFilter || undefined),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      return items.some((run) => !TERMINAL_RUN_STATUSES.includes(run.status)) ? 2500 : false;
    },
  });
  const assetsQuery = useQuery({ queryKey: ['assets', 'created_at', 'desc', ''], queryFn: () => listAssets({}) });

  const runs = runsQuery.data?.items ?? [];
  const assets = assetsQuery.data?.items ?? [];
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));

  const doCancel = async (run: PipelineRun) => {
    setError(null);
    try {
      await cancelRun(run.id);
      pushToast(`运行 ${run.id.slice(0, 8)} 已取消`);
      await queryClient.invalidateQueries({ queryKey: ['runs'] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '取消失败');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar
        breadcrumb="RUNS"
        title="运行历史"
        subtitle={`${runs.length} 条记录`}
        actions={
          <Link to="/pipelines/new" className="btn">
            配置管线
          </Link>
        }
      />

      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b hairline px-5 py-2">
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          className={`h-[26px] px-2.5 text-[11px] ${
            statusFilter === '' ? 'bg-[var(--blue-wash)] text-blueprint' : 'text-ink/60 hover:text-ink'
          }`}
        >
          全部
        </button>
        {RUN_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status as RunStatus)}
            className={`h-[26px] px-2.5 text-[11px] ${
              statusFilter === status ? 'bg-[var(--blue-wash)] text-blueprint' : 'text-ink/60 hover:text-ink'
            }`}
          >
            {RUN_STATUS_LABELS[status]}
          </button>
        ))}
        <span className="ml-auto num text-[10px] text-ink/40">每 2.5s 刷新未完成运行</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {error ? (
          <div className="mb-3">
            <ErrorPanel message={error} />
          </div>
        ) : null}

        {runs.length === 0 ? (
          <EmptyState
            title={MESSAGES.emptyRunsTitle}
            description={MESSAGES.emptyRunsHint}
            hint="发起运行后这里会显示真实进度、当前阶段与失败原因"
            actions={
              <Link to="/pipelines/new" className="btn-primary">
                去配置一条管线
              </Link>
            }
          />
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b rule-line">
                {['资产', '管线', '状态', '阶段', '进度', '三角面', '发起人', '时间', ''].map((head) => (
                  <th key={head} className="label pb-1.5 text-left font-normal">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const asset = assetById.get(run.mesh_id);
                return (
                  <tr
                    key={run.id}
                    style={{ height: 40 }}
                    className="cursor-pointer border-b hairline hover:bg-paper-2"
                    onClick={() => navigate(`/runs/${run.id}`)}
                  >
                    <td className="py-1 pr-2">
                      {asset ? (
                        <AssetThumb asset={asset} compact size={40} />
                      ) : (
                        <span className="num text-[11px] text-ink/60">{run.mesh_name ?? run.mesh_id.slice(0, 8)}</span>
                      )}
                    </td>
                    <td className="text-[11px]">
                      {run.pipeline_name}
                      <span className="num ml-1 text-[9px] text-ink/40">{run.id.slice(0, 6)}</span>
                    </td>
                    <td>
                      <StatusBadge status={run.status} compact />
                    </td>
                    <td>
                      <StageBadge stage={run.stage ?? undefined} />
                    </td>
                    <td className="w-28">
                      <div className="flex items-center gap-2">
                        <div className="h-[3px] flex-1 bg-[var(--paper-2)]">
                          <div
                            className={`h-full transition-[width] duration-300 ease-draw ${
                              run.status === 'failed' ? 'bg-engineering' : 'bg-blueprint'
                            }`}
                            style={{ width: `${run.progress}%` }}
                          />
                        </div>
                        <span className="num w-8 text-right text-[10px] text-ink/60">{run.progress}%</span>
                      </div>
                    </td>
                    <td className="num text-right text-[11px]">{formatNumber(run.mesh_triangle_count ?? 0)}</td>
                    <td className="text-[11px] text-ink/60">{run.requested_by_name ?? '—'}</td>
                    <td className="num text-[11px] text-ink/55">{formatDate(run.created_at)}</td>
                    <td className="text-right">
                      {CANCELABLE_RUN_STATUSES.includes(run.status) ? (
                        <RequireRole roles={['admin', 'artist']}>
                          <button
                            type="button"
                            className="btn btn-danger h-[24px] px-2 text-[10px]"
                            onClick={(event) => {
                              event.stopPropagation();
                              void doCancel(run);
                            }}
                          >
                            取消
                          </button>
                        </RequireRole>
                      ) : (
                        <span className="num text-[10px] text-ink/35">
                          {run.levels.length ? `${compactNumber(run.levels[run.levels.length - 1].triangle_count)} tris` : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
