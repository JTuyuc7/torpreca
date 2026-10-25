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
  // Origin (A) / destination (B) picked in the km calculator — optional so
  // routes created before they existed (all NULL) stay valid.
  originLat: z.number().min(-90).max(90).nullish(),
  originLng: z.number().min(-180).max(180).nullish(),
  destinationLat: z.number().min(-90).max(90).nullish(),
  destinationLng: z.number().min(-180).max(180).nullish(),
  drivenKm: z.number().nonnegative(),
  startTime: z.iso.datetime().nullable(),
  endTime: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Route = z.infer<typeof RouteSchema>;

// `code` is not an input: the database generates it (R-00123, see the
// `next_route_code` migration), so clients can never send or edit one.
export const CreateRouteSchema = RouteSchema.pick({
  driverId: true,
  vehicleId: true,
  date: true,
  plannedKm: true,
  originLat: true,
  originLng: true,
  destinationLat: true,
  destinationLng: true,
});

export type CreateRouteInput = z.infer<typeof CreateRouteSchema>;

// Body of `POST /routes`: the route's own fields plus, optionally, the stops
// it is created with (the dashboard's "Nueva ruta" modal builds them in the
// same form). Omitted or empty means a route without stops, which the driver
// app already supports. Stops are always created `pending`.
export const CreateRouteWithStopsSchema = CreateRouteSchema.extend({
  stops: z.array(UpdateStopSchema).max(200).optional(),
});

export type CreateRouteWithStopsInput = z.infer<typeof CreateRouteWithStopsSchema>;

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

// Query of `GET /routes/search` (dashboard "Rutas" table): every filter is
// optional and they combine (AND). `status` also takes `overdue` — the derived
// "sin completar" state (see isRouteOverdue), which has no value in the
// `route_status` enum. `q` matches part of the route code. Paged with
// `limit`/`offset`, newest first.
export const ROUTE_STATUS_FILTERS = [...ROUTE_STATUSES, "overdue"] as const;

export const ListRoutesQuerySchema = z.object({
  driverId: z.uuid().optional(),
  vehicleId: z.uuid().optional(),
  status: z.enum(ROUTE_STATUS_FILTERS).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  q: z.string().trim().min(1).max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListRoutesQuery = z.infer<typeof ListRoutesQuerySchema>;

// One page of the result plus how many routes match in total, so the table can
// show "1–10 of 48" and know when the last page is reached.
export type RoutesPage = { items: Route[]; total: number };

export type RouteStatusFilter = (typeof ROUTE_STATUS_FILTERS)[number];
