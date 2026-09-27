import { AUDIT_EVENTS, type AuditEvent } from "@torpreca/shared";
import type { Routable } from "../../core/http/router";
import { auth } from "../../core/middleware/auth";
import { rateLimitGeneral } from "../../core/middleware/rate-limit";
import { requireRole } from "../../core/middleware/role";
import { auditLogsRepository } from "./audit-logs.repository";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function isAuditEvent(value: string | null): value is AuditEvent {
  return value !== null && (AUDIT_EVENTS as readonly string[]).includes(value);
}

function parseIntWithMin(value: string | null, fallback: number, min: number): number {
  const parsed = Number(value);
  return value !== null && Number.isInteger(parsed) && parsed >= min ? parsed : fallback;
}

// Dashboard-only, signed, super_admin-only (CLAUDE.md: "Pantalla de logs
// solo renderiza si rol === 'super_admin'") — no /mobile counterpart, no
// service layer: there's no logic beyond the role gate and query-param
// parsing here, which don't need their own layer.
export function registerAuditLogsRoutes(router: Routable) {
  router.get("/audit-logs", auth, requireRole("super_admin"), rateLimitGeneral, async (ctx) => {
    const params = new URL(ctx.req.url).searchParams;
    const actionParam = params.get("action");
    const limit = Math.min(parseIntWithMin(params.get("limit"), DEFAULT_LIMIT, 1), MAX_LIMIT);

    const page = await auditLogsRepository.list({
      action: isAuditEvent(actionParam) ? actionParam : undefined,
      userId: params.get("userId") ?? undefined,
      date: params.get("date") ?? undefined,
      limit,
      offset: parseIntWithMin(params.get("offset"), 0, 0),
    });

    return Response.json(page);
  });
}
