/** 低层 fetch 封装：统一错误信封、token 注入、401 统一跳登录。 */
import type { ApiError } from '../types/api';

const API_BASE = '/api';
const STORAGE_KEY = 'meshlod-auth';

export class RequestError extends Error {
  code: string;
  status: number;
  field?: string | null;
  entity?: string | null;

  constructor(status: number, body: Partial<ApiError> & { message?: string }) {
    super(body.message ?? `请求失败 (${status})`);
    this.status = status;
    this.code = body.code ?? `HTTP_${status}`;
    this.field = body.field ?? null;
    this.entity = body.entity ?? null;
  }
}

let unauthorizedHandler: (() => void) | null = null;
export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

export function readToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

export function apiUrl(path: string): string {
  return path.startsWith('/api') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  formData?: FormData;
  raw?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = readToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  const response = await fetch(apiUrl(path), {
    method: options.method ?? 'GET',
    headers,
    body,
    signal: options.signal,
  });
  if (response.status === 401) {
    unauthorizedHandler?.();
  }
  if (options.raw) {
    if (!response.ok) {
      let parsed: Partial<ApiError> = {};
      try {
        parsed = await response.json();
      } catch {
        /* ignore */
      }
      throw new RequestError(response.status, parsed);
    }
    return response as unknown as T;
  }
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new RequestError(response.status, payload as Partial<ApiError>);
  }
  return payload as T;
}
