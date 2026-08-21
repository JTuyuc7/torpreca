import { CreateRouteSchema, FinishRouteSchema } from "@torpreca/shared";
import { logEvent } from "../../core/audit/log-event";
import { auth } from "../../core/middleware/auth";
import { rateLimitGeneral } from "../../core/middleware/rate-limit";
import { requireRole } from "../../core/middleware/role";
import { validateBody } from "../../core/middleware/validate-zod";
import { clientIp } from "../../core/http/client-ip";
import type { Router } from "../../core/http/router";
import { routesRepository } from "./routes.repository";
import { createRoutesService } from "./routes.service";

const service = createRoutesService(routesRepository);

export function registerRoutesRoutes(router: Router) {
  router.get("/routes", auth, rateLimitGeneral, async (ctx) => {
    const date = new URL(ctx.req.url).searchParams.get("date") ?? undefined;
    return Response.json(await service.list(ctx.user!, date));
  });

  router.get("/routes/:id", auth, rateLimitGeneral, async (ctx) => {
    return Response.json(await service.getById(ctx.params.id!, ctx.user!));
  });

  router.post(
    "/routes",
    auth,
    requireRole("admin", "supervisor", "super_admin"),
    rateLimitGeneral,
    validateBody(CreateRouteSchema),
    async (ctx) => {
      const route = await service.create(ctx.body as never, ctx.user!.id);

      await logEvent({
        userId: ctx.user!.id,
        role: ctx.user!.role,
        action: "route.created",
        entity: "routes",
        entityId: route.id,
        ip: clientIp(ctx),
        metadata: null,
      });

      return Response.json(route, { status: 201 });
    },
  );

  router.patch(
    "/routes/:id/start",
    auth,
    requireRole("driver"),
    rateLimitGeneral,
    async (ctx) => {
      const route = await service.start(ctx.params.id!, ctx.user!.id);

      await logEvent({
        userId: ctx.user!.id,
        role: ctx.user!.role,
        action: "route.started",
        entity: "routes",
        entityId: route.id,
        ip: clientIp(ctx),
        metadata: null,
      });

      return Response.json(route);
    },
  );

  router.patch(
    "/routes/:id/finish",
    auth,
    requireRole("driver"),
    rateLimitGeneral,
    validateBody(FinishRouteSchema),
    async (ctx) => {
      const { drivenKm } = ctx.body as { drivenKm: number };
      const route = await service.finish(ctx.params.id!, ctx.user!.id, drivenKm);

      await logEvent({
        userId: ctx.user!.id,
        role: ctx.user!.role,
        action: "route.finished",
        entity: "routes",
        entityId: route.id,
        ip: clientIp(ctx),
        metadata: null,
      });

      return Response.json(route);
    },
  );
}