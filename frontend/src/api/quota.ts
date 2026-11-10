import { api } from './client';
import type { Quota } from '../types/api';

export function getQuota(): Promise<Quota> {
  return api.get<Quota>('/quota/me');
}
