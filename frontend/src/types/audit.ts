export interface AuditLog {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  payload_json: Record<string, unknown>;
  ip: string | null;
  result: string;
  created_at: string;
  actor_name?: string | null;
}
