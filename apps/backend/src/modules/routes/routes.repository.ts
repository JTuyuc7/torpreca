import type { CreateRouteInput, Route } from "@torpreca/shared";
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
    drivenKm: row.driven_km as number,
    startTime: row.start_time as string | null,
    endTime: row.end_time as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface RouteFilter {
  driverId?: string;
  date?: string;
}

export interface RoutesRepository {
  list(filter?: RouteFilter): Promise<Route[]>;
  getById(id: string): Promise<Route | null>;
  create(input: CreateRouteInput, createdBy: string): Promise<Route>;
  start(id: string, driverId: string): Promise<Route | null>;
  finish(id: string, driverId: string, drivenKm: number): Promise<Route | null>;
}

export const routesRepository: RoutesRepository = {
  async list(filter = {}) {
    let query = supabaseAdmin.from("routes").select("*").order("date", { ascending: false });
    if (filter.driverId) query = query.eq("driver_id", filter.driverId);
    if (filter.date) query = query.eq("date", filter.date);

    const { data, error } = await query;
    if (error) throw error;
    return data.map(toRoute);
  },

  async getById(id) {
    const { data, error } = await supabaseAdmin.from("routes").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? toRoute(data) : null;
  },

  async create(input, createdBy) {
    const { data, error } = await supabaseAdmin
      .from("routes")
      .insert({
        code: input.code,
        driver_id: input.driverId,
        vehicle_id: input.vehicleId,
        created_by: createdBy,
        date: input.date,
        planned_km: input.plannedKm,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toRoute(data);
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

  async finish(id, driverId, drivenKm) {
    const { data, error } = await supabaseAdmin
      .from("routes")
      .update({ status: "completed", end_time: new Date().toISOString(), driven_km: drivenKm })
      .eq("id", id)
      .eq("driver_id", driverId)
      .eq("status", "in_progress")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? toRoute(data) : null;
  },
};