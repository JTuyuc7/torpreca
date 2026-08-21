import { CreateUserSchema } from "@torpreca/shared";
import { logEvent } from "../../core/audit/log-event";
import { auth } from "../../core/middleware/auth";
import { rateLimitGeneral } from "../../core/middleware/rate-limit";
import { requireRole } from "../../core/middleware/role";
import { validateBody } from "../../core/middleware/validate-zod";
import { clientIp } from "../../core/http/client-ip";
import type { Router } from "../../core/http/router";
import { usersRepository } from "./users.repository";
import { createUsersService } from "./users.service";

const service = createUsersService(usersRepository);

export function registerUsersRoutes(router: Router) {
  router.get(
    "/users",
    auth,
    requireRole("admin", "supervisor", "super_admin"),
    rateLimitGeneral,
    async (ctx) => {
      const onlyActive = !ctx.req.url.includes("all=true");
      return Response.json(await service.list(onlyActive));
    },
  );

  router.get(
    "/users/:id",
    auth,
    requireRole("admin", "supervisor", "super_admin"),
    rateLimitGeneral,
    async (ctx) => {
      return Response.json(await service.getById(ctx.params.id!));
    },
  );

  router.post(
    "/users",
    auth,
    requireRole("admin", "super_admin"),
    rateLimitGeneral,
    validateBody(CreateUserSchema),
    async (ctx) => {
      const user = await service.create(ctx.body as never);

      await logEvent({
        userId: ctx.user!.id,
        role: ctx.user!.role,
        action: "user.created",
        entity: "users",
        entityId: user.id,
        ip: clientIp(ctx),
        metadata: null,
      });

      return Response.json(user, { status: 201 });
    },
  );

  router.delete(
    "/users/:id",
    auth,
    requireRole("admin", "super_admin"),
    rateLimitGeneral,
    async (ctx) => {
      await service.deactivate(ctx.params.id!, ctx.user!.id);

      await logEvent({
        userId: ctx.user!.id,
        role: ctx.user!.role,
        action: "user.deactivated",
        entity: "users",
        entityId: ctx.params.id!,
        ip: clientIp(ctx),
        metadata: null,
      });

      return new Response(null, { status: 204 });
    },
  );
}