import type { DuplicateRouteInput, Route } from "@torpreca/shared";
import { NotFoundError } from "../../core/errors/app-error";
import type { StopsRepository } from "../stops/stops.repository";
import type { RoutesRepository } from "./routes.repository";

// "Duplicar" (dashboard): a new route, on a new date and possibly another
// driver, whose stops are the ones the caller sends — pre-filled from the
// source route's stops and then added to/removed from/reordered in the
// dialog. Always created `pending`, with every stop `pending` too, whatever
// state the source was in.
//
// Two repositories, one operation: the route row is created first and the
// stops after it. If any stop fails, the route is deleted again (its stops go
// with it, ON DELETE CASCADE) so a failed duplicate never leaves a half-built
// route behind.
export function createRouteDuplicationService(
  routesRepo: RoutesRepository,
  stopsRepo: StopsRepository,
) {
  return {
    async duplicate(
      sourceId: string,
      input: DuplicateRouteInput,
      createdBy: string,
    ): Promise<Route> {
      // The source only has to exist — the new route's data all comes from
      // the body, so a source that was since edited or closed changes nothing.
      if (!(await routesRepo.getById(sourceId))) throw new NotFoundError("Route not found");

      const { stops, ...routeInput } = input;
      const route = await routesRepo.create(routeInput, createdBy);

      try {
        for (const [index, stop] of stops.entries()) {
          await stopsRepo.create({ ...stop, routeId: route.id, order: index + 1 });
        }
      } catch (error) {
        await routesRepo.delete(route.id).catch(() => {});
        throw error;
      }

      return route;
    },
  };
}

export type RouteDuplicationService = ReturnType<typeof createRouteDuplicationService>;
