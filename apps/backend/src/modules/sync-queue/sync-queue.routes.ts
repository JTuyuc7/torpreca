import { SyncBatchSchema } from "@torpreca/shared";
import { clientIp } from "../../core/http/client-ip";
import type { Routable } from "../../core/http/router";
import { auth } from "../../core/middleware/auth";
import { rateLimitGeneral } from "../../core/middleware/rate-limit";
import { requireRole } from "../../core/middleware/role";
import { validateBody } from "../../core/middleware/validate-zod";
import { locationsRepository } from "../locations/locations.repository";
import { createLocationsService } from "../locations/locations.service";
import { routesRepository } from "../routes/routes.repository";
import { createRoutesService } from "../routes/routes.service";
import { stopsRepository } from "../stops/stops.repository";
import { createStopsService } from "../stops/stops.service";
import { syncQueueRepository } from "./sync-queue.repository";
import { createSyncQueueService } from "./sync-queue.service";

const locationsService = createLocationsService(locationsRepository, routesRepository);
const stopsService = createStopsService(stopsRepository, routesRepository);
const routesService = createRoutesService(routesRepository);
const service = createSyncQueueService(
  syncQueueRepository,
  locationsService,
  stopsService,
  routesService,
);

export function registerSyncQueueRoutes(router: Routable) {
  router.post(
    "/sync",
    auth,
    requireRole("driver"), // only drivers queue actions while offline
    rateLimitGeneral, // one HTTP request even for a large batch — no special-casing needed
    validateBody(SyncBatchSchema),
    async (ctx) => {
      const results = await service.drain(ctx.body as never, ctx.user!, clientIp(ctx));
      return Response.json({ results });
    },
  );
}

// Mirrors modules/auth/mobile-auth.routes.ts and
// modules/ws-tickets/ws-tickets.routes.ts' registerMobileWsTicketsRoutes:
// Flutter can't hold REQUEST_SIGNING_SECRET, so the driver app drains its
// offline queue through this unsigned /mobile route instead of /sync,
// protected by JWT + role + rate limit only. Same `service.drain()` as the
// signed route — no parallel business logic.
export function registerMobileSyncQueueRoutes(router: Routable) {
  router.post(
    "/mobile/sync",
    auth,
    requireRole("driver"),
    rateLimitGeneral,
    validateBody(SyncBatchSchema),
    async (ctx) => {
      const results = await service.drain(ctx.body as never, ctx.user!, clientIp(ctx));
      return Response.json({ results });
    },
  );
}
