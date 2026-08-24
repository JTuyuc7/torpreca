import type { AuthUser, CreateRouteInput, Route } from "@torpreca/shared";
import { AppError, ForbiddenError, NotFoundError } from "../../core/errors/app-error";
import type { RoutesRepository } from "./routes.repository";

// Takes the repository as a dependency instead of importing the real one:
// tests pass in an in-memory one and this runs without touching Supabase.
export function createRoutesService(repo: RoutesRepository) {
  return {
    async list(user: AuthUser, date?: string): Promise<Route[]> {
      return repo.list(user.role === "driver" ? { driverId: user.id, date } : { date });
    },

    async getById(id: string, user: AuthUser): Promise<Route> {
      const route = await repo.getById(id);
      if (!route) throw new NotFoundError("Route not found");
      if (user.role === "driver" && route.driverId !== user.id) {
        throw new ForbiddenError("This route belongs to another driver");
      }
      return route;
    },

    async create(input: CreateRouteInput, createdBy: string): Promise<Route> {
      return repo.create(input, createdBy);
    },

    // Ownership is checked here, separately from the state-transition guard
    // below — a queued sync event replayed for the wrong driver's route
    // needs to come back as a distinct 403, not get lumped into the same 409
    // an idempotent replay produces (see modules/sync-queue/sync-queue.service.ts).
    async start(id: string, driverId: string): Promise<Route> {
      const route = await repo.getById(id);
      if (!route) throw new NotFoundError("Route not found");
      if (route.driverId !== driverId) {
        throw new ForbiddenError("This route belongs to another driver");
      }

      const started = await repo.start(id, driverId);
      if (!started) throw new AppError(409, "Route cannot be started (not pending)");
      return started;
    },

    async finish(id: string, driverId: string, drivenKm: number): Promise<Route> {
      const route = await repo.getById(id);
      if (!route) throw new NotFoundError("Route not found");
      if (route.driverId !== driverId) {
        throw new ForbiddenError("This route belongs to another driver");
      }

      const finished = await repo.finish(id, driverId, drivenKm);
      if (!finished) throw new AppError(409, "Route cannot be finished (not in progress)");
      return finished;
    },
  };
}

export type RoutesService = ReturnType<typeof createRoutesService>;
