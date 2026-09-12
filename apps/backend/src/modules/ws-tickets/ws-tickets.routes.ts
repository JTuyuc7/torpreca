import type { Routable } from "../../core/http/router";
import { auth } from "../../core/middleware/auth";
import { rateLimitGeneral } from "../../core/middleware/rate-limit";
import { requireRole } from "../../core/middleware/role";
import { mintTicket } from "../../core/ws/ticket-store";

// No repository/service here on purpose — this is in-memory only, nothing
// to persist. Mounted under /api/v1 like every other module, so it's covered
// by the same HMAC signing + auth as any other authenticated write.
export function registerWsTicketsRoutes(router: Routable) {
  router.post("/ws-tickets", auth, rateLimitGeneral, async (ctx) => {
    return Response.json(mintTicket(ctx.user!));
  });
}

// Mirrors modules/auth/mobile-auth.routes.ts: Flutter can't hold
// REQUEST_SIGNING_SECRET, so the driver app mints its WS ticket through this
// unsigned /mobile route instead of /ws-tickets, protected by JWT + role +
// rate limit only.
export function registerMobileWsTicketsRoutes(router: Routable) {
  router.post("/mobile/ws-tickets", auth, requireRole("driver"), rateLimitGeneral, async (ctx) => {
    return Response.json(mintTicket(ctx.user!));
  });
}
