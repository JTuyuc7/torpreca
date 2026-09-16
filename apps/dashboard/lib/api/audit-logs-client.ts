import type { AuditLog } from "@torpreca/shared";

// Browser-side call to this app's own /api/audit-logs BFF route handler —
// same centralization pattern as lib/api/users-client.ts.

export type AuditLogsResult = { ok: true; logs: AuditLog[] } | { ok: false; status: number };

export async function listAuditLogs(accessToken: string): Promise<AuditLogsResult> {
  try {
    const res = await fetch("/api/audit-logs", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const logs = (await res.json()) as AuditLog[];
    return { ok: true, logs };
  } catch {
    return { ok: false, status: 0 };
  }
}
