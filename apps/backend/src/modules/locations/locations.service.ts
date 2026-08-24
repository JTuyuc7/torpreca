import type { AuthUser, CreateLocationInput, Location } from "@torpreca/shared";
import { ForbiddenError } from "../../core/errors/app-error";
import type { RoutesRepository } from "../routes/routes.repository";
import type { LocationsRepository } from "./locations.repository";

// Takes both repositories as dependencies (same DI pattern as stops): a ping
// tied to a route needs to check that route's driver to authorize it.
export function createLocationsService(repo: LocationsRepository, routesRepo: RoutesRepository) {
  async function assertOwnsParentRoute(routeId: string, user: AuthUser) {
    if (user.role !== "driver") return;
    const route = await routesRepo.getById(routeId);
    if (!route || route.driverId !== user.id) {
      throw new ForbiddenError("This route belongs to another driver");
    }
  }

  return {
    // driverId/synced are never trusted from client input — always derived
    // server-side (driverId from the authenticated user, synced by the repo).
    async recordPing(input: CreateLocationInput, user: AuthUser): Promise<Location> {
      if (input.routeId) await assertOwnsParentRoute(input.routeId, user);
      return repo.create(input, user.id);
    },

    async listByRoute(routeId: string, user: AuthUser): Promise<Location[]> {
      await assertOwnsParentRoute(routeId, user);
      return repo.listByRoute(routeId);
    },

    async listLatest(): Promise<Location[]> {
      return repo.listLatestPerDriver();
    },
  };
}

export type LocationsService = ReturnType<typeof createLocationsService>;
