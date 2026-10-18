-- Additive only: four nullable columns on routes, nothing dropped or altered.
-- Existing rows keep NULL (no A/B known) and every existing query keeps working.
-- Origin (A) / destination (B) picked in the dashboard's "Calcular Km en mapa"
-- dialog, so the live map can draw them for the selected route.
ALTER TABLE "public"."routes"
  ADD COLUMN IF NOT EXISTS "origin_lat"       double precision,
  ADD COLUMN IF NOT EXISTS "origin_lng"       double precision,
  ADD COLUMN IF NOT EXISTS "destination_lat"  double precision,
  ADD COLUMN IF NOT EXISTS "destination_lng"  double precision;

-- A point is both coordinates or neither, never half of one. Existing rows
-- (all NULL) satisfy it, so adding it can't fail on current data.
ALTER TABLE "public"."routes"
  ADD CONSTRAINT "routes_origin_point_check"
    CHECK ((origin_lat IS NULL) = (origin_lng IS NULL)),
  ADD CONSTRAINT "routes_destination_point_check"
    CHECK ((destination_lat IS NULL) = (destination_lng IS NULL));
