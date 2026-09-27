import { CreateStopBodySchema, ReorderStopsSchema, UpdateStopSchema } from "@torpreca/shared";
import { logEvent } from "../../core/audit/log-event";
import { clientIp } from "../../core/http/client-ip";
import type { Routable } from "../../core/http/router";
import { auth } from "../../core/middleware/auth";
import { rateLimitGeneral } from "../../core/middleware/rate-limit";
import { requireRole } from "../../core/middleware/role";
import { validateBody } from "../../core/middleware/validate-zod";
import { routesRepository } from "../routes/routes.repository";
import { stopsRepository } from "./stops.repository";
import { createStopsService } from "./stops.service";

const service = createStopsService(stopsRepository, routesRepository);

export function registerStopsRoutes(router: Routable) {
  router.get("/routes/:routeId/stops", auth, rateLimitGeneral, async (ctx) => {
    return Response.json(await service.listByRoute(ctx.params.routeId!, ctx.user!));
  });

  router.post(
    "/routes/:routeId/stops",
    auth,
    requireRole("admin", "supervisor", "super_admin"),
    rateLimitGeneral,
    validateBody(CreateStopBodySchema),
    async (ctx) => {
      const stop = await service.create(ctx.params.routeId!, ctx.body as never);
      return Response.json(stop, { status: 201 });
    },
  );

  router.patch(
    "/routes/:routeId/stops/order",
    auth,
    requireRole("admin", "supervisor", "super_admin"),
    rateLimitGeneral,
    validateBody(ReorderStopsSchema),
    async (ctx) => {
      return Response.json(await service.reorder(ctx.params.routeId!, ctx.body as never));
    },
  );

  router.patch(
    "/stops/:id",
    auth,
    requireRole("admin", "supervisor", "super_admin"),
    rateLimitGeneral,
    validateBody(UpdateStopSchema),
    async (ctx) => {
      return Response.json(await service.update(ctx.params.id!, ctx.body as never));
    },
  );

  router.delete(
    "/stops/:id",
    auth,
    requireRole("admin", "supervisor", "super_admin"),
    rateLimitGeneral,
    async (ctx) => {
      await service.remove(ctx.params.id!);
      return new Response(null, { status: 204 });
    },
  );

  router.patch(
    "/stops/:id/complete",
    auth,
    requireRole("driver"),
    rateLimitGeneral,
    async (ctx) => {
      const stop = await service.complete(ctx.params.id!, ctx.user!);

      await logEvent({
        userId: ctx.user!.id,
        role: ctx.user!.role,
        action: "stop.completed",
        entity: "stops",
        entityId: stop.id,
        ip: clientIp(ctx),
        metadata: null,
      });

      return Response.json(stop);
    },
  );

  router.patch("/stops/:id/delay", auth, requireRole("driver"), rateLimitGeneral, async (ctx) => {
    const stop = await service.delay(ctx.params.id!, ctx.user!);

    await logEvent({
      userId: ctx.user!.id,
      role: ctx.user!.role,
      action: "stop.delayed",
      entity: "stops",
      entityId: stop.id,
      ip: clientIp(ctx),
      metadata: null,
    });

    return Response.json(stop);
  });
}

// Mirrors modules/auth/mobile-auth.routes.ts: Flutter can't hold
// REQUEST_SIGNING_SECRET, so the driver app lists/updates a route's stops
// through these unsigned /mobile routes instead of /routes/:routeId/stops +
// /stops/:id/complete|delay, protected by JWT + role + rate limit only.
export function registerMobileStopsRoutes(router: Routable) {
  router.get(
    "/mobile/routes/:routeId/stops",
    auth,
    requireRole("driver"),
    rateLimitGeneral,
    async (ctx) => {
      return Response.json(await service.listByRoute(ctx.params.routeId!, ctx.user!));
    },
  );

  router.patch(
    "/mobile/stops/:id/complete",
    auth,
    requireRole("driver"),
    rateLimitGeneral,
    async (ctx) => {
      const stop = await service.complete(ctx.params.id!, ctx.user!);

      await logEvent({
        userId: ctx.user!.id,
        role: ctx.user!.role,
        action: "stop.completed",
        entity: "stops",
        entityId: stop.id,
        ip: clientIp(ctx),
        metadata: null,
      });

      return Response.json(stop);
    },
  );

  router.patch(
    "/mobile/stops/:id/delay",
    auth,
    requireRole("driver"),
    rateLimitGeneral,
    async (ctx) => {
      const stop = await service.delay(ctx.params.id!, ctx.user!);

      await logEvent({
        userId: ctx.user!.id,
        role: ctx.user!.role,
        action: "stop.delayed",
        entity: "stops",
        entityId: stop.id,
        ip: clientIp(ctx),
        metadata: null,
      });

      return Response.json(stop);
    },
  );
}
