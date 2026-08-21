import type { AuthUser } from "@torpreca/shared";
import { logEvent } from "../audit/log-event";
import { supabaseAdmin } from "../db/supabase";
import { ForbiddenError, UnauthorizedError } from "../errors/app-error";
import { clientIp } from "../http/client-ip";
import type { Middleware } from "../http/context";

export const auth: Middleware = async (ctx, next) => {
  const header = ctx.req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new UnauthorizedError("Missing Authorization header");

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) throw new UnauthorizedError("Invalid token");

  const { data: userRow, error: dbError } = await supabaseAdmin
    .from("users")
    .select("id, role, active")
    .eq("auth_user_id", authData.user.id)
    .single();

  if (dbError || !userRow) throw new UnauthorizedError("User not registered");

  if (!userRow.active) {
    await logEvent({
      userId: userRow.id,
      role: userRow.role,
      action: "access.denied",
      entity: null,
      entityId: null,
      ip: clientIp(ctx),
      metadata: { path: new URL(ctx.req.url).pathname, reason: "user_deactivated" },
    });
    throw new ForbiddenError("User deactivated");
  }

  ctx.user = userRow as AuthUser;
  return next();
};