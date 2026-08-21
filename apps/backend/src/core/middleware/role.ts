import type { Role } from "@torpreca/shared";
import { logEvent } from "../audit/log-event";
import { ForbiddenError } from "../errors/app-error";
import { clientIp } from "../http/client-ip";
import type { Middleware } from "../http/context";

export function requireRole(...roles: Role[]): Middleware {
  return async (ctx, next) => {
    if (!ctx.user || !roles.includes(ctx.user.role)) {
      await logEvent({
        userId: ctx.user?.id ?? null,
        role: ctx.user?.role ?? null,
        action: "access.denied",
        entity: null,
        entityId: null,
        ip: clientIp(ctx),
        metadata: { path: new URL(ctx.req.url).pathname, requiredRoles: roles },
      });
      throw new ForbiddenError();
    }
    return next();
  };
}