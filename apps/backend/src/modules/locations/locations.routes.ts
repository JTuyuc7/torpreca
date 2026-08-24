import type { Routable } from "../../core/http/router";
import { auth } from "../../core/middleware/auth";
import { rateLimitGeneral } from "../../core/middleware/rate-limit";
import { requireRole } from "../../core/middleware/role";
import { routesRepository } from "../routes/routes.repository";
import { locationsRepository } from "./locations.repository";
import { createLocationsService } from "./locations.service";

const service = createLocationsService(locationsRepository, routesRepository);

// Read-only: the WebSocket connection (/ws) is the only ingestion path for
// pings — a parallel POST here would create two code paths for the same effect.
export function registerLocationsRoutes(router: Routable) {
  router.get("/routes/:routeId/locations", auth, rateLimitGeneral, async (ctx) => {
    return Response.json(await service.listByRoute(ctx.params.routeId!, ctx.user!));
  });

  router.get(
    "/locations/latest",
    auth,
    requireRole("admin", "supervisor", "super_admin"),
    rateLimitGeneral,
    async () => {
      return Response.json(await service.listLatest());
    },
  );
}
