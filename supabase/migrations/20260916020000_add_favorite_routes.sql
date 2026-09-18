CREATE TABLE "public"."favorite_routes" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "label"           text                     NOT NULL,
  "origin_lat"      numeric(10,7)            NOT NULL,
  "origin_lng"      numeric(10,7)            NOT NULL,
  "destination_lat" numeric(10,7)            NOT NULL,
  "destination_lng" numeric(10,7)            NOT NULL,
  "planned_km"      numeric(10,2)            NOT NULL,
  "created_by"      uuid                     NOT NULL,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "favorite_routes_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."favorite_routes"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."favorite_routes"
  ADD CONSTRAINT "favorite_routes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.users(id);

CREATE INDEX idx_favorite_routes_label ON public.favorite_routes USING btree (label);

CREATE TRIGGER trg_favorite_routes_updated_at
  BEFORE UPDATE ON public.favorite_routes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."favorite_routes" TO "anon", "authenticated", "postgres", "service_role";
