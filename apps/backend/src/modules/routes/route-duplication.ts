import type {
  CreateRouteInput,
  DuplicateRouteInput,
  Route,
  UpdateStopInput,
} from "@torpreca/shared";
import { NotFoundError } from "../../core/errors/app-error";
import type { StopsRepository } from "../stops/stops.repository";
import type { RoutesRepository } from "./routes.repository";

// "Duplicar" (dashboard): a new route, on a new date and possibly another
// driver, whose stops are the ones the caller sends — pre-filled from the
// source route's stops and then added to/removed from/reordered in the
// dialog. Always created `pending`, with every stop `pending` too, whatever
// state the source was in.
//
// Two repositories, one operation — see createWithStops below.
export function createRouteDuplicationService(
  routesRepo: RoutesRepository,
  stopsRepo: StopsRepository,
) {
  // Route first, stops after; a failing stop deletes the route again (its
  // stops go with it, ON DELETE CASCADE) so nothing half-built is left behind.
  async function createWithStops(
    routeInput: CreateRouteInput,
    stops: UpdateStopInput[],
    createdBy: string,
  ): Promise<Route> {
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
  }

  return {
    // "Nueva ruta" (dashboard): same operation as a duplicate, minus the source.
    createWithStops,

    async duplicate(
      sourceId: string,
      input: DuplicateRouteInput,
      createdBy: string,
    ): Promise<Route> {
      // The source only has to exist — the new route's data all comes from
      // the body, so a source that was since edited or closed changes nothing.
      if (!(await routesRepo.getById(sourceId))) throw new NotFoundError("Route not found");

      const { stops, ...routeInput } = input;
      return createWithStops(routeInput, stops, createdBy);
    },
  };
}

export type RouteDuplicationService = ReturnType<typeof createRouteDuplicationService>;
