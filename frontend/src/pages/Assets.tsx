/** /assets 资产库：拖拽上传、排序、表格/缩略图双视图、进入检查器。 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import TopBar from '../components/layout/TopBar';
import AssetThumb from '../components/common/AssetThumb';
import EmptyState from '../components/common/EmptyState';
import ErrorPanel from '../components/common/ErrorPanel';
import QuotaHint from '../components/common/QuotaHint';
import RequireRole from '../components/common/RequireRole';
import { ASSET_STATUS_LABELS, type AssetStatus } from '../constants/assetStatus';
import { MESSAGES } from '../constants/messages';
import { MESH_ACCEPT, MESH_FORMAT_LABELS } from '../constants/meshFormat';
import { createSampleAsset, listAssets, uploadAsset } from '../api/assets';
import { useAssetStore } from '../stores/assetStore';
import { useUiStore } from '../stores/uiStore';
import { compactNumber, formatDate, formatNumber } from '../utils/formatNumber';

const COLUMNS = [
  { key: 'asset', label: '资产 / 缩略图', width: 'auto' },
  { key: 'format', label: '格式', width: '110px' },
  { key: 'triangle_count', label: '三角面', width: '104px' },
  { key: 'vertex_count', label: '顶点', width: '104px' },
  { key: 'uv_channel_count', label: 'UV 通道', width: '84px' },
  { key: 'status', label: '状态', width: '100px' },
  { key: 'created_at', label: '上传时间', width: '132px' },
];

export default function Assets() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sort, order, view, setSort, setOrder, setView, status, setStatus, uploadPercent, setUploadPercent } =
    useAssetStore();
  const pushToast = useUiStore((state) => state.pushToast);
  const [error, setError] = useState<{ message: string; code?: string; file?: File } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const assetsQuery = useQuery({
    queryKey: ['assets', sort, order, status],
    queryFn: () => listAssets({ sort, order, status: status || undefined }),
  });

  const assets = assetsQuery.data?.items ?? [];
  const totalTris = useMemo(
    () => assets.reduce((sum, asset) => sum + asset.triangle_count, 0),
    [assets],
  );

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      const suffix = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
      if (!['.obj', '.glb', '.gltf'].includes(suffix)) {
        setError({ message: MESSAGES.uploadBadFormat, code: 'E_UNSUPPORTED_FORMAT', file });
        return;
      }
      if (file.size > 80 * 1024 * 1024) {
        setError({ message: MESSAGES.uploadTooLarge, code: 'E_FILE_TOO_LARGE', file });
        return;
      }
      setUploading(true);
      setUploadPercent(0);
      try {
        const result = await uploadAsset(file, (percent) => setUploadPercent(percent));
        pushToast(
          result.duplicate
            ? `${result.asset.name} 内容相同，已返回既有资产`
            : `${result.asset.name} 已解析：${formatNumber(result.asset.triangle_count)} 三角面`,
        );
        await queryClient.invalidateQueries({ queryKey: ['assets'] });
      } catch (caught) {
        const payload = caught as { message?: string; code?: string };
        setError({ message: payload.message ?? '上传失败', code: payload.code, file });
      } finally {
        setUploading(false);
        setUploadPercent(null);
      }
    },
    [pushToast, queryClient, setUploadPercent],
  );

  const handleSample = async () => {
    try {
      const result = await createSampleAsset();
      pushToast(`已载入示例网格 ${result.asset.name}`);
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
    } catch (caught) {
      setError({ message: caught instanceof Error ? caught.message : '载入示例失败' });
    }
  };

  const onSort = (key: string) => {
    if (sort === key) setOrder(order === 'desc' ? 'asc' : 'desc');
    else {
      setSort(key as 'created_at' | 'triangle_count' | 'name');
      setOrder('desc');
    }
  };

  return (
    <div
      className="flex h-full flex-col"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) void upload(file);
      }}
    >
      <TopBar
        title="资产库"
        breadcrumb="ASSETS"
        subtitle={`${assets.length} 个资产 · ${compactNumber(totalTris)} 三角面`}
        actions={
          <>
            <select className="field h-[30px] w-32 text-[11px]" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">全部状态</option>
              {(Object.keys(ASSET_STATUS_LABELS) as AssetStatus[]).map((key) => (
                <option key={key} value={key}>
                  {ASSET_STATUS_LABELS[key]}
                </option>
              ))}
            </select>
            <div className="flex border rule-line">
              {(['table', 'grid'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  className={`h-[30px] px-2.5 text-[11px] ${
                    view === mode ? 'bg-[var(--blue-wash)] text-blueprint' : 'text-ink/60'
                  }`}
                >
                  {mode === 'table' ? '密度表格' : '缩略图'}
                </button>
              ))}
            </div>
            <RequireRole roles={['admin', 'artist']}>
              <button type="button" className="btn-primary" onClick={() => fileInputRef.current?.click()}>
                上传网格
              </button>
            </RequireRole>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <input
          ref={fileInputRef}
          type="file"
          accept={MESH_ACCEPT}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = '';
          }}
        />

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b hairline pb-2">
          <p className="num text-[10px] uppercase tracking-[0.14em] text-ink/40">
            拖入 .obj / .glb / .gltf（单文件 ≤ 80MB）· 内容相同按 checksum 复用
          </p>
          <QuotaHint compact />
        </div>

        {uploading ? (
          <div className="mb-3 flex items-center gap-3 border rule-line px-3 py-2">
            <span className="num text-[10px] text-ink/60">UPLOAD</span>
            <div className="h-[3px] flex-1 bg-[var(--paper-2)]">
              <div
                className="h-full bg-blueprint transition-[width] duration-200 ease-draw"
                style={{ width: `${uploadPercent ?? 0}%` }}
              />
            </div>
            <span className="num text-[11px]">{uploadPercent ?? 0}%</span>
          </div>
        ) : null}

        {error ? (
          <div className="mb-3">
            <ErrorPanel
              title="上传未完成"
              message={error.message}
              code={error.code}
              onRetry={error.file ? () => void upload(error.file as File) : undefined}
            />
          </div>
        ) : null}

        {assetsQuery.isLoading ? (
          <p className="num text-[11px] text-ink/50">LOADING ASSETS…</p>
        ) : assets.length === 0 ? (
          <EmptyState
            title={MESSAGES.emptyAssetsTitle}
            description={MESSAGES.emptyAssetsHint}
            hint="支持 obj / glb / gltf；上传后立即解析顶点数、三角面与包围盒并生成缩略图"
            actions={
              <>
                <button type="button" className="btn-primary" onClick={() => fileInputRef.current?.click()}>
                  拖入 .glb 开始
                </button>
                <button type="button" className="btn" onClick={() => void handleSample()}>
                  载入一个示例立方体网格
                </button>
              </>
            }
          />
        ) : view === 'table' ? (
          <table className="w-full table-fixed border-collapse text-[12px]">
            <thead>
              <tr className="border-b rule-line">
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    style={{ width: column.width }}
                    onClick={() =>
                      ['triangle_count', 'created_at'].includes(column.key) ? onSort(column.key) : undefined
                    }
                    className={`label select-none pb-1.5 text-left font-normal ${
                      ['triangle_count', 'created_at'].includes(column.key) ? 'cursor-pointer hover:text-ink' : ''
                    }`}
                  >
                    {column.label}
                    {sort === column.key ? <span className="ml-1 text-blueprint">{order === 'desc' ? '↓' : '↑'}</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr
                  key={asset.id}
                  style={{ height: 40 }}
                  className="cursor-pointer border-b hairline hover:bg-paper-2"
                  onClick={() => navigate(`/assets/${asset.id}`)}
                >
                  <td className="py-1 pr-2">
                    <AssetThumb asset={asset} compact size={44} />
                  </td>
                  <td className="num truncate whitespace-nowrap text-[11px] text-ink/70">
                    {MESH_FORMAT_LABELS[asset.source_format]}
                  </td>
                  <td className="num whitespace-nowrap pr-2 text-right">{formatNumber(asset.triangle_count)}</td>
                  <td className="num whitespace-nowrap pr-2 text-right text-ink/70">
                    {formatNumber(asset.vertex_count)}
                  </td>
                  <td
                    className={`num whitespace-nowrap pr-2 text-right ${
                      asset.uv_channel_count ? '' : 'text-engineering'
                    }`}
                  >
                    {asset.uv_channel_count ? `${asset.uv_channel_count} 通道` : '缺失'}
                  </td>
                  <td className="whitespace-nowrap">
                    <span
                      className={`num text-[10px] uppercase tracking-[0.06em] ${
                        asset.status === 'ready' ? 'text-blueprint' : asset.status === 'invalid' ? 'text-engineering' : 'text-ink/55'
                      }`}
                    >
                      {ASSET_STATUS_LABELS[asset.status]}
                    </span>
                  </td>
                  <td className="num whitespace-nowrap text-[11px] text-ink/60">{formatDate(asset.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="grid grid-cols-2 gap-[1px] bg-[var(--rule-hair)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => navigate(`/assets/${asset.id}`)}
                className="bg-paper px-3 py-3 text-left hover:bg-paper-2"
              >
                <AssetThumb asset={asset} />
                <p className="num mt-2 text-[10px] text-ink/45">
                  {formatNumber(asset.vertex_count)} v · {formatDate(asset.created_at)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-20 border-2 border-dashed border-blueprint bg-[var(--blue-wash)]/40">
          <div className="flex h-full items-center justify-center">
            <p className="font-display text-lg tracking-tight text-blueprint">松手开始解析网格</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
