import type {
  CreateRouteInput,
  Route,
  RouteStatus,
  RoutesPage,
  UpdateRouteInput,
} from "@torpreca/shared";
import { supabaseAdmin } from "../../core/db/supabase";

function toRoute(row: Record<string, unknown>): Route {
  return {
    id: row.id as string,
    code: row.code as string,
    driverId: row.driver_id as string,
    vehicleId: row.vehicle_id as string | null,
    createdBy: row.created_by as string,
    date: row.date as string,
    status: row.status as Route["status"],
    plannedKm: row.planned_km as number | null,
    originLat: (row.origin_lat as number | null) ?? null,
    originLng: (row.origin_lng as number | null) ?? null,
    destinationLat: (row.destination_lat as number | null) ?? null,
    destinationLng: (row.destination_lng as number | null) ?? null,
    drivenKm: row.driven_km as number,
    startTime: row.start_time as string | null,
    endTime: row.end_time as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface RouteFilter {
  driverId?: string;
  vehicleId?: string;
  // Part of the route code, case-insensitive.
  q?: string;
  // Only routes that were never finished and whose day is before this date
  // (still pending or in progress) — the dashboard's "sin completar".
  overdueBefore?: string;
  date?: string;
  status?: RouteStatus;
  // Any of these statuses (the history asks for completed + cancelled).
  statuses?: RouteStatus[];
  // Inclusive date range.
  from?: string;
  to?: string;
  // Page of the (already ordered) result: `limit` rows starting at `offset`.
  limit?: number;
  offset?: number;
}

export interface RoutesRepository {
  list(filter?: RouteFilter): Promise<Route[]>;
  // Same filters as list(), but also says how many routes match in total
  // (ignoring limit/offset).
  page(filter?: RouteFilter): Promise<RoutesPage>;
  getById(id: string): Promise<Route | null>;
  create(input: CreateRouteInput, createdBy: string): Promise<Route>;
  // Only succeeds while the route is still `pending` — same eq()-as-guard
  // pattern as start/finish below.
  update(id: string, patch: UpdateRouteInput): Promise<Route | null>;
  start(id: string, driverId: string): Promise<Route | null>;
  // `endTime` defaults to now; a route finished long after its own day passes
  // the end of that day instead (see routes.routes.ts#measureRoute).
  finish(id: string, driverId: string, drivenKm: number, endTime?: string): Promise<Route | null>;
  // Force-closes an `in_progress` route as `cancelled` (never finished by the
  // driver) — no driver filter, an admin can close any driver's route.
  close(id: string, drivenKm: number, endTime: string): Promise<Route | null>;
  // Only used to roll back a half-created duplicate; the stops go with it
  // (ON DELETE CASCADE).
  delete(id: string): Promise<void>;
}

// `%` and `_` are wildcards in ILIKE and `\` escapes them: a search for "R_1"
// should find that literal text, not "R" + any character + "1".
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function buildListQuery(filter: RouteFilter, withCount: boolean) {
  // Newest first, and within a day the most recently created route first —
  // without a tiebreaker the order of same-day routes was up to Postgres.
  let query = supabaseAdmin
    .from("routes")
    .select("*", withCount ? { count: "exact" } : undefined)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (filter.driverId) query = query.eq("driver_id", filter.driverId);
  if (filter.vehicleId) query = query.eq("vehicle_id", filter.vehicleId);
  if (filter.date) query = query.eq("date", filter.date);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.statuses) query = query.in("status", filter.statuses);
  if (filter.overdueBefore) {
    query = query.in("status", ["pending", "in_progress"]).lt("date", filter.overdueBefore);
  }
  if (filter.from) query = query.gte("date", filter.from);
  if (filter.to) query = query.lte("date", filter.to);
  if (filter.q) query = query.ilike("code", `%${escapeLike(filter.q)}%`);
  if (filter.limit !== undefined) {
    const offset = filter.offset ?? 0;
    query = query.range(offset, offset + filter.limit - 1);
  }
  return query;
}

export const routesRepository: RoutesRepository = {
  async list(filter = {}) {
    const { data, error } = await buildListQuery(filter, false);
    if (error) throw error;
    return data.map(toRoute);
  },

  async page(filter = {}) {
    const { data, error, count } = await buildListQuery(filter, true);
    if (error) throw error;
    return { items: data.map(toRoute), total: count ?? data.length };
  },

  async getById(id) {
    const { data, error } = await supabaseAdmin
      .from("routes")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toRoute(data) : null;
  },

  async create(input, createdBy) {
    const { data, error } = await supabaseAdmin
      .from("routes")
      .insert({
        driver_id: input.driverId,
        vehicle_id: input.vehicleId,
        created_by: createdBy,
        date: input.date,
        planned_km: input.plannedKm,
        origin_lat: input.originLat ?? null,
        origin_lng: input.originLng ?? null,
        destination_lat: input.destinationLat ?? null,
        destination_lng: input.destinationLng ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toRoute(data);
  },

  async update(id, patch) {
    const row: Record<string, unknown> = {};
    if (patch.driverId !== undefined) row.driver_id = patch.driverId;
    if (patch.vehicleId !== undefined) row.vehicle_id = patch.vehicleId;
    if (patch.date !== undefined) row.date = patch.date;
    if (patch.plannedKm !== undefined) row.planned_km = patch.plannedKm;
    if (patch.originLat !== undefined) row.origin_lat = patch.originLat;
    if (patch.originLng !== undefined) row.origin_lng = patch.originLng;
    if (patch.destinationLat !== undefined) row.destination_lat = patch.destinationLat;
    if (patch.destinationLng !== undefined) row.destination_lng = patch.destinationLng;

    const { data, error } = await supabaseAdmin
      .from("routes")
      .update(row)
      .eq("id", id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? toRoute(data) : null;
  },

  // Only succeeds if this driver owns the route and it's still `pending` — the
  // eq() chain doubles as the state-transition guard, no separate check needed.
  async start(id, driverId) {
    const { data, error } = await supabaseAdmin
      .from("routes")
      .update({ status: "in_progress", start_time: new Date().toISOString() })
      .eq("id", id)
      .eq("driver_id", driverId)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? toRoute(data) : null;
  },

  async finish(id, driverId, drivenKm, endTime = new Date().toISOString()) {
    const { data, error } = await supabaseAdmin
      .from("routes")
      .update({ status: "completed", end_time: endTime, driven_km: drivenKm })
      .eq("id", id)
      .eq("driver_id", driverId)
      .eq("status", "in_progress")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? toRoute(data) : null;
  },

  async close(id, drivenKm, endTime) {
    const { data, error } = await supabaseAdmin
      .from("routes")
      .update({ status: "cancelled", end_time: endTime, driven_km: drivenKm })
      .eq("id", id)
      .eq("status", "in_progress")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? toRoute(data) : null;
  },

  async delete(id) {
    const { error } = await supabaseAdmin.from("routes").delete().eq("id", id);
    if (error) throw error;
  },
};
