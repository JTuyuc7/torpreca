import type { UpdateUserPreferencesInput, UserPreferences } from "@torpreca/shared";
import { supabaseAdmin } from "../../core/db/supabase";

function toUserPreferences(row: Record<string, unknown>): UserPreferences {
  const lat = row.default_map_lat;
  const lng = row.default_map_lng;
  const zoom = row.default_map_zoom;
  const hasMapView = lat != null && lng != null && zoom != null;

  return {
    userId: row.user_id as string,
    theme: row.theme as UserPreferences["theme"],
    language: row.language as UserPreferences["language"],
    defaultMapView: hasMapView ? { lat: Number(lat), lng: Number(lng), zoom: Number(zoom) } : null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface UserPreferencesRepository {
  getByUserId(userId: string): Promise<UserPreferences | null>;
  patch(userId: string, input: UpdateUserPreferencesInput): Promise<UserPreferences>;
}

export const userPreferencesRepository: UserPreferencesRepository = {
  async getByUserId(userId) {
    const { data, error } = await supabaseAdmin
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? toUserPreferences(data) : null;
  },

  // Manual select-then-insert-or-update instead of supabase-js's .upsert() —
  // same pattern as daily-reports.repository.ts (see its comment): only the
  // fields present in `input` are written, so an update never clobbers a
  // preference the caller didn't touch, and a first-ever PATCH creates the
  // row with column defaults for whatever it also didn't touch.
  async patch(userId, input) {
    const { data: existing, error: findError } = await supabaseAdmin
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (findError) throw findError;

    const row: Record<string, unknown> = {};
    if (input.theme !== undefined) row.theme = input.theme;
    if (input.language !== undefined) row.language = input.language;
    if (input.defaultMapView !== undefined) {
      row.default_map_lat = input.defaultMapView?.lat ?? null;
      row.default_map_lng = input.defaultMapView?.lng ?? null;
      row.default_map_zoom = input.defaultMapView?.zoom ?? null;
    }

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from("user_preferences")
        .update(row)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (error) throw error;
      return toUserPreferences(data);
    }

    const { data, error } = await supabaseAdmin
      .from("user_preferences")
      .insert({ user_id: userId, ...row })
      .select("*")
      .single();
    if (error) throw error;
    return toUserPreferences(data);
  },
};
