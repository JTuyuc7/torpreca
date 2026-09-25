import type {
  AuthUser,
  CreateStopBodyInput,
  ReorderStopsInput,
  Stop,
  UpdateStopInput,
} from "@torpreca/shared";
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../core/errors/app-error";
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

  // TOR-137: a route's stops are only editable while the route is still
  // `pending` — same rule as editing the route itself (409 otherwise), so a
  // driver never has stops added/removed/reordered under their feet mid-route.
  async function assertRoutePending(routeId: string) {
    const route = await routesRepo.getById(routeId);
    if (!route) throw new NotFoundError("Route not found");
    if (route.status !== "pending") {
      throw new AppError(409, "Stops cannot be edited (route is not pending)");
    }
  }

  return {
    async listByRoute(routeId: string, user: AuthUser): Promise<Stop[]> {
      await assertOwnsParentRoute(routeId, user);
      return repo.listByRoute(routeId);
    },

    async create(routeId: string, input: CreateStopBodyInput): Promise<Stop> {
      await assertRoutePending(routeId);
      const { order, ...fields } = input;
      // Append after the route's last stop unless the caller picked a slot.
      const nextOrder =
        order ??
        (await repo.listByRoute(routeId)).reduce((max, s) => Math.max(max, s.order), 0) + 1;
      return repo.create({ ...fields, routeId, order: nextOrder });
    },

    async update(id: string, input: UpdateStopInput): Promise<Stop> {
      const stop = await repo.getById(id);
      if (!stop) throw new NotFoundError("Stop not found");
      await assertRoutePending(stop.routeId);

      const updated = await repo.update(id, input);
      if (!updated) throw new AppError(409, "Stop is already completed");
      return updated;
    },

    async remove(id: string): Promise<void> {
      const stop = await repo.getById(id);
      if (!stop) throw new NotFoundError("Stop not found");
      await assertRoutePending(stop.routeId);
      if (!(await repo.delete(id))) throw new NotFoundError("Stop not found");
    },

    async reorder(routeId: string, input: ReorderStopsInput): Promise<Stop[]> {
      await assertRoutePending(routeId);
      const current = await repo.listByRoute(routeId);
      const sameSet =
        input.stopIds.length === current.length &&
        new Set(input.stopIds).size === current.length &&
        current.every((s) => input.stopIds.includes(s.id));
      if (!sameSet)
        throw new ValidationError("stopIds must list every stop of the route exactly once");

      await repo.reorder(routeId, input.stopIds);
      return repo.listByRoute(routeId);
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
