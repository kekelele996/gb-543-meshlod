export const RUN_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'canceled'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  queued: '排队中',
  running: '运行中',
  succeeded: '已完成',
  failed: '失败',
  canceled: '已取消',
};

export const TERMINAL_RUN_STATUSES: RunStatus[] = ['succeeded', 'failed', 'canceled'];
export const CANCELABLE_RUN_STATUSES: RunStatus[] = ['queued', 'running'];
