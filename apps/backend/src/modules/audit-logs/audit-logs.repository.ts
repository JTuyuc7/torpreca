import type { AuditEvent, AuditLog } from "@torpreca/shared";
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

export interface AuditLogFilter {
  action?: AuditEvent;
  userId?: string;
  /** yyyy-mm-dd — matches rows created on that calendar day (UTC). */
  date?: string;
  limit: number;
  offset: number;
}

export interface AuditLogsPage {
  logs: AuditLog[];
  /** Every row matching the filters, not just this page — for "page X of Y". */
  total: number;
}

export interface AuditLogsRepository {
  list(filter: AuditLogFilter): Promise<AuditLogsPage>;
}

// TOR-135: filters + limit/offset live here (not client-side) so the
// dashboard's Logs screen never has to pull the whole table just to show
// 20-30 rows — the opposite of locations.repository.ts's
// listLatestPerDriver(), which fetches everything on purpose because that
// table has no per-request filter to narrow it by.
export const auditLogsRepository: AuditLogsRepository = {
  async list(filter) {
    let query = supabaseAdmin
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (filter.action) query = query.eq("action", filter.action);
    if (filter.userId) query = query.eq("user_id", filter.userId);
    if (filter.date) {
      const start = `${filter.date}T00:00:00.000Z`;
      const end = new Date(new Date(start).getTime() + 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", start).lt("created_at", end);
    }

    const { data, error, count } = await query.range(
      filter.offset,
      filter.offset + filter.limit - 1,
    );
    if (error) throw error;
    return { logs: data.map(toAuditLog), total: count ?? data.length };
  },
};
