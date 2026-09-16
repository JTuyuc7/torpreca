import type { AuditEvent, AuditLogsPage } from "@torpreca/shared";

// Browser-side call to this app's own /api/audit-logs BFF route handler —
// same centralization pattern as lib/api/users-client.ts.

export type AuditLogsFilter = {
  action?: AuditEvent;
  userId?: string;
  date?: string;
  limit: number;
  offset: number;
};

export type AuditLogsResult = { ok: true; page: AuditLogsPage } | { ok: false; status: number };

export async function listAuditLogs(
  accessToken: string,
  filter: AuditLogsFilter,
): Promise<AuditLogsResult> {
  try {
    const params = new URLSearchParams();
    if (filter.action) params.set("action", filter.action);
    if (filter.userId) params.set("userId", filter.userId);
    if (filter.date) params.set("date", filter.date);
    params.set("limit", String(filter.limit));
    params.set("offset", String(filter.offset));

    const res = await fetch(`/api/audit-logs?${params.toString()}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const page = (await res.json()) as AuditLogsPage;
    return { ok: true, page };
  } catch {
    return { ok: false, status: 0 };
  }
}
