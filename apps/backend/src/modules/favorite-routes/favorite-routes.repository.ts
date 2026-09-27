import type { CreateFavoriteRouteInput, FavoriteRoute } from "@torpreca/shared";
import { supabaseAdmin } from "../../core/db/supabase";

// The only layer that touches supabase-js for this entity — DB columns are
// snake_case, domain fields are camelCase — this is the seam.
function toFavoriteRoute(row: Record<string, unknown>): FavoriteRoute {
  return {
    id: row.id as string,
    label: row.label as string,
    originLat: Number(row.origin_lat),
    originLng: Number(row.origin_lng),
    destinationLat: Number(row.destination_lat),
    destinationLng: Number(row.destination_lng),
    plannedKm: Number(row.planned_km),
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface FavoriteRoutesRepository {
  list(): Promise<FavoriteRoute[]>;
  create(input: CreateFavoriteRouteInput, createdBy: string): Promise<FavoriteRoute>;
  remove(id: string): Promise<void>;
}

export const favoriteRoutesRepository: FavoriteRoutesRepository = {
  async list() {
    const { data, error } = await supabaseAdmin.from("favorite_routes").select("*").order("label");
    if (error) throw error;
    return data.map(toFavoriteRoute);
  },

  async create(input, createdBy) {
    const { data, error } = await supabaseAdmin
      .from("favorite_routes")
      .insert({
        label: input.label,
        origin_lat: input.originLat,
        origin_lng: input.originLng,
        destination_lat: input.destinationLat,
        destination_lng: input.destinationLng,
        planned_km: input.plannedKm,
        created_by: createdBy,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toFavoriteRoute(data);
  },

  async remove(id) {
    const { error } = await supabaseAdmin.from("favorite_routes").delete().eq("id", id);
    if (error) throw error;
  },
};
