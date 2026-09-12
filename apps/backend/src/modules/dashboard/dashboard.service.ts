import type { DashboardSummary } from "@torpreca/shared";
import type { LocationsRepository } from "../locations/locations.repository";
import type { RoutesRepository } from "../routes/routes.repository";
import type { UsersRepository } from "../users/users.repository";
import type { VehiclesRepository } from "../vehicles/vehicles.repository";

// A driver counts as "online" if their last ping landed within this window —
// there's no explicit online/offline signal from the mobile app (TOR-18 pings
// on a timer, doesn't announce disconnects), so recency is the only proxy
// available. 5 minutes is generous enough to survive one missed ping cycle
// (pings every 8s) without flapping.
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

export interface DashboardDeps {
  routes: RoutesRepository;
  vehicles: VehiclesRepository;
  users: UsersRepository;
  locations: LocationsRepository;
}

// Reuses each module's existing list() rather than adding count-only queries
// to every repository — fine at this project's scale (see the same tradeoff
// already made in locations.repository.ts's listLatestPerDriver).
export function createDashboardService(deps: DashboardDeps) {
  return {
    async getSummary(): Promise<DashboardSummary> {
      const [routes, vehicles, drivers, latestLocations] = await Promise.all([
        deps.routes.list(),
        deps.vehicles.list(false),
        deps.users.list("active"),
        deps.locations.listLatestPerDriver(),
      ]);

      const today = new Date().toISOString().slice(0, 10);
      const now = Date.now();

      return {
        routesInProgress: routes.filter((r) => r.status === "in_progress").length,
        routesPendingToday: routes.filter((r) => r.status === "pending" && r.date === today).length,
        vehiclesActive: vehicles.filter((v) => v.active).length,
        driversActive: drivers.filter((u) => u.role === "driver").length,
        driversOnline: latestLocations.filter(
          (loc) => now - new Date(loc.recordedAt).getTime() <= ONLINE_THRESHOLD_MS,
        ).length,
      };
    },
  };
}

export type DashboardService = ReturnType<typeof createDashboardService>;
