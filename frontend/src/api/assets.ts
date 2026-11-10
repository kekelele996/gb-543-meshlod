import { api, apiUrl, readToken } from './client';
import type { AssetUploadResponse, ListResponse } from '../types/api';
import type { MeshAsset } from '../types/meshAsset';
import type { AuditLog } from '../types/audit';
import type { PipelineRun } from '../types/run';

export function listAssets(params: { sort?: string; order?: string; status?: string } = {}): Promise<
  ListResponse<MeshAsset>
> {
  const query = new URLSearchParams();
  if (params.sort) query.set('sort', params.sort);
  if (params.order) query.set('order', params.order);
  if (params.status) query.set('status', params.status);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return api.get<ListResponse<MeshAsset>>(`/assets${suffix}`);
}

export function getAsset(id: string): Promise<MeshAsset> {
  return api.get<MeshAsset>(`/assets/${id}`);
}

export function uploadAsset(file: File, onProgress?: (percent: number) => void): Promise<AssetUploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl('/assets'));
    const token = readToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        const payload = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        if (xhr.status >= 200 && xhr.status < 300) resolve(payload as AssetUploadResponse);
        else reject(Object.assign(new Error(payload.message ?? '上传失败'), payload));
      } catch (error) {
        reject(error);
      }
    };
    xhr.onerror = () => reject(new Error('上传中断，请检查网络或文件大小'));
    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
}

export function createSampleAsset(): Promise<{ asset: MeshAsset }> {
  return api.post<{ asset: MeshAsset }>('/assets/sample');
}

export function deleteAsset(id: string): Promise<{ message: string }> {
  return api.delete(`/assets/${id}`);
}

export function assetRuns(id: string): Promise<ListResponse<PipelineRun>> {
  return api.get<ListResponse<PipelineRun>>(`/assets/${id}/runs`);
}

export function assetAudit(id: string): Promise<ListResponse<AuditLog>> {
  return api.get<ListResponse<AuditLog>>(`/assets/${id}/audit`);
}

export function assetFileUrl(id: string): string {
  return apiUrl(`/assets/${id}/file`);
}

export function assetThumbUrl(id: string): string {
  return apiUrl(`/assets/${id}/thumbnail`);
}
