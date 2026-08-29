SET local check_function_bodies = off;

CREATE EXTENSION "pg_cron";

CREATE TABLE "public"."audit_logs" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    uuid,
  "role"       text,
  "entity"     text,
  "entity_id"  uuid,
  "ip"         text,
  "metadata"   jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."audit_logs"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."daily_reports" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "driver_id"       uuid                     NOT NULL,
  "date"            date                     NOT NULL,
  "driven_km"       numeric(10,2)            NOT NULL DEFAULT 0,
  "completed_stops" integer                  NOT NULL DEFAULT 0,
  "routes_served"   integer                  NOT NULL DEFAULT 0,
  "time_on_route"   interval,
  "generated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "daily_reports_driver_id_date_key" UNIQUE (driver_id, date),
  CONSTRAINT "daily_reports_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."daily_reports"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."locations" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "driver_id"   uuid                     NOT NULL,
  "route_id"    uuid,
  "lat"         numeric(10,7)            NOT NULL,
  "lng"         numeric(10,7)            NOT NULL,
  "speed"       numeric(6,2),
  "recorded_at" timestamp with time zone NOT NULL,
  "synced"      boolean                  NOT NULL DEFAULT false,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "locations_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."locations"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."notifications" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "sender_id"    uuid                     NOT NULL,
  "recipient_id" uuid                     NOT NULL,
  "route_id"     uuid,
  "message"      text                     NOT NULL,
  "read"         boolean                  NOT NULL DEFAULT false,
  "sent_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "notifications_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."notifications"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."routes" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "code"       text                     NOT NULL,
  "driver_id"  uuid                     NOT NULL,
  "vehicle_id" uuid,
  "created_by" uuid                     NOT NULL,
  "date"       date                     NOT NULL,
  "planned_km" numeric(10,2),
  "driven_km"  numeric(10,2)            DEFAULT 0,
  "start_time" timestamp with time zone,
  "end_time"   timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "routes_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."routes"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."stops" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "route_id"       uuid                     NOT NULL,
  "order_index"    integer                  NOT NULL,
  "customer_name"  bytea                    NOT NULL,
  "address"        bytea                    NOT NULL,
  "lat"            numeric(10,7)            NOT NULL,
  "lng"            numeric(10,7)            NOT NULL,
  "instructions"   text,
  "estimated_time" timestamp with time zone,
  "completed_time" timestamp with time zone,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "stops_pkey" PRIMARY KEY (id),
  CONSTRAINT "stops_route_id_order_index_key" UNIQUE (route_id, order_index)
);

ALTER TABLE "public"."stops"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."sync_queue" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     uuid                     NOT NULL,
  "event_type"  text                     NOT NULL,
  "payload"     jsonb                    NOT NULL,
  "synced"      boolean                  NOT NULL DEFAULT false,
  "recorded_at" timestamp with time zone NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "sync_queue_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."sync_queue"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."users" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "auth_user_id"   uuid                     NOT NULL,
  "name"           bytea                    NOT NULL,
  "active"         boolean                  NOT NULL DEFAULT true,
  "deactivated_at" timestamp with time zone,
  "deactivated_by" uuid,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "users_auth_user_id_key" UNIQUE (auth_user_id),
  CONSTRAINT "users_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."users"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."vehicles" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "plate"      text                     NOT NULL,
  "model"      text                     NOT NULL,
  "capacity"   integer,
  "active"     boolean                  NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "vehicles_pkey" PRIMARY KEY (id),
  CONSTRAINT "vehicles_plate_key" UNIQUE (plate)
);

ALTER TABLE "public"."vehicles"
  ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."audit_action" AS ENUM (
  'auth.login',
  'auth.login_failed',
  'auth.logout',
  'user.created',
  'user.deactivated',
  'route.created',
  'route.started',
  'route.finished',
  'stop.completed',
  'stop.delayed',
  'sync.completed',
  'access.denied'
);

ALTER TABLE "public"."audit_logs"
  ADD COLUMN "action" public.audit_action NOT NULL;

CREATE TYPE "public"."notification_type" AS ENUM (
  'info',
  'alert',
  'urgent'
);

ALTER TABLE "public"."notifications"
  ADD COLUMN "type" public.notification_type NOT NULL DEFAULT 'info'::public.notification_type;

CREATE TYPE "public"."route_status" AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'delayed',
  'cancelled'
);

ALTER TABLE "public"."routes"
  ADD COLUMN "status" public.route_status NOT NULL DEFAULT 'pending'::public.route_status;

