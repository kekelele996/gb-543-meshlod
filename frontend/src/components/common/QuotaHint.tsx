/** 配额提示：显示剩余并发运行数与上传额度。 */
import { useQuota } from '../../hooks/useQuota';
import { MESSAGES } from '../../constants/messages';

export default function QuotaHint({ compact = false }: { compact?: boolean }) {
  const { quota } = useQuota();
  if (!quota) return null;
  const exhausted = quota.remaining_runs <= 0;
  return (
    <p
      className={`num text-[10px] ${exhausted ? 'text-engineering' : 'text-ink/55'} ${
        compact ? '' : 'border-t hairline pt-2'
      }`}
    >
      {exhausted
        ? MESSAGES.quotaFull
        : `剩余并发 ${quota.remaining_runs}/${quota.max_concurrent_runs} · 上传上限 ${quota.max_upload_mb}MB`}
    </p>
  );
}
