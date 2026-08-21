import type { CreateStopInput, Stop } from "@torpreca/shared";
import { supabaseAdmin } from "../../core/db/supabase";

function toStop(row: Record<string, unknown>): Stop {
  return {
    id: row.id as string,
    routeId: row.route_id as string,
    order: row.order_index as number,
    customerName: row.customer_name as string,
    address: row.address as string,
    lat: row.lat as number,
    lng: row.lng as number,
    instructions: row.instructions as string | null,
    status: row.status as Stop["status"],
    estimatedTime: row.estimated_time as string | null,
    completedTime: row.completed_time as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface StopsRepository {
  listByRoute(routeId: string): Promise<Stop[]>;
  getById(id: string): Promise<Stop | null>;
  create(input: CreateStopInput): Promise<Stop>;
  complete(id: string): Promise<Stop | null>;
  delay(id: string): Promise<Stop | null>;
}

export const stopsRepository: StopsRepository = {
  async listByRoute(routeId) {
    const { data, error } = await supabaseAdmin
      .from("stops")
      .select("*")
      .eq("route_id", routeId)
      .order("order_index");
    if (error) throw error;
    return data.map(toStop);
  },

  async getById(id) {
    const { data, error } = await supabaseAdmin.from("stops").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? toStop(data) : null;
  },

  async create(input) {
    const { data, error } = await supabaseAdmin
      .from("stops")
      .insert({
        route_id: input.routeId,
        order_index: input.order,
        customer_name: input.customerName,
        address: input.address,
        lat: input.lat,
        lng: input.lng,
        instructions: input.instructions,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toStop(data);
  },

  // Only succeeds while the stop isn't already completed — the eq() chain is
  // the state-transition guard, same pattern as routes.repository start/finish.
  async complete(id) {
    const { data, error } = await supabaseAdmin
      .from("stops")
      .update({ status: "completed", completed_time: new Date().toISOString() })
      .eq("id", id)
      .neq("status", "completed")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? toStop(data) : null;
  },

  async delay(id) {
    const { data, error } = await supabaseAdmin
      .from("stops")
      .update({ status: "delayed" })
      .eq("id", id)
      .neq("status", "completed")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? toStop(data) : null;
  },
};