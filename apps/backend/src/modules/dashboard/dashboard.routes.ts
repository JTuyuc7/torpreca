import type { Routable } from "../../core/http/router";
import { auth } from "../../core/middleware/auth";
import { rateLimitGeneral } from "../../core/middleware/rate-limit";
import { requireRole } from "../../core/middleware/role";
import { locationsRepository } from "../locations/locations.repository";
import { routesRepository } from "../routes/routes.repository";
import { usersRepository } from "../users/users.repository";
import { vehiclesRepository } from "../vehicles/vehicles.repository";
import { createDashboardService } from "./dashboard.service";

const service = createDashboardService({
  routes: routesRepository,
  vehicles: vehiclesRepository,
  users: usersRepository,
  locations: locationsRepository,
});

// Same role gate as GET /locations/latest — this is the same "live ops"
// audience (drivers have no reason to see fleet-wide counts).
export function registerDashboardRoutes(router: Routable) {
  router.get(
    "/dashboard/summary",
    auth,
    requireRole("admin", "supervisor", "super_admin"),
    rateLimitGeneral,
    async () => {
      return Response.json(await service.getSummary());
    },
  );
}
