/** 两形态：状态型（RunStatus，点 + 文案）/ 阶段型（当前处理步骤 weld → decimate）。 */
import { RUN_STATUS_LABELS, type RunStatus } from '../../constants/runStatus';

interface StatusBadgeProps {
  status: RunStatus;
  compact?: boolean;
}

const DOT_CLASS: Record<RunStatus, string> = {
  queued: 'bg-[var(--ink-faint)]',
  running: 'bg-[var(--amber)]',
  succeeded: 'bg-[var(--blue)]',
  failed: 'bg-[var(--red)]',
  canceled: 'bg-[var(--rule)]',
};

export function StatusBadge({ status, compact = false }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${compact ? 'text-[11px]' : 'text-[12px]'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[status]}`} />
      <span className={status === 'running' ? 'text-[var(--amber)]' : status === 'failed' ? 'text-engineering' : ''}>
        {RUN_STATUS_LABELS[status]}
      </span>
    </span>
  );
}

interface StageBadgeProps {
  stage?: string | null;
  className?: string;
}

const STAGE_LABELS: Record<string, string> = {
  queued: 'queued',
  load: 'load',
  preprocess: 'preprocess',
  plan: 'plan',
  done: 'done',
  canceled: 'canceled',
  weld: 'weld',
  uv_check: 'uv_check',
  decimate: 'decimate',
  export: 'export',
  sse: 'sse',
};

export function StageBadge({ stage, className = '' }: StageBadgeProps) {
  if (!stage) return null;
  const parts = stage.startsWith('level_')
    ? ['decimate', stage]
    : [STAGE_LABELS[stage] ?? stage];
  return (
    <span className={`num inline-flex items-center gap-1 border border-rule/40 px-1.5 py-0.5 text-[10px] ${className}`}>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="flex items-center gap-1">
          {index > 0 ? <span className="text-ink/40">→</span> : null}
          {part}
        </span>
      ))}
    </span>
  );
}

export default StageBadge;
