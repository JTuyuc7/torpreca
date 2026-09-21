CREATE TABLE "public"."user_preferences" (
  "user_id"           uuid                     NOT NULL,
  "theme"             text                     NOT NULL DEFAULT 'system',
  "language"          text                     NOT NULL DEFAULT 'es',
  "default_map_lat"   numeric(10,7),
  "default_map_lng"   numeric(10,7),
  "default_map_zoom"  numeric(4,2),
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "user_preferences_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "user_preferences_theme_check" CHECK (theme IN ('light', 'dark', 'system')),
  CONSTRAINT "user_preferences_language_check" CHECK (language IN ('es', 'en'))
);

ALTER TABLE "public"."user_preferences"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_preferences"
  ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_preferences" TO "anon", "authenticated", "postgres", "service_role";
