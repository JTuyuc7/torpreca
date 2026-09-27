import {
  type AuthUser,
  type CreateRouteInput,
  isRouteOverdue,
  type ListRouteHistoryQuery,
  type Route,
  type RouteStatus,
  type UpdateRouteInput,
} from "@torpreca/shared";
import { AppError, ForbiddenError, NotFoundError } from "../../core/errors/app-error";
import type { RoutesRepository } from "./routes.repository";

// Takes the repository as a dependency instead of importing the real one:
// tests pass in an in-memory one and this runs without touching Supabase.
export function createRoutesService(repo: RoutesRepository) {
  return {
    async list(user: AuthUser, date?: string, status?: RouteStatus): Promise<Route[]> {
      return repo.list(
        user.role === "driver" ? { driverId: user.id, date, status } : { date, status },
      );
    },

    // The driver's finished routes (completed, or closed without finishing),
    // newest first — what "Rutas anteriores" in the app pages through.
    async history(user: AuthUser, query: ListRouteHistoryQuery): Promise<Route[]> {
      return repo.list({
        driverId: user.id,
        statuses: ["completed", "cancelled"],
        ...query,
      });
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

    async update(id: string, patch: UpdateRouteInput): Promise<Route> {
      const existing = await repo.getById(id);
      if (!existing) throw new NotFoundError("Route not found");

      const updated = await repo.update(id, patch);
      if (!updated) throw new AppError(409, "Route cannot be edited (not pending)");
      return updated;
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

    async finish(id: string, driverId: string, drivenKm: number, endTime?: string): Promise<Route> {
      const route = await repo.getById(id);
      if (!route) throw new NotFoundError("Route not found");
      if (route.driverId !== driverId) {
        throw new ForbiddenError("This route belongs to another driver");
      }

      const finished = await repo.finish(id, driverId, drivenKm, endTime);
      if (!finished) throw new AppError(409, "Route cannot be finished (not in progress)");
      return finished;
    },

    // A route the driver started and never finished, whose day is over. It
    // can't just be `finish`ed by anyone else, and it's not really
    // `completed` either, so it's closed as `cancelled` — by the driver
    // themselves (their own route only) or by an admin/supervisor. Pending
    // routes of a past day are not closable: nothing ran, they can only be
    // duplicated.
    async close(id: string, actor: AuthUser, drivenKm: number, endTime: string): Promise<Route> {
      const route = await repo.getById(id);
      if (!route) throw new NotFoundError("Route not found");
      if (actor.role === "driver" && route.driverId !== actor.id) {
        throw new ForbiddenError("This route belongs to another driver");
      }
      if (route.status !== "in_progress" || !isRouteOverdue(route)) {
        throw new AppError(409, "Only an overdue in-progress route can be closed");
      }

      const closed = await repo.close(id, drivenKm, endTime);
      if (!closed) throw new AppError(409, "Only an overdue in-progress route can be closed");
      return closed;
    },
  };
}

export type RoutesService = ReturnType<typeof createRoutesService>;
