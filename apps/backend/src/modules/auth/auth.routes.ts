import { LoginFailedSchema } from "@torpreca/shared";
import { logEvent } from "../../core/audit/log-event";
import { clientIp } from "../../core/http/client-ip";
import type { Routable } from "../../core/http/router";
import { auth } from "../../core/middleware/auth";
import { rateLimitAuth, rateLimitGeneral } from "../../core/middleware/rate-limit";
import { requireRole } from "../../core/middleware/role";
import { validateBody } from "../../core/middleware/validate-zod";

// No auth-repository / auth-service here on purpose: this module never
// authenticates anyone — Supabase Auth does that client-side with the anon
// key. These endpoints only (a) confirm a just-issued token belongs to a
// dashboard-eligible role (reusing the existing `auth` + `requireRole`
// middlewares) and (b) write the corresponding audit_logs row, since the
// browser only holds the anon key and can't write there directly.
export function registerAuthRoutes(router: Routable) {
  router.post(
    "/auth/session",
    auth,
    requireRole("supervisor", "admin", "super_admin"),
    rateLimitGeneral,
    async (ctx) => {
      await logEvent({
        userId: ctx.user!.id,
        role: ctx.user!.role,
        action: "auth.login",
        entity: null,
        entityId: null,
        ip: clientIp(ctx),
        metadata: null,
      });

      return Response.json(ctx.user);
    },
  );

  router.post("/auth/logout", auth, rateLimitGeneral, async (ctx) => {
    await logEvent({
      userId: ctx.user!.id,
      role: ctx.user!.role,
      action: "auth.logout",
      entity: null,
      entityId: null,
      ip: clientIp(ctx),
      metadata: null,
    });

    return new Response(null, { status: 204 });
  });

  router.post("/auth/login-failed", rateLimitAuth, validateBody(LoginFailedSchema), async (ctx) => {
    const { email } = ctx.body as { email: string };

    await logEvent({
      userId: null,
      role: null,
      action: "auth.login_failed",
      entity: null,
      entityId: null,
      ip: clientIp(ctx),
      metadata: { email, reason: "invalid_credentials" },
    });

    return new Response(null, { status: 204 });
  });
}
