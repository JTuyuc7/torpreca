import { z } from "../zod";

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export const LANGUAGES = ["es", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const MapViewSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  zoom: z.number(),
});
export type MapView = z.infer<typeof MapViewSchema>;

export const UserPreferencesSchema = z.object({
  userId: z.uuid(),
  theme: z.enum(THEMES),
  language: z.enum(LANGUAGES),
  // Only meaningful for admin/supervisor/super_admin (the live-map roles) —
  // enforced in the dashboard UI, not here: a driver saving one is harmless
  // dead data, not a security concern worth a role check on this endpoint.
  defaultMapView: MapViewSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export const UpdateUserPreferencesSchema = z.object({
  theme: z.enum(THEMES).optional(),
  language: z.enum(LANGUAGES).optional(),
  defaultMapView: MapViewSchema.nullable().optional(),
});
export type UpdateUserPreferencesInput = z.infer<typeof UpdateUserPreferencesSchema>;
