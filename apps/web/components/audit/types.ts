export interface AuditEntry {
  id: number;
  ts: string;
  actor_user_id: string | null;
  actor_agent: string;
  event_type: string;
  payload: Record<string, unknown> | null;
}
