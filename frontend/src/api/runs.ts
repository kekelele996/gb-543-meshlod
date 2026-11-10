import { api } from './client';
import type { ListResponse } from '../types/api';
import type { PipelineRun, RunLog } from '../types/run';
import type { LodLevel } from '../types/lodLevel';

export function listRuns(status?: string): Promise<ListResponse<PipelineRun>> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
  return api.get<ListResponse<PipelineRun>>(`/runs${suffix}`);
}

export function getRun(id: string): Promise<PipelineRun> {
  return api.get<PipelineRun>(`/runs/${id}`);
}

export function createRun(meshId: string, pipelineId: string): Promise<PipelineRun> {
  return api.post<PipelineRun>('/runs', { mesh_id: meshId, pipeline_id: pipelineId });
}

export function cancelRun(id: string): Promise<PipelineRun> {
  return api.post<PipelineRun>(`/runs/${id}/cancel`);
}

export function retryRun(id: string): Promise<PipelineRun> {
  return api.post<PipelineRun>(`/runs/${id}/retry`);
}

export function getLogs(id: string, afterId = 0): Promise<{ items: RunLog[]; last_id: number }> {
  return api.get(`/runs/${id}/logs?after_id=${afterId}`);
}

export function runStatsUrl(id: string): string {
  return `/api/runs/${id}/stats.json`;
}

export function levelsByRun(runId: string): Promise<{ items: LodLevel[]; base_triangle_count: number }> {
  return api.get(`/levels/run/${runId}`);
}
