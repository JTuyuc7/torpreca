-- Adds explicit approval-state tracking for driver self-registration
-- (Notion: "Diseño — Auto-registro de conductores (self-signup)", 20-21 ago
-- 2026; implemented 05 sep 2026 as TOR-84/85). `status` replaces the
-- active-boolean-based gating in core/middleware/auth.ts — it becomes the
-- single source of truth for whether a user can authenticate, instead of
-- inferring it from a combination of `active`/`deactivated_at`.

CREATE TYPE public.user_status AS ENUM ('pending', 'active', 'rejected', 'deactivated');

ALTER TABLE public.users
  ADD COLUMN status public.user_status NOT NULL DEFAULT 'active'::public.user_status,
  ADD COLUMN reviewed_at timestamp with time zone,
  ADD COLUMN reviewed_by uuid;

-- Backfill existing rows from the boolean column this replaces.
UPDATE public.users SET status = 'deactivated'::public.user_status WHERE active = false;

-- `active` is now redundant — keeping both would reintroduce the exact
-- ambiguity `status` was introduced to remove.
ALTER TABLE public.users DROP COLUMN active;

-- New audit events for the self-registration + approval flow (see
-- packages/shared/src/constants/audit-events.ts, must stay in sync).
ALTER TYPE public.audit_action ADD VALUE 'auth.registered';
ALTER TYPE public.audit_action ADD VALUE 'user.approved';
ALTER TYPE public.audit_action ADD VALUE 'user.rejected';

-- create_user_encrypted / get_users_readable: both change their RETURNS
-- TABLE column list (drop `active`, add `status`/`reviewed_at`/`reviewed_by`)
-- — Postgres rejects that via CREATE OR REPLACE ("cannot change return type
-- of existing function"), so both are dropped and recreated instead. Grants
-- don't survive a drop, so both re-grant explicitly below.
DROP FUNCTION IF EXISTS public.create_user_encrypted(uuid, text, public.user_role, text);
DROP FUNCTION IF EXISTS public.get_users_readable(text);

-- New optional p_status (defaults to 'active', so the existing admin-created
-- path via POST /users needs no code change). The new self-registration
-- path passes 'pending' explicitly.
CREATE FUNCTION public.create_user_encrypted (
  p_auth_user_id uuid,
  p_name         text,
  p_role         public.user_role,
  p_secret_key   text,
  p_status       public.user_status DEFAULT 'active'
)
  RETURNS TABLE (
    id           uuid,
    auth_user_id uuid,
    role         public.user_role,
    status       public.user_status,
    created_at   timestamp with time zone,
    updated_at   timestamp with time zone
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
BEGIN
    RETURN QUERY
    INSERT INTO public.users (auth_user_id, name, role, status)
    VALUES (p_auth_user_id, pgp_sym_encrypt(p_name, p_secret_key), p_role, p_status)
    RETURNING users.id, users.auth_user_id, users.role, users.status, users.created_at, users.updated_at;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."create_user_encrypted"(uuid, text, public.user_role, text, public.user_status)
  TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

-- get_users_readable: expose status/reviewed_at/reviewed_by, drop active.
CREATE FUNCTION public.get_users_readable (
  p_secret_key text
)
  RETURNS TABLE (
    id             uuid,
    auth_user_id   uuid,
    name           text,
    role           public.user_role,
    status         public.user_status,
    deactivated_at timestamp with time zone,
    deactivated_by uuid,
    reviewed_at    timestamp with time zone,
    reviewed_by    uuid,
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
        status,
        deactivated_at,
        deactivated_by,
        reviewed_at,
        reviewed_by,
        created_at,
        updated_at
    FROM public.users;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_users_readable"(text)
  TO PUBLIC, "anon", "authenticated", "postgres", "service_role";