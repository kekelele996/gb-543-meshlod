/** 千分位 / 百分比 / 秒 / MB / SSE 像素（tabular-nums 语义由 .num 类保证）。 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Math.round(value).toLocaleString('en-US');
}

export function compactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const normalized = value > 1 ? value : value * 100;
  return `${normalized.toFixed(digits)}%`;
}

export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatMb(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—';
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatSse(px: number | null | undefined): string {
  if (px === null || px === undefined) return '—';
  return `${Number(px).toFixed(3)}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

export function shortHash(value: string | null | undefined, len = 8): string {
  if (!value) return '—';
  return value.slice(0, len);
}
