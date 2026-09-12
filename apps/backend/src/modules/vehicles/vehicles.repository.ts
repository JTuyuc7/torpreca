import type { CreateVehicleInput, UpdateVehicleInput, Vehicle } from "@torpreca/shared";
import { supabaseAdmin } from "../../core/db/supabase";

// The only layer that touches supabase-js for this entity — the service
// doesn't know Supabase exists, so it can be tested with a fake repository.
// DB columns are snake_case, domain fields are camelCase — this is the seam.
function toVehicle(row: Record<string, unknown>): Vehicle {
  return {
    id: row.id as string,
    plate: row.plate as string,
    model: row.model as string,
    capacity: row.capacity as number | null,
    category: row.category as Vehicle["category"],
    notes: row.notes as string | null,
    active: row.active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface VehiclesRepository {
  list(onlyActive?: boolean): Promise<Vehicle[]>;
  getById(id: string): Promise<Vehicle | null>;
  getByPlate(plate: string): Promise<Vehicle | null>;
  create(input: CreateVehicleInput): Promise<Vehicle>;
  update(id: string, patch: UpdateVehicleInput): Promise<Vehicle | null>;
  deactivate(id: string): Promise<void>;
}

export const vehiclesRepository: VehiclesRepository = {
  async list(onlyActive = true) {
    let query = supabaseAdmin.from("vehicles").select("*").order("plate");
    if (onlyActive) query = query.eq("active", true);

    const { data, error } = await query;
    if (error) throw error;
    return data.map(toVehicle);
  },

  async getById(id) {
    const { data, error } = await supabaseAdmin
      .from("vehicles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toVehicle(data) : null;
  },

  async getByPlate(plate) {
    const { data, error } = await supabaseAdmin
      .from("vehicles")
      .select("*")
      .eq("plate", plate)
      .maybeSingle();
    if (error) throw error;
    return data ? toVehicle(data) : null;
  },

  async create(input) {
    const { data, error } = await supabaseAdmin
      .from("vehicles")
      .insert({
        plate: input.plate,
        model: input.model,
        capacity: input.capacity,
        category: input.category,
        notes: input.notes,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toVehicle(data);
  },

  async update(id, patch) {
    const row: Record<string, unknown> = {};
    if (patch.plate !== undefined) row.plate = patch.plate;
    if (patch.model !== undefined) row.model = patch.model;
    if (patch.capacity !== undefined) row.capacity = patch.capacity;
    if (patch.category !== undefined) row.category = patch.category;
    if (patch.notes !== undefined) row.notes = patch.notes;
    if (patch.active !== undefined) row.active = patch.active;

    const { data, error } = await supabaseAdmin
      .from("vehicles")
      .update(row)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? toVehicle(data) : null;
  },

  async deactivate(id) {
    const { error } = await supabaseAdmin.from("vehicles").update({ active: false }).eq("id", id);
    if (error) throw error;
  },
};
