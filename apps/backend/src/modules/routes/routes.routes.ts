import {
  CreateRouteSchema,
  DuplicateRouteSchema,
  endOfBusinessDay,
  FinishRouteSchema,
  ListRouteHistoryQuerySchema,
  ROUTE_STATUSES,
  type Route,
  type RouteStatus,
  UpdateRouteSchema,
} from "@torpreca/shared";
import { logEvent } from "../../core/audit/log-event";
import { ValidationError } from "../../core/errors/app-error";
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
import { createRouteDuplicationService } from "./route-duplication";
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

const duplication = createRouteDuplicationService(routesRepository, stopsRepository);

// `?status=` of the list endpoints — the driver app asks for its own
// `in_progress` routes of any date to find the ones it never closed.
function statusParam(req: Request): RouteStatus | undefined {
  const value = new URL(req.url).searchParams.get("status");
  if (value === null) return undefined;
  if (!(ROUTE_STATUSES as readonly string[]).includes(value)) {
    throw new ValidationError("Invalid status");
  }
  return value as RouteStatus;
}

// What a route that's being finished/closed *now* actually drove, measured
// from the driver's GPS pings between its start and the cutoff. The cutoff is
// now for a route of today, but the end of the route's own day when it's
// closed later: otherwise a route left open over the weekend would count every
// kilometer driven until someone closed it. A route started after its own day
// ended (started late, dated earlier) isn't capped — there'd be no window.
async function measureRoute(route: Route): Promise<{ drivenKm: number; endTime: string }> {
  const now = new Date();
  if (route.status !== "in_progress" || !route.startTime) {
    return { drivenKm: 0, endTime: now.toISOString() };
  }

  const dayEnd = endOfBusinessDay(route.date);
  const cutoff = new Date(route.startTime) >= dayEnd || now < dayEnd ? now : dayEnd;
  const pings = await locationsRepository.listByDriverBetween(
    route.driverId,
    route.startTime,
    cutoff.toISOString(),
  );
  return { drivenKm: drivenKmFromPings(pings), endTime: cutoff.toISOString() };
}

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

async function finishRoute(ctx: Context, routeId: string, drivenKm: number, endTime?: string) {
  const route = await service.finish(routeId, ctx.user!.id, drivenKm, endTime);

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

// Closes an overdue in-progress route as `cancelled`. Whoever calls it — the
// driver from the app or an admin from the dashboard — the ownership/state
// rules live in the service; this only measures and audits.
async function closeRoute(ctx: Context, routeId: string) {
  const route = await service.getById(routeId, ctx.user!);
  const { drivenKm, endTime } = await measureRoute(route);
  const closed = await service.close(routeId, ctx.user!, drivenKm, endTime);

  // No `route.closed` in the `audit_action` enum, and adding one means a
  // migration for what is a kind of route update — flagged in the metadata.
  await logEvent({
    userId: ctx.user!.id,
    role: ctx.user!.role,
    action: "route.updated",
    entity: "routes",
    entityId: closed.id,
    ip: clientIp(ctx),
    metadata: { closedIncomplete: true, drivenKm },
  });

  return closed;
}

export function registerRoutesRoutes(router: Routable) {
  router.get("/routes", auth, rateLimitGeneral, async (ctx) => {
    const date = new URL(ctx.req.url).searchParams.get("date") ?? undefined;
    return Response.json(await service.list(ctx.user!, date, statusParam(ctx.req)));
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

  router.post(
    "/routes/:id/duplicate",
    auth,
    requireRole("admin", "supervisor", "super_admin"),
    rateLimitGeneral,
    validateBody(DuplicateRouteSchema),
    async (ctx) => {
      const sourceId = ctx.params.id!;
      const route = await duplication.duplicate(sourceId, ctx.body as never, ctx.user!.id);

      await logEvent({
        userId: ctx.user!.id,
        role: ctx.user!.role,
        action: "route.created",
        entity: "routes",
        entityId: route.id,
        ip: clientIp(ctx),
        metadata: { duplicatedFrom: sourceId },
      });

      return Response.json(route, { status: 201 });
    },
  );

  router.patch(
    "/routes/:id/close",
    auth,
    requireRole("admin", "supervisor", "super_admin"),
    rateLimitGeneral,
    async (ctx) => {
      return Response.json(await closeRoute(ctx, ctx.params.id!));
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
    return Response.json(await service.list(ctx.user!, date, statusParam(ctx.req)));
  });

  // Registered before "/mobile/routes/:id": the router takes the first match,
  // and "history" would otherwise be read as a route id.
  router.get(
    "/mobile/routes/history",
    auth,
    requireRole("driver"),
    rateLimitGeneral,
    async (ctx) => {
      const params = Object.fromEntries(new URL(ctx.req.url).searchParams);
      const parsed = ListRouteHistoryQuerySchema.safeParse(params);
      if (!parsed.success) throw new ValidationError("Invalid query", parsed.error.issues);

      return Response.json(await service.history(ctx.user!, parsed.data));
    },
  );

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
  // measured from the driver's GPS pings between the route's start and now
  // (or the end of the route's day, see measureRoute). (Pings still queued
  // offline on the phone aren't counted — the trade-off of not making the
  // driver type the number in.) Ownership/state errors (403/404/409) come
  // from service.getById/finish before anything is written.
  router.patch(
    "/mobile/routes/:id/finish",
    auth,
    requireRole("driver"),
    rateLimitGeneral,
    async (ctx) => {
      const route = await service.getById(ctx.params.id!, ctx.user!);
      const { drivenKm, endTime } = await measureRoute(route);
      return Response.json(await finishRoute(ctx, route.id, drivenKm, endTime));
    },
  );

  // "Cerrar sin completar": the driver gives up a route from a past day that
  // they started and never finished, so it stops blocking their next one.
  router.patch(
    "/mobile/routes/:id/close",
    auth,
    requireRole("driver"),
    rateLimitGeneral,
    async (ctx) => {
      return Response.json(await closeRoute(ctx, ctx.params.id!));
    },
  );
}
