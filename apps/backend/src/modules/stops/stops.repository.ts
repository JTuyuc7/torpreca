import type { CreateStopInput, Stop } from "@torpreca/shared";
import { env } from "../../core/config/env";
import { supabaseAdmin } from "../../core/db/supabase";

// customer_name/address are PII (a delivery customer's name and address) —
// encrypted at rest the same way as users.name. Reads go through the
// `get_stops_readable` RPC (decrypts both columns); the write paths
// (`create_stop_encrypted`, `complete_stop_encrypted`, `delay_stop_encrypted`)
// encrypt/decrypt server-side too — plain insert/update can't touch those
// columns directly. See users.repository.ts for why the secret key travels
// as an RPC argument instead of a Postgres GUC.
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
      .rpc("get_stops_readable", { p_secret_key: env.SECRET_KEY })
      .eq("route_id", routeId)
      .order("order_index");
    if (error) throw error;
    return data.map(toStop);
  },

  async getById(id) {
    const { data, error } = await supabaseAdmin
      .rpc("get_stops_readable", { p_secret_key: env.SECRET_KEY })
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toStop(data as Record<string, unknown>) : null;
  },

  async create(input) {
    const { data, error } = await supabaseAdmin
      .rpc("create_stop_encrypted", {
        p_route_id: input.routeId,
        p_order_index: input.order,
        p_customer_name: input.customerName,
        p_address: input.address,
        p_lat: input.lat,
        p_lng: input.lng,
        p_instructions: input.instructions,
        p_secret_key: env.SECRET_KEY,
      })
      .single();
    if (error) throw error;

    const row = data as Record<string, unknown>;
    return toStop({ ...row, customer_name: input.customerName, address: input.address });
  },

  // The guard (only succeeds while not already completed) lives inside the
  // RPC's WHERE clause now — it needs the secret key to decrypt the row it
  // returns, so it can't stay a plain .update().eq().neq() chain.
  async complete(id) {
    const { data, error } = await supabaseAdmin
      .rpc("complete_stop_encrypted", { p_id: id, p_secret_key: env.SECRET_KEY })
      .maybeSingle();
    if (error) throw error;
    return data ? toStop(data as Record<string, unknown>) : null;
  },

  async delay(id) {
    const { data, error } = await supabaseAdmin
      .rpc("delay_stop_encrypted", { p_id: id, p_secret_key: env.SECRET_KEY })
      .maybeSingle();
    if (error) throw error;
    return data ? toStop(data as Record<string, unknown>) : null;
  },
};
