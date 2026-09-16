import type { AuditLog } from "@torpreca/shared";
import { supabaseAdmin } from "../../core/db/supabase";

function toAuditLog(row: Record<string, unknown>): AuditLog {
  return {
    id: row.id as string,
    userId: row.user_id as string | null,
    role: row.role as string | null,
    action: row.action as AuditLog["action"],
    entity: row.entity as string | null,
    entityId: row.entity_id as string | null,
    ip: row.ip as string | null,
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface AuditLogsRepository {
  list(): Promise<AuditLog[]>;
}

// No filter params here — same call as locations.repository.ts's
// listLatestPerDriver(): fetch everything, newest first, and let the
// dashboard filter by event/user/date client-side (same idiom the rest of
// the dashboard already uses for routes/vehicles). Fine at MVP scale; if
// audit_logs grows large enough for this to matter, add a bounded
// date-range query here without changing the interface.
export const auditLogsRepository: AuditLogsRepository = {
  async list() {
    const { data, error } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toAuditLog);
  },
};
