import { ROUTE_STATUSES } from "../constants/statuses";
import { z } from "../zod";
import { UpdateStopSchema } from "./stop.schema";

export const RouteSchema = z.object({
  id: z.uuid(),
  code: z.string().min(1),
  driverId: z.uuid(),
  vehicleId: z.uuid().nullable(),
  createdBy: z.uuid(),
  date: z.iso.date(),
  status: z.enum(ROUTE_STATUSES),
  plannedKm: z.number().nonnegative().nullable(),
  drivenKm: z.number().nonnegative(),
  startTime: z.iso.datetime().nullable(),
  endTime: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Route = z.infer<typeof RouteSchema>;

export const CreateRouteSchema = RouteSchema.pick({
  code: true,
  driverId: true,
  vehicleId: true,
  date: true,
  plannedKm: true,
});

export type CreateRouteInput = z.infer<typeof CreateRouteSchema>;

// Every field optional: a PATCH can touch just one of them (e.g. only
// reassigning the vehicle). Only allowed while the route is still `pending`
// — enforced by the repository's update() guard, same pattern as start/finish.
export const UpdateRouteSchema = CreateRouteSchema.partial();

export type UpdateRouteInput = z.infer<typeof UpdateRouteSchema>;

export const FinishRouteSchema = z.object({
  drivenKm: z.number().nonnegative(),
});

export type FinishRouteInput = z.infer<typeof FinishRouteSchema>;

// Body of `POST /routes/:id/duplicate`: the new route's own fields plus the
// full list of stops it should be created with — the dashboard pre-loads the
// source route's stops, lets the user add/remove/reorder them, and sends the
// result. Stops are always created `pending` regardless of the source's state.
export const DuplicateRouteSchema = CreateRouteSchema.extend({
  stops: z.array(UpdateStopSchema).max(200),
});

export type DuplicateRouteInput = z.infer<typeof DuplicateRouteSchema>;

// Query of `GET /mobile/routes/history` (driver app "Rutas anteriores"): the
// driver's finished routes (completed or closed without finishing), newest
// first, `limit` per page (default 5) with `offset` to page, optionally
// narrowed to an inclusive `from`/`to` date range. Offset (not a date cursor,
// as the reports history uses) because several routes can share one day.
export const ListRouteHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(31).default(5),
  offset: z.coerce.number().int().min(0).default(0),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export type ListRouteHistoryQuery = z.infer<typeof ListRouteHistoryQuerySchema>;
