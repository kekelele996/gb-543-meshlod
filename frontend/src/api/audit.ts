import { api } from './client';
import type { ListResponse } from '../types/api';
import type { AuditLog } from '../types/audit';

export function listAudit(entityType: string, entityId: string): Promise<ListResponse<AuditLog>> {
  return api.get<ListResponse<AuditLog>>(
    `/audit?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`,
  );
}
