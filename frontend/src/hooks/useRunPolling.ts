/** 2s 轮询运行详情与增量日志，终态停表；页面不可见时暂停，回到前台立即拉一次。 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getLogs, getRun } from '../api/runs';
import { TERMINAL_RUN_STATUSES, type RunStatus } from '../constants/runStatus';
import type { PipelineRun, RunLog } from '../types/run';

export interface RunPollingState {
  run: PipelineRun | null;
  logs: RunLog[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useRunPolling(runId: string | undefined): RunPollingState {
  const [run, setRun] = useState<PipelineRun | null>(null);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [loading, setLoading] = useState(Boolean(runId));
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef(0);
  const terminalRef = useRef<RunStatus | null>(null);
  const runIdRef = useRef(runId);
  runIdRef.current = runId;

  const tick = useCallback(async () => {
    const id = runIdRef.current;
    if (!id || terminalRef.current) return;
    try {
      const detail = await getRun(id);
      setRun(detail);
      setLoading(false);
      setError(null);
      const delta = await getLogs(id, cursorRef.current);
      if (delta.items.length) {
        cursorRef.current = delta.last_id;
        setLogs((prev) => [...prev, ...delta.items]);
      }
      if (TERMINAL_RUN_STATUSES.includes(detail.status)) {
        terminalRef.current = detail.status;
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '轮询失败');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!runId) return;
    setRun(null);
    setLogs([]);
    cursorRef.current = 0;
    terminalRef.current = null;
    setLoading(true);
    void tick();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void tick();
    }, 2000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [runId, tick]);

  return { run, logs, loading, error, refresh: () => void tick() };
}
