import type { AuthUser, CreateStopInput, Stop } from "@torpreca/shared";
import { AppError, ForbiddenError, NotFoundError } from "../../core/errors/app-error";
import type { RoutesRepository } from "../routes/routes.repository";
import type { StopsRepository } from "./stops.repository";

// Takes both repositories as dependencies (same DI pattern as the other modules):
// stops need to check the parent route's driver to authorize complete/delay.
export function createStopsService(repo: StopsRepository, routesRepo: RoutesRepository) {
  async function assertOwnsParentRoute(routeId: string, user: AuthUser) {
    if (user.role !== "driver") return;
    const route = await routesRepo.getById(routeId);
    if (!route || route.driverId !== user.id) {
      throw new ForbiddenError("This stop belongs to another driver's route");
    }
  }

  return {
    async listByRoute(routeId: string, user: AuthUser): Promise<Stop[]> {
      await assertOwnsParentRoute(routeId, user);
      return repo.listByRoute(routeId);
    },

    async create(input: CreateStopInput): Promise<Stop> {
      const route = await routesRepo.getById(input.routeId);
      if (!route) throw new NotFoundError("Route not found");
      return repo.create(input);
    },

    async complete(id: string, user: AuthUser): Promise<Stop> {
      const stop = await repo.getById(id);
      if (!stop) throw new NotFoundError("Stop not found");
      await assertOwnsParentRoute(stop.routeId, user);

      const updated = await repo.complete(id);
      if (!updated) throw new AppError(409, "Stop is already completed");
      return updated;
    },

    async delay(id: string, user: AuthUser): Promise<Stop> {
      const stop = await repo.getById(id);
      if (!stop) throw new NotFoundError("Stop not found");
      await assertOwnsParentRoute(stop.routeId, user);

      const updated = await repo.delay(id);
      if (!updated) throw new AppError(409, "Stop is already completed");
      return updated;
    },
  };
}

export type StopsService = ReturnType<typeof createStopsService>;
