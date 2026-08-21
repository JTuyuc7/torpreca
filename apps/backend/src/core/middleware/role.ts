import type { Role } from "@torpreca/shared";
import { ForbiddenError } from "../errors/app-error";
import type { Middleware } from "../http/context";

export function requireRole(...roles: Role[]): Middleware {
  return async (ctx, next) => {
    if (!ctx.user || !roles.includes(ctx.user.role)) {
      throw new ForbiddenError();
    }
    return next();
  };
}