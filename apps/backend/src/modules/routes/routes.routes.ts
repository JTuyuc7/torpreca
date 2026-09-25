import { CreateRouteSchema, FinishRouteSchema, UpdateRouteSchema } from "@torpreca/shared";
import { logEvent } from "../../core/audit/log-event";
import { clientIp } from "../../core/http/client-ip";
import type { Context } from "../../core/http/context";
import type { Routable } from "../../core/http/router";
import { auth } from "../../core/middleware/auth";
import { rateLimitGeneral } from "../../core/middleware/rate-limit";
import { requireRole } from "../../core/middleware/role";
import { validateBody } from "../../core/middleware/validate-zod";
import { dailyReportsRepository } from "../daily-reports/daily-reports.repository";
import { createDailyReportsService } from "../daily-reports/daily-reports.service";
import { drivenKmFromPings } from "../locations/driven-distance";
import { locationsRepository } from "../locations/locations.repository";
import { stopsRepository } from "../stops/stops.repository";
import { routesRepository } from "./routes.repository";
import { createRoutesService } from "./routes.service";

const service = createRoutesService(routesRepository);
// routesService deliberately doesn't know about daily-reports (same reason
// it doesn't call logEvent itself) — each place a route can finish
// (this handler, sync-queue.service.ts's route.finished case) triggers its
// own regeneration after the fact.
const dailyReportsService = createDailyReportsService(
  dailyReportsRepository,
  routesRepository,
  stopsRepository,
);

// Shared by the signed dashboard-style endpoints and the unsigned /mobile
// ones (TOR-138): same state transition, same audit event, same daily report.
async function startRoute(ctx: Context, routeId: string) {
  const route = await service.start(routeId, ctx.user!.id);

  await logEvent({
    userId: ctx.user!.id,
    role: ctx.user!.role,
    action: "route.started",
    entity: "routes",
    entityId: route.id,
    ip: clientIp(ctx),
    metadata: null,
  });

  return route;
}

async function finishRoute(ctx: Context, routeId: string, drivenKm: number) {
  const route = await service.finish(routeId, ctx.user!.id, drivenKm);

  await logEvent({
    userId: ctx.user!.id,
    role: ctx.user!.role,
    action: "route.finished",
    entity: "routes",
    entityId: route.id,
    ip: clientIp(ctx),
    metadata: null,
  });

  await dailyReportsService.generateForDriverDate(route.driverId, route.date);

  return route;
}

export function registerRoutesRoutes(router: Routable) {
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
    "/routes/:id",
    auth,
    requireRole("admin", "supervisor", "super_admin"),
    rateLimitGeneral,
    validateBody(UpdateRouteSchema),
    async (ctx) => {
      const route = await service.update(ctx.params.id!, ctx.body as never);

      await logEvent({
        userId: ctx.user!.id,
        role: ctx.user!.role,
        action: "route.updated",
        entity: "routes",
        entityId: route.id,
        ip: clientIp(ctx),
        metadata: null,
      });

      return Response.json(route);
    },
  );

  router.patch("/routes/:id/start", auth, requireRole("driver"), rateLimitGeneral, async (ctx) => {
    return Response.json(await startRoute(ctx, ctx.params.id!));
  });

  router.patch(
    "/routes/:id/finish",
    auth,
    requireRole("driver"),
    rateLimitGeneral,
    validateBody(FinishRouteSchema),
    async (ctx) => {
      const { drivenKm } = ctx.body as { drivenKm: number };
      return Response.json(await finishRoute(ctx, ctx.params.id!, drivenKm));
    },
  );
}

// Mirrors modules/auth/mobile-auth.routes.ts: Flutter can't hold
// REQUEST_SIGNING_SECRET, so the driver app reads its own routes through
// these unsigned /mobile routes instead of /routes, protected by JWT + role +
// rate limit only. Creating/editing a route stays dashboard-only and signed;
// the driver can only start and finish their own (TOR-138).
export function registerMobileRoutesRoutes(router: Routable) {
  router.get("/mobile/routes", auth, requireRole("driver"), rateLimitGeneral, async (ctx) => {
    const date = new URL(ctx.req.url).searchParams.get("date") ?? undefined;
    return Response.json(await service.list(ctx.user!, date));
  });

  router.get("/mobile/routes/:id", auth, requireRole("driver"), rateLimitGeneral, async (ctx) => {
    return Response.json(await service.getById(ctx.params.id!, ctx.user!));
  });

  router.patch(
    "/mobile/routes/:id/start",
    auth,
    requireRole("driver"),
    rateLimitGeneral,
    async (ctx) => {
      return Response.json(await startRoute(ctx, ctx.params.id!));
    },
  );

  // Unlike the signed finish, the app doesn't send the kilometers: they're
  // measured from the driver's GPS pings between the route's start and now.
  // (Pings still queued offline on the phone aren't counted — the trade-off
  // of not making the driver type the number in.) Ownership/state errors
  // (403/404/409) come from service.getById/finish before anything is written.
  router.patch(
    "/mobile/routes/:id/finish",
    auth,
    requireRole("driver"),
    rateLimitGeneral,
    async (ctx) => {
      const route = await service.getById(ctx.params.id!, ctx.user!);
      const drivenKm =
        route.status === "in_progress" && route.startTime
          ? drivenKmFromPings(
              await locationsRepository.listByDriverBetween(
                route.driverId,
                route.startTime,
                new Date().toISOString(),
              ),
            )
          : 0;
      return Response.json(await finishRoute(ctx, route.id, drivenKm));
    },
  );
}
