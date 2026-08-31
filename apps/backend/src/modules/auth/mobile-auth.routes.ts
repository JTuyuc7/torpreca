import { LoginFailedSchema } from "@torpreca/shared";
import { logEvent } from "../../core/audit/log-event";
import { clientIp } from "../../core/http/client-ip";
import type { Routable } from "../../core/http/router";
import { auth } from "../../core/middleware/auth";
import { rateLimitAuth, rateLimitGeneral } from "../../core/middleware/rate-limit";
import { requireRole } from "../../core/middleware/role";
import { validateBody } from "../../core/middleware/validate-zod";

// Mirrors auth.routes.ts, but for the Flutter driver app instead of the
// dashboard BFF. Mobile can't hold REQUEST_SIGNING_SECRET safely (it would
// ship inside the APK), so these routes live under /mobile and are excluded
// from requestSigning (core/middleware/request-signing.ts) instead of being
// HMAC-verified. Real authentication is still 100% Supabase Auth
// (supabase_flutter signInWithPassword) — these endpoints only confirm the
// token belongs to a driver and write the audit_logs row the client can't.
export function registerMobileAuthRoutes(router: Routable) {
  router.post(
    "/mobile/auth/session",
    auth,
    requireRole("driver"),
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

  router.post("/mobile/auth/logout", auth, rateLimitGeneral, async (ctx) => {
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

  router.post(
    "/mobile/auth/login-failed",
    rateLimitAuth,
    validateBody(LoginFailedSchema),
    async (ctx) => {
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
    },
  );
}
