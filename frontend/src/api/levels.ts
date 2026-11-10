import { apiUrl, readToken } from './client';

export function levelDownloadUrl(levelId: string): string {
  return apiUrl(`/levels/${levelId}/download`);
}

export async function fetchLevelBlob(levelId: string): Promise<ArrayBuffer> {
  const token = readToken();
  const response = await fetch(levelDownloadUrl(levelId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`下载 LOD 失败 (${response.status})`);
  return response.arrayBuffer();
}

export async function downloadLevelFile(levelId: string, filename: string): Promise<void> {
  const buffer = await fetchLevelBlob(levelId);
  const blob = new Blob([buffer], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
