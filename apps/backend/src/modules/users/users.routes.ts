import { CreateUserSchema, ReviewUserSchema, USER_STATUSES } from "@torpreca/shared";
import { logEvent } from "../../core/audit/log-event";
import { clientIp } from "../../core/http/client-ip";
import type { Routable } from "../../core/http/router";
import { auth } from "../../core/middleware/auth";
import { rateLimitGeneral } from "../../core/middleware/rate-limit";
import { requireRole } from "../../core/middleware/role";
import { validateBody } from "../../core/middleware/validate-zod";
import { usersRepository } from "./users.repository";
import { createUsersService } from "./users.service";

const service = createUsersService(usersRepository);

export function registerUsersRoutes(router: Routable) {
  router.get(
    "/users",
    auth,
    requireRole("admin", "supervisor", "super_admin"),
    rateLimitGeneral,
    async (ctx) => {
      // ?status=pending powers the dashboard's approval queue; ?status=all
      // (or the legacy ?all=true) lifts the default active-only filter.
      const url = new URL(ctx.req.url);
      const statusParam = url.searchParams.get("status");
      const status =
        statusParam && (USER_STATUSES as readonly string[]).includes(statusParam)
          ? (statusParam as (typeof USER_STATUSES)[number])
          : statusParam === "all" || url.searchParams.get("all") === "true"
            ? "all"
            : undefined;

      return Response.json(await service.list(status));
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

  router.patch(
    "/users/:id/review",
    auth,
    requireRole("admin", "supervisor", "super_admin"),
    rateLimitGeneral,
    validateBody(ReviewUserSchema),
    async (ctx) => {
      const { decision } = ctx.body as { decision: "approve" | "reject" };
      const user = await service.review(ctx.params.id!, decision, ctx.user!.id);

      await logEvent({
        userId: ctx.user!.id,
        role: ctx.user!.role,
        action: decision === "approve" ? "user.approved" : "user.rejected",
        entity: "users",
        entityId: user.id,
        ip: clientIp(ctx),
        metadata: null,
      });

      return Response.json(user);
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