CREATE TYPE "public"."stop_status" AS ENUM (
  'pending',
  'next',
  'completed',
  'delayed'
);

ALTER TABLE "public"."stops"
  ADD COLUMN "status" public.stop_status NOT NULL DEFAULT 'pending'::public.stop_status;

CREATE TYPE "public"."user_role" AS ENUM (
  'driver',
  'supervisor',
  'admin',
  'super_admin'
);

ALTER TABLE "public"."users"
  ADD COLUMN "role" public.user_role NOT NULL DEFAULT 'driver'::public.user_role;

CREATE OR REPLACE FUNCTION public.complete_stop_encrypted (
  p_id         uuid,
  p_secret_key text
)
  RETURNS TABLE (
    id             uuid,
    route_id       uuid,
    order_index    integer,
    customer_name  text,
    address        text,
    lat            numeric,
    lng            numeric,
    instructions   text,
    status         public.stop_status,
    estimated_time timestamp with time zone,
    completed_time timestamp with time zone,
    created_at     timestamp with time zone,
    updated_at     timestamp with time zone
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
BEGIN
    RETURN QUERY
    UPDATE public.stops SET status = 'completed', completed_time = NOW()
    WHERE stops.id = p_id AND stops.status <> 'completed'
    RETURNING stops.id, stops.route_id, stops.order_index,
              pgp_sym_decrypt(stops.customer_name, p_secret_key)::text,
              pgp_sym_decrypt(stops.address, p_secret_key)::text,
              stops.lat, stops.lng, stops.instructions, stops.status,
              stops.estimated_time, stops.completed_time,
              stops.created_at, stops.updated_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_stop_encrypted (
  p_route_id      uuid,
  p_order_index   integer,
  p_customer_name text,
  p_address       text,
  p_lat           numeric,
  p_lng           numeric,
  p_instructions  text,
  p_secret_key    text
)
  RETURNS TABLE (
    id             uuid,
    route_id       uuid,
    order_index    integer,
    lat            numeric,
    lng            numeric,
    instructions   text,
    status         public.stop_status,
    estimated_time timestamp with time zone,
    completed_time timestamp with time zone,
    created_at     timestamp with time zone,
    updated_at     timestamp with time zone
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
BEGIN
    RETURN QUERY
    INSERT INTO public.stops (route_id, order_index, customer_name, address, lat, lng, instructions)
    VALUES (p_route_id, p_order_index,
            pgp_sym_encrypt(p_customer_name, p_secret_key),
            pgp_sym_encrypt(p_address, p_secret_key),
            p_lat, p_lng, p_instructions)
    RETURNING stops.id, stops.route_id, stops.order_index, stops.lat, stops.lng,
              stops.instructions, stops.status, stops.estimated_time, stops.completed_time,
              stops.created_at, stops.updated_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_user_encrypted (
  p_auth_user_id uuid,
  p_name         text,
  p_role         public.user_role,
  p_secret_key   text
)
  RETURNS TABLE (
    id           uuid,
    auth_user_id uuid,
    role         public.user_role,
    active       boolean,
    created_at   timestamp with time zone,
    updated_at   timestamp with time zone
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
BEGIN
    RETURN QUERY
    INSERT INTO public.users (auth_user_id, name, role)
    VALUES (p_auth_user_id, pgp_sym_encrypt(p_name, p_secret_key), p_role)
    RETURNING users.id, users.auth_user_id, users.role, users.active, users.created_at, users.updated_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delay_stop_encrypted (
  p_id         uuid,
  p_secret_key text
)
  RETURNS TABLE (
    id             uuid,
    route_id       uuid,
    order_index    integer,
    customer_name  text,
    address        text,
    lat            numeric,
    lng            numeric,
    instructions   text,
    status         public.stop_status,
    estimated_time timestamp with time zone,
    completed_time timestamp with time zone,
    created_at     timestamp with time zone,
    updated_at     timestamp with time zone
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
BEGIN
    RETURN QUERY
    UPDATE public.stops SET status = 'delayed'
    WHERE stops.id = p_id AND stops.status <> 'completed'
    RETURNING stops.id, stops.route_id, stops.order_index,
              pgp_sym_decrypt(stops.customer_name, p_secret_key)::text,
              pgp_sym_decrypt(stops.address, p_secret_key)::text,
              stops.lat, stops.lng, stops.instructions, stops.status,
              stops.estimated_time, stops.completed_time,
              stops.created_at, stops.updated_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_role()
  RETURNS public.user_role
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
    SELECT role FROM public.users
    WHERE auth_user_id = auth.uid() LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_stops_readable (
  p_secret_key text
)
  RETURNS TABLE (
    id             uuid,
    route_id       uuid,
    order_index    integer,
    customer_name  text,
    address        text,
    lat            numeric,
    lng            numeric,
    instructions   text,
    status         public.stop_status,
    estimated_time timestamp with time zone,
    completed_time timestamp with time zone,
    created_at     timestamp with time zone,
    updated_at     timestamp with time zone
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
    SELECT id, route_id, order_index,
           pgp_sym_decrypt(customer_name, p_secret_key)::text AS customer_name,
           pgp_sym_decrypt(address, p_secret_key)::text AS address,
           lat, lng, instructions, status, estimated_time, completed_time,
           created_at, updated_at
    FROM public.stops;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
    SELECT id FROM public.users
    WHERE auth_user_id = auth.uid() LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_users_readable (
  p_secret_key text
)
  RETURNS TABLE (
    id             uuid,
    auth_user_id   uuid,
    name           text,
    role           public.user_role,
    active         boolean,
    deactivated_at timestamp with time zone,
    deactivated_by uuid,
    created_at     timestamp with time zone,
    updated_at     timestamp with time zone
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
    SELECT
        id,
        auth_user_id,
        pgp_sym_decrypt(name, p_secret_key)::text AS name,
        role,
        active,
        deactivated_at,
        deactivated_by,
        created_at,
        updated_at
    FROM public.users;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

ALTER TABLE "public"."locations"
  ADD CONSTRAINT "locations_route_id_fkey" FOREIGN KEY (route_id) REFERENCES public.routes(id);

ALTER TABLE "public"."notifications"
  ADD CONSTRAINT "notifications_route_id_fkey" FOREIGN KEY (route_id) REFERENCES public.routes(id);

ALTER TABLE "public"."stops"
  ADD CONSTRAINT "stops_route_id_fkey" FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE CASCADE;

ALTER TABLE "public"."users"
  ADD CONSTRAINT "users_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."audit_logs"
  ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE "public"."daily_reports"
  ADD CONSTRAINT "daily_reports_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES public.users(id);

ALTER TABLE "public"."locations"
  ADD CONSTRAINT "locations_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES public.users(id);

ALTER TABLE "public"."notifications"
  ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES public.users(id);

ALTER TABLE "public"."notifications"
  ADD CONSTRAINT "notifications_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES public.users(id);

ALTER TABLE "public"."routes"
  ADD CONSTRAINT "routes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE "public"."routes"
  ADD CONSTRAINT "routes_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES public.users(id);

ALTER TABLE "public"."sync_queue"
  ADD CONSTRAINT "sync_queue_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE "public"."users"
  ADD CONSTRAINT "users_deactivated_by_fkey" FOREIGN KEY (deactivated_by) REFERENCES public.users(id);

ALTER TABLE "public"."routes"
  ADD CONSTRAINT "routes_vehicle_id_fkey" FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);

CREATE INDEX idx_daily_reports_date ON public.daily_reports USING btree (date);

CREATE INDEX idx_daily_reports_driver_id ON public.daily_reports USING btree (driver_id);

CREATE INDEX idx_locations_driver_id ON public.locations USING btree (driver_id);

CREATE INDEX idx_locations_recorded_at ON public.locations USING btree (recorded_at);

CREATE INDEX idx_locations_route_id ON public.locations USING btree (route_id);

CREATE INDEX idx_locations_synced ON public.locations USING btree (synced);

CREATE INDEX idx_routes_date ON public.routes USING btree (date);

CREATE INDEX idx_routes_driver_date ON public.routes USING btree (driver_id, date);

CREATE INDEX idx_routes_driver_id ON public.routes USING btree (driver_id);

CREATE INDEX idx_routes_status ON public.routes USING btree (status);

CREATE INDEX idx_stops_route_id ON public.stops USING btree (route_id);

CREATE INDEX idx_stops_status ON public.stops USING btree (status);

CREATE INDEX idx_sync_queue_recorded_at ON public.sync_queue USING btree (recorded_at);

CREATE INDEX idx_sync_queue_synced ON public.sync_queue USING btree (synced);

CREATE INDEX idx_sync_queue_user_id ON public.sync_queue USING btree (user_id);

CREATE INDEX idx_users_active ON public.users USING btree (active);

CREATE INDEX idx_users_auth_user_id ON public.users USING btree (auth_user_id);

CREATE INDEX idx_users_role ON public.users USING btree (ROLE);

CREATE INDEX idx_vehicles_active ON public.vehicles USING btree (active);

CREATE INDEX idx_vehicles_plate ON public.vehicles USING btree (plate);

CREATE TRIGGER trg_audit_logs_updated_at
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_daily_reports_updated_at
  BEFORE UPDATE ON public.daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_routes_updated_at
  BEFORE UPDATE ON public.routes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_stops_updated_at
  BEFORE UPDATE ON public.stops
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_sync_queue_updated_at
  BEFORE UPDATE ON public.sync_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "routes_select_admin" ON "public"."routes"
  FOR SELECT
  TO PUBLIC
  USING ((public.get_role() = ANY (ARRAY['admin'::public.user_role, 'supervisor'::public.user_role, 'super_admin'::public.user_role])));

CREATE POLICY "routes_select_driver" ON "public"."routes"
  FOR SELECT
  TO PUBLIC
  USING ((driver_id = public.get_user_id()));

CREATE POLICY "routes_update_driver" ON "public"."routes"
  FOR UPDATE
  TO PUBLIC
  USING (((driver_id = public.get_user_id()) AND (public.get_role() = 'driver'::public.user_role)));

CREATE POLICY "routes_write_admin" ON "public"."routes"
  FOR ALL
  TO PUBLIC
  USING ((public.get_role() = ANY (ARRAY['admin'::public.user_role, 'supervisor'::public.user_role, 'super_admin'::public.user_role])));

CREATE POLICY "stops_select_admin" ON "public"."stops"
  FOR SELECT
  TO PUBLIC
  USING ((public.get_role() = ANY (ARRAY['admin'::public.user_role, 'supervisor'::public.user_role, 'super_admin'::public.user_role])));

CREATE POLICY "stops_select_driver" ON "public"."stops"
  FOR SELECT
  TO PUBLIC
  USING ((route_id IN ( SELECT routes.id
   FROM public.routes
  WHERE (routes.driver_id = public.get_user_id()))));

CREATE POLICY "stops_update_driver" ON "public"."stops"
  FOR UPDATE
  TO PUBLIC
  USING (((route_id IN ( SELECT routes.id
   FROM public.routes
  WHERE (routes.driver_id = public.get_user_id()))) AND (public.get_role() = 'driver'::public.user_role)));

CREATE POLICY "stops_write_admin" ON "public"."stops"
  FOR ALL
  TO PUBLIC
  USING ((public.get_role() = ANY (ARRAY['admin'::public.user_role, 'supervisor'::public.user_role, 'super_admin'::public.user_role])));

CREATE POLICY "users_select_admin" ON "public"."users"
  FOR SELECT
  TO PUBLIC
  USING ((public.get_role() = ANY (ARRAY['admin'::public.user_role, 'super_admin'::public.user_role])));

CREATE POLICY "users_select_self" ON "public"."users"
  FOR SELECT
  TO PUBLIC
  USING ((auth_user_id = auth.uid()));

CREATE POLICY "users_write_admin" ON "public"."users"
  FOR ALL
  TO PUBLIC
  USING ((public.get_role() = ANY (ARRAY['admin'::public.user_role, 'super_admin'::public.user_role])));

COMMENT ON EXTENSION "pg_cron" IS 'Job scheduler for PostgreSQL';

COMMENT ON TABLE "public"."notifications" IS 'Phase 2 — out of scope for the October 2026 MVP';

GRANT EXECUTE ON FUNCTION "public"."complete_stop_encrypted"(uuid, text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."create_stop_encrypted"(uuid, integer, text, text, numeric, numeric, text, text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."create_user_encrypted"(uuid, text, public.user_role, text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."delay_stop_encrypted"(uuid, text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_role"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_stops_readable"(text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_user_id"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_users_readable"(text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."audit_logs" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."daily_reports" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."locations" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notifications" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."routes" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stops" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sync_queue" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."users" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vehicles" TO "anon", "authenticated", "postgres", "service_role";

GRANT USAGE ON TYPE "public"."audit_action" TO "postgres";

GRANT USAGE ON TYPE "public"."notification_type" TO "postgres";

GRANT USAGE ON TYPE "public"."route_status" TO "postgres";

GRANT USAGE ON TYPE "public"."stop_status" TO "postgres";

GRANT USAGE ON TYPE "public"."user_role" TO "postgres";

SELECT cron.schedule_in_database('cleanup_audit_logs', '0 3 * * *', ' DELETE FROM public.audit_logs WHERE created_at < NOW() - INTERVAL ''90 days''; ', 'postgres', NULL, true);

