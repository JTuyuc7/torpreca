import { CreateStopSchema } from "@torpreca/shared";
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

// `routeId` comes from the URL, not the client — validate the rest of the body separately.
const CreateStopBodySchema = CreateStopSchema.omit({ routeId: true });

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
      const input = { ...(ctx.body as object), routeId: ctx.params.routeId! } as never;
      const stop = await service.create(input);
      return Response.json(stop, { status: 201 });
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
