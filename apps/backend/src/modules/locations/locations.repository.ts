import type { CreateLocationInput, Location } from "@torpreca/shared";
import { supabaseAdmin } from "../../core/db/supabase";

function toLocation(row: Record<string, unknown>): Location {
  return {
    id: row.id as string,
    driverId: row.driver_id as string,
    routeId: row.route_id as string | null,
    lat: row.lat as number,
    lng: row.lng as number,
    speed: row.speed as number | null,
    recordedAt: row.recorded_at as string,
    synced: row.synced as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface LocationsRepository {
  create(input: CreateLocationInput, driverId: string): Promise<Location>;
  listByRoute(routeId: string): Promise<Location[]>;
  listLatestPerDriver(): Promise<Location[]>;
}

export const locationsRepository: LocationsRepository = {
  // driverId is an explicit argument (not derived here) so TOR-77's sync-queue
  // drain can call this directly with a queued item's driverId later.
  async create(input, driverId) {
    const { data, error } = await supabaseAdmin
      .from("locations")
      .insert({
        driver_id: driverId,
        route_id: input.routeId,
        lat: input.lat,
        lng: input.lng,
        speed: input.speed,
        recorded_at: input.recordedAt,
        synced: true,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toLocation(data);
  },

  async listByRoute(routeId) {
    const { data, error } = await supabaseAdmin
      .from("locations")
      .select("*")
      .eq("route_id", routeId)
      .order("recorded_at", { ascending: true });
    if (error) throw error;
    return data.map(toLocation);
  },

  // No DISTINCT ON / window-function support in the query builder (or the
  // test fake), so fetch newest-first and keep the first row per driver in
  // memory. Fine at MVP scale — if this table grows large, replace with a
  // Postgres view (`CREATE VIEW latest_locations AS SELECT DISTINCT ON
  // (driver_id) ... ORDER BY driver_id, recorded_at DESC`) queried the same
  // way, no interface change needed.
  async listLatestPerDriver() {
    const { data, error } = await supabaseAdmin
      .from("locations")
      .select("*")
      .order("recorded_at", { ascending: false });
    if (error) throw error;

    const seen = new Set<string>();
    const latest: Location[] = [];
    for (const row of data) {
      const driverId = row.driver_id as string;
      if (seen.has(driverId)) continue;
      seen.add(driverId);
      latest.push(toLocation(row));
    }
    return latest;
  },
};
