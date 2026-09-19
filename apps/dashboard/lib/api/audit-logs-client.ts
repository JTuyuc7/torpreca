import type { AuditEvent, AuditLogsPage } from "@torpreca/shared";

// Browser-side call to this app's own /api/audit-logs BFF route handler —
// same centralization pattern as lib/api/users-client.ts. TOR-124: no access
// token is passed in anymore — the session lives in an httpOnly cookie
// same-origin fetch() sends automatically, and the route handler resolves it
// server-side.

export type AuditLogsFilter = {
  action?: AuditEvent;
  userId?: string;
  date?: string;
  limit: number;
  offset: number;
};

export type AuditLogsResult = { ok: true; page: AuditLogsPage } | { ok: false; status: number };

export async function listAuditLogs(filter: AuditLogsFilter): Promise<AuditLogsResult> {
  try {
    const params = new URLSearchParams();
    if (filter.action) params.set("action", filter.action);
    if (filter.userId) params.set("userId", filter.userId);
    if (filter.date) params.set("date", filter.date);
    params.set("limit", String(filter.limit));
    params.set("offset", String(filter.offset));

    const res = await fetch(`/api/audit-logs?${params.toString()}`);
    if (!res.ok) return { ok: false, status: res.status };
    const page = (await res.json()) as AuditLogsPage;
    return { ok: true, page };
  } catch {
    return { ok: false, status: 0 };
  }
}
