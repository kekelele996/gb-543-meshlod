/** api 层统一入口：注入 Authorization、统一错误、401 跳登录。 */
import { request, RequestError, apiUrl, readToken } from '../utils/request';

export { RequestError, apiUrl, readToken };

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path);
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'POST', body });
  },
  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'PUT', body });
  },
  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' });
  },
  upload<T>(path: string, formData: FormData): Promise<T> {
    return request<T>(path, { method: 'POST', formData });
  },
};
