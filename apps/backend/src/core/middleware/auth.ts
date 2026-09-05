import type { AuthUser } from "@torpreca/shared";
import { logEvent } from "../audit/log-event";
import { env } from "../config/env";
import { supabaseAdmin } from "../db/supabase";
import { type AccountStatusCode, AccountStatusError, UnauthorizedError } from "../errors/app-error";
import { clientIp } from "../http/client-ip";
import type { Middleware } from "../http/context";

const STATUS_CODES: Record<string, AccountStatusCode> = {
  pending: "PENDING_APPROVAL",
  rejected: "REJECTED",
  deactivated: "DEACTIVATED",
};

export const auth: Middleware = async (ctx, next) => {
  const header = ctx.req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new UnauthorizedError("Missing Authorization header");

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) throw new UnauthorizedError("Invalid token");

  const { data: existingRow, error: dbError } = await supabaseAdmin
    .from("users")
    .select("id, role, status")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();
  if (dbError) throw dbError;

  let userRow = existingRow;

  if (!userRow) {
    // Self-registered via POST /mobile/auth/register, but no `users` row
    // exists yet — that endpoint deliberately doesn't create one (see the
    // self-signup design doc). The row is created lazily right here, on the
    // first authenticated request, and only if the email is confirmed — an
    // account that never confirms its email never shows up in the admin's
    // approval queue at all.
    if (!authData.user.email_confirmed_at) {
      throw new UnauthorizedError("Email not confirmed");
    }

    const { data: created, error: createError } = await supabaseAdmin
      .rpc("create_user_encrypted", {
        p_auth_user_id: authData.user.id,
        p_name: (authData.user.user_metadata?.name as string | undefined) ?? authData.user.email,
        p_role: "driver",
        p_secret_key: env.SECRET_KEY,
        p_status: "pending",
      })
      .single();
    if (createError) throw createError;
    userRow = created as { id: string; role: string; status: string };
  }

  if (userRow.status !== "active") {
    const code = STATUS_CODES[userRow.status] ?? "DEACTIVATED";

    await logEvent({
      userId: userRow.id,
      role: userRow.role,
      action: "access.denied",
      entity: null,
      entityId: null,
      ip: clientIp(ctx),
      metadata: { path: new URL(ctx.req.url).pathname, reason: code },
    });
    throw new AccountStatusError(code);
  }

  ctx.user = userRow as AuthUser;
  return next();
};
