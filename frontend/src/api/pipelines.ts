import { api } from './client';
import type { ListResponse } from '../types/api';
import type { PipelineInput, ProcessPipeline } from '../types/pipeline';

export function listPipelines(templatesOnly = false): Promise<ListResponse<ProcessPipeline>> {
  const suffix = templatesOnly ? '?templates_only=true' : '';
  return api.get<ListResponse<ProcessPipeline>>(`/pipelines${suffix}`);
}

export function getPipeline(id: string): Promise<ProcessPipeline> {
  return api.get<ProcessPipeline>(`/pipelines/${id}`);
}

export function createPipeline(payload: PipelineInput): Promise<{ pipeline: ProcessPipeline; message: string }> {
  return api.post('/pipelines', payload);
}

export function updatePipeline(
  id: string,
  payload: PipelineInput,
): Promise<{ pipeline: ProcessPipeline; message: string }> {
  return api.put(`/pipelines/${id}`, payload);
}
