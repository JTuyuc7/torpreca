import { LoginFailedSchema, RegisterSchema } from "@torpreca/shared";
import { logEvent } from "../../core/audit/log-event";
import { env } from "../../core/config/env";
import { supabaseAdmin } from "../../core/db/supabase";
import { AppError } from "../../core/errors/app-error";
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
  // Public — no `auth` middleware, nobody has a token yet. See the
  // self-signup design doc for the full flow. Doesn't touch `public.users`
  // at all: the row is created lazily, `status = 'pending'`, the first time
  // this account makes an authenticated request with a confirmed email (see
  // core/middleware/auth.ts) — so an email that's never confirmed never
  // shows up in the admin's approval queue.
  router.post("/mobile/auth/register", rateLimitAuth, validateBody(RegisterSchema), async (ctx) => {
    const { email, password, name, signupCode } = ctx.body as {
      email: string;
      password: string;
      name: string;
      signupCode: string;
    };

    // Same generic failure for a bad code or an already-registered email —
    // don't give an attacker a way to tell which one it was.
    if (signupCode !== env.SIGNUP_CODE) {
      throw new AppError(400, "Invalid registration details");
    }

    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { name },
    });
    if (createError) {
      throw new AppError(400, "Invalid registration details");
    }

    // auth.admin.createUser() doesn't send a confirmation email on its own
    // the way client-side signUp() does — resend triggers Supabase's own
    // native confirmation email using the project's configured sender.
    await supabaseAdmin.auth.resend({ type: "signup", email });

    await logEvent({
      userId: null,
      role: null,
      action: "auth.registered",
      entity: null,
      entityId: null,
      ip: clientIp(ctx),
      metadata: { email },
    });

    return new Response(null, { status: 204 });
  });

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
