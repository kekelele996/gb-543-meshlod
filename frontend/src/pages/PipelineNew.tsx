/** /pipelines/new 管线构建器：策略三选一 → 表单结构变化；比例链即时校验 + 后端二次校验。 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import TopBar from '../components/layout/TopBar';
import InspectorPanel, { InspectorRow, InspectorSection } from '../components/layout/InspectorPanel';
import ErrorPanel from '../components/common/ErrorPanel';
import StatTable from '../components/common/StatTable';
import { listAssets } from '../api/assets';
import { createPipeline, listPipelines, updatePipeline } from '../api/pipelines';
import { LOD_STRATEGIES, LOD_STRATEGY_HINTS, LOD_STRATEGY_LABELS, type LodStrategy } from '../constants/lodStrategy';
import { usePipelineStore, validateRatioChain } from '../stores/pipelineStore';
import { useUiStore } from '../stores/uiStore';
import { compactNumber, formatNumber } from '../utils/formatNumber';
import type { RepairFlags } from '../types/pipeline';
import type { MeshAsset } from '../types/meshAsset';

const FLAG_LABELS: Record<keyof RepairFlags, string> = {
  weld: '焊接顶点 merge_vertices',
  degnerate: '去退化面 area < 1e-12',
  normals: '法线重算 fix_normals',
  uv_check: 'UV 通道检查 TEXCOORD_0',
};

export default function PipelineNew() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pushToast = useUiStore((state) => state.pushToast);
  const {
    name,
    strategy,
    ratios,
    repairFlags,
    strategyParams,
    isTemplate,
    setName,
    setStrategy,
    setRatios,
    setRepairFlag,
    setStrategyParams,
    setIsTemplate,
    reset,
  } = usePipelineStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewAssetId, setPreviewAssetId] = useState<string>('');

  const pipelinesQuery = useQuery({ queryKey: ['pipelines'], queryFn: () => listPipelines(false) });
  const assetsQuery = useQuery({ queryKey: ['assets', 'created_at', 'desc', ''], queryFn: () => listAssets({}) });

  const assets: MeshAsset[] = assetsQuery.data?.items ?? [];
  const previewAsset = assets.find((asset) => asset.id === previewAssetId) ?? assets[0];

  useEffect(() => {
    if (!previewAssetId && assets.length) setPreviewAssetId(assets[0].id);
  }, [assets, previewAssetId]);

  const validation = useMemo(() => validateRatioChain(ratios), [ratios]);

  const previewRows = useMemo(() => {
    const base = previewAsset?.triangle_count ?? 0;
    if (!base) return [];
    if (strategy === 'ratio_chain') {
      return ratios.map((ratio, index) => ({
        index,
        ratio,
        target: Math.round((base * ratio) / 100),
      }));
    }
    if (strategy === 'adaptive') {
      const maxFaces = strategyParams.max_faces ?? Math.round(base / 2);
      const minFaces = strategyParams.min_faces ?? 2000;
      const rows: { index: number; ratio: number; target: number }[] = [{ index: 0, ratio: 100, target: base }];
      let current = Math.min(maxFaces, base);
      let level = 1;
      while (current > minFaces && level < 6) {
        current = Math.max(Math.round(current / 2), minFaces);
        rows.push({ index: level, ratio: Math.round((current / base) * 1000) / 10, target: current });
        level += 1;
      }
      return rows;
    }
    const budget = strategyParams.target_error_px ?? 6;
    const rows: { index: number; ratio: number; target: number }[] = [];
    let level = 0;
    while (level < 5) {
      const ratio = Math.pow(0.5, level);
      const estimated = level === 0 ? 0 : 1.6 ** (level - 1) * 1.2;
      if (estimated > budget * 1.5) break;
      rows.push({ index: level, ratio: Math.round(ratio * 1000) / 10, target: Math.round(base * ratio) });
      level += 1;
    }
    return rows.length ? rows : [{ index: 0, ratio: 100, target: base }];
  }, [previewAsset, ratios, strategy, strategyParams]);

  const loadTemplate = (pipelineId: string) => {
    const pipeline = (pipelinesQuery.data?.items ?? []).find((item) => item.id === pipelineId);
    if (!pipeline) return;
    setEditingId(pipeline.id);
    reset({
      name: pipeline.name,
      strategy: pipeline.strategy,
      ratios: pipeline.target_ratios_json.map((ratio) => Math.round(ratio * 1000) / 10),
      repairFlags: pipeline.repair_flags_json as RepairFlags,
      strategyParams: pipeline.strategy_params_json,
      isTemplate: pipeline.is_template,
    });
  };

  const submit = async (asTemplate: boolean) => {
    setError(null);
    if (strategy === 'ratio_chain' && !validation.ok) {
      setError(validation.summary);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        strategy,
        target_ratios: ratios.map((ratio) => Math.round(ratio * 10) / 1000),
        repair_flags: repairFlags,
        strategy_params: strategyParams,
        is_template: asTemplate,
      };
      const result = editingId
        ? await updatePipeline(editingId, payload)
        : await createPipeline(payload);
      pushToast(result.message);
      await queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      setEditingId(result.pipeline.id);
    } catch (caught) {
      const payload = caught as { message?: string; code?: string };
      setError(payload.message ?? '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const updateRatio = (index: number, value: string) => {
    const next = [...ratios];
    next[index] = value === '' ? 0 : Number(value);
    setRatios(next);
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar
        breadcrumb="PIPELINE"
        title={editingId ? `编辑：${name}` : '新建管线'}
        subtitle={LOD_STRATEGY_LABELS[strategy]}
        meta={`${ratios.length} 级 · ${isTemplate ? '模板' : '普通管线'}`}
        actions={
          <>
            <button type="button" className="btn" disabled={saving} onClick={() => void submit(false)}>
              保存管线
            </button>
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void submit(true)}>
              {saving ? '保存中…' : '保存为模板'}
            </button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b rule-line pb-2">
            <p className="label">已保存模板 / TEMPLATES</p>
            <div className="flex flex-wrap gap-1">
              {(pipelinesQuery.data?.items ?? []).map((pipeline) => (
                <button
                  key={pipeline.id}
                  type="button"
                  onClick={() => loadTemplate(pipeline.id)}
                  className={`num border px-2 py-0.5 text-[10px] ${
                    editingId === pipeline.id
                      ? 'border-blueprint text-blueprint'
                      : 'border-rule/40 text-ink/60 hover:border-rule'
                  }`}
                >
                  {pipeline.name}
                  {pipeline.is_template ? ' · T' : ''}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="mt-4">
              <ErrorPanel message={error} />
            </div>
          ) : null}

          <section className="mt-5">
            <p className="label">01 / 名称</p>
            <input
              className="field mt-1.5 max-w-md"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：园区标准 LOD"
            />
          </section>

          <section className="mt-6">
            <p className="label">02 / 策略</p>
            <div className="mt-1.5 grid gap-[1px] bg-[var(--rule-hair)] sm:grid-cols-3">
              {LOD_STRATEGIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStrategy(item as LodStrategy)}
                  className={`px-3 py-2.5 text-left ${
                    strategy === item ? 'bg-[var(--blue-wash)]' : 'bg-paper hover:bg-paper-2'
                  }`}
                >
                  <p className={`text-[12px] ${strategy === item ? 'text-blueprint' : ''}`}>
                    {LOD_STRATEGY_LABELS[item]}
                  </p>
                  <p className="num mt-0.5 text-[10px] text-ink/45">{LOD_STRATEGY_HINTS[item]}</p>
                </button>
              ))}
            </div>
          </section>

          {strategy === 'ratio_chain' ? (
            <section className="mt-6">
              <div className="flex items-baseline justify-between">
                <p className="label">03 / 比例链（%，严格递减，末项 &gt; 0）</p>
                <div className="flex gap-1">
                  {[100, 50, 25, 10].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="num border border-rule/40 px-1.5 py-0.5 text-[10px] text-ink/60 hover:border-rule"
                      onClick={() => setRatios([100, 50, 25, 10])}
                      style={{ display: preset === 100 ? 'inline-block' : 'none' }}
                    >
                      重置 preset
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn h-[24px] px-2 text-[10px]"
                    onClick={() => setRatios([...ratios, Math.max(1, Math.round((ratios[ratios.length - 1] ?? 10) / 2))])}
                  >
                    + 加一级
                  </button>
                  <button
                    type="button"
                    className="btn h-[24px] px-2 text-[10px]"
                    disabled={ratios.length <= 1}
                    onClick={() => setRatios(ratios.slice(0, -1))}
                  >
                    − 删一级
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                {ratios.map((ratio, index) => (
                  <div key={index} className="w-20">
                    <label className="label" htmlFor={`ratio-${index}`}>
                      L{index} 比例
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        id={`ratio-${index}`}
                        className={`field mt-1 text-right ${
                          validation.errors[index] ? 'border-engineering' : ''
                        }`}
                        value={Number.isFinite(ratio) ? ratio : ''}
                        onChange={(event) => updateRatio(index, event.target.value)}
                      />
                      <span className="num text-[10px] text-ink/40">%</span>
                    </div>
                    {validation.errors[index] ? (
                      <p className="mt-1 text-[10px] leading-3 text-engineering">{validation.errors[index]}</p>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className={`num mt-2 text-[10px] ${validation.ok ? 'text-ink/50' : 'text-engineering'}`}>
                {validation.summary}
              </p>
            </section>
          ) : null}

          {strategy === 'target_error' ? (
            <section className="mt-6">
              <p className="label">03 / 误差预算（px，1080p / 60°）</p>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  className="field w-32 text-right"
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={strategyParams.target_error_px ?? 6}
                  onChange={(event) =>
                    setStrategyParams({ ...strategyParams, target_error_px: Number(event.target.value) })
                  }
                />
                <span className="num text-[11px] text-ink/50">px · 逐级估算达到预算即停</span>
              </div>
            </section>
          ) : null}

          {strategy === 'adaptive' ? (
            <section className="mt-6">
              <p className="label">03 / 面数上下限</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                <label className="text-[11px] text-ink/60">
                  min_faces
                  <input
                    className="field mt-1 w-32 text-right"
                    type="number"
                    value={strategyParams.min_faces ?? 2000}
                    onChange={(event) =>
                      setStrategyParams({ ...strategyParams, min_faces: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="text-[11px] text-ink/60">
                  max_faces
                  <input
                    className="field mt-1 w-32 text-right"
                    type="number"
                    value={strategyParams.max_faces ?? 200000}
                    onChange={(event) =>
                      setStrategyParams({ ...strategyParams, max_faces: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
            </section>
          ) : null}

          <section className="mt-6">
            <p className="label">04 / 修复开关</p>
            <div className="mt-1.5 grid gap-[1px] bg-[var(--rule-hair)] sm:grid-cols-2">
              {(Object.keys(FLAG_LABELS) as (keyof RepairFlags)[]).map((flag) => (
                <label
                  key={flag}
                  className="flex cursor-pointer items-center justify-between gap-3 bg-paper px-3 py-2 hover:bg-paper-2"
                >
                  <span className="text-[12px]">{FLAG_LABELS[flag]}</span>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-[var(--blue)]"
                    checked={repairFlags[flag]}
                    onChange={(event) => setRepairFlag(flag, event.target.checked)}
                  />
                </label>
              ))}
            </div>
            {!repairFlags.uv_check ? (
              <p className="num mt-1.5 text-[10px] text-[var(--amber)]">
                uv_check 关闭：缺少 TEXCOORD_0 的资产不会中止，只写 warn 日志
              </p>
            ) : null}
          </section>

          <section className="mt-6">
            <p className="label">05 / 保存方式</p>
            <label className="mt-1.5 flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-[var(--blue)]"
                checked={isTemplate}
                onChange={(event) => setIsTemplate(event.target.checked)}
              />
              保存为模板（is_template）—— 可在资产检查器里被选为默认管线
            </label>
            <p className="num mt-2 text-[10px] leading-4 text-ink/45">
              运行会冻结参数快照；之后修改管线不影响历史 run 的统计与产物。
            </p>
          </section>

          <div className="mt-8 flex items-center gap-3 border-t hairline pt-3">
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void submit(isTemplate)}>
              {saving ? '保存中…' : editingId ? '更新管线' : '保存管线'}
            </button>
            <button type="button" className="btn" onClick={() => navigate('/assets')}>
              返回资产库
            </button>
          </div>
        </div>

        <InspectorPanel width={336}>
          <InspectorSection title="产出预估 / PREVIEW" hint={previewAsset ? '按所选资产' : '无资产'}>
            <select
              className="field mb-2 text-[11px]"
              value={previewAsset?.id ?? ''}
              onChange={(event) => setPreviewAssetId(event.target.value)}
            >
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
            <InspectorRow label="基准三角面" value={formatNumber(previewAsset?.triangle_count ?? 0)} />
            <InspectorRow label="级数" value={previewRows.length} />
            <div className="mt-2">
              <StatTable
                rowHeight={26}
                columns={[
                  { key: 'index', label: '级', mono: true, render: (row) => `L${row.index}` },
                  { key: 'ratio', label: '比例', align: 'right', mono: true, render: (row) => `${row.ratio}%` },
                  {
                    key: 'target',
                    label: '目标三角面',
                    align: 'right',
                    mono: true,
                    render: (row) => compactNumber(row.target),
                  },
                ]}
                rows={previewRows}
                getRowKey={(row) => String(row.index)}
              />
            </div>
          </InspectorSection>

          <InspectorSection title="校验 / VALIDATION">
            <p className={`num text-[11px] ${validation.ok ? 'text-blueprint' : 'text-engineering'}`}>
              {strategy === 'ratio_chain' ? validation.summary : '策略参数由后端二次校验'}
            </p>
            <p className="mt-2 text-[10px] leading-4 text-ink/45">
              前端即时校验 + 后端 {`pipeline_service.validate_chain()`} 二次校验；比例必须严格递减且末项 &gt; 0。
            </p>
          </InspectorSection>

          <InspectorSection title="修复开关摘要">
            {(Object.keys(FLAG_LABELS) as (keyof RepairFlags)[]).map((flag) => (
              <InspectorRow
                key={flag}
                label={flag}
                value={repairFlags[flag] ? 'ON' : 'OFF'}
                tone={repairFlags[flag] ? 'blue' : undefined}
              />
            ))}
          </InspectorSection>
        </InspectorPanel>
      </div>
    </div>
  );
}
