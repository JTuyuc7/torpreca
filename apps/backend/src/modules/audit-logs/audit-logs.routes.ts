import type { Routable } from "../../core/http/router";
import { auth } from "../../core/middleware/auth";
import { rateLimitGeneral } from "../../core/middleware/rate-limit";
import { requireRole } from "../../core/middleware/role";
import { auditLogsRepository } from "./audit-logs.repository";

// Dashboard-only, signed, super_admin-only (CLAUDE.md: "Pantalla de logs
// solo renderiza si rol === 'super_admin'") — no /mobile counterpart, no
// service layer: there's no logic beyond the role gate itself, which the
// middleware already handles.
export function registerAuditLogsRoutes(router: Routable) {
  router.get("/audit-logs", auth, requireRole("super_admin"), rateLimitGeneral, async (_ctx) => {
    return Response.json(await auditLogsRepository.list());
  });
}
