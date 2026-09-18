// Shared by every Mapbox map in the dashboard (Panel principal's live map,
// the "Calcular en mapa" modal in /rutas, ...) — one list so they can't
// drift out of sync, and so a style picked in one place (see
// lib/preferences/map-style.ts) means the same thing everywhere.
export const MAP_STYLES = [
  { label: "Calles", value: "mapbox://styles/mapbox/streets-v12" },
  { label: "Satélite", value: "mapbox://styles/mapbox/satellite-streets-v12" },
  { label: "Oscuro", value: "mapbox://styles/mapbox/dark-v11" },
] as const;

export type MapStyleValue = (typeof MAP_STYLES)[number]["value"];
