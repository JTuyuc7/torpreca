-- Adds `email` to `public.users` so the dashboard's "Gestión de usuarios"
-- screen (TOR-42) can disambiguate two people with the same display name and
-- link a pending self-registration without copy-pasting an authUserId.
-- Email already lives in `auth.users` (Supabase Auth) but wasn't denormalized
-- here — a live admin.getUserById() lookup per row on every list request was
-- considered and rejected in favor of this column: cheaper to query, and both
-- write paths (mobile self-registration, admin-created accounts) already
-- know the email at creation time.

ALTER TABLE public.users ADD COLUMN email text;

-- Backfill from auth.users via the FK relationship — correct by
-- construction, no guessing at real addresses.
UPDATE public.users u
SET email = a.email
FROM auth.users a
WHERE a.id = u.auth_user_id;

ALTER TABLE public.users ALTER COLUMN email SET NOT NULL;

-- create_user_encrypted: new required p_email. Must be declared before
-- p_status (the only parameter with a default) — Postgres requires
-- defaulted parameters to trail non-defaulted ones in the declaration,
-- independent of the fact that every caller already uses named-argument
-- notation. Return columns are unchanged (email isn't part of the RPC's
-- RETURNS TABLE — same pattern already used for `name`: the caller merges
-- its own input value into the returned User client-side).
DROP FUNCTION IF EXISTS public.create_user_encrypted(uuid, text, public.user_role, text, public.user_status);

CREATE FUNCTION public.create_user_encrypted (
  p_auth_user_id uuid,
  p_name         text,
  p_role         public.user_role,
  p_secret_key   text,
  p_email        text,
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
    INSERT INTO public.users (auth_user_id, name, role, status, email)
    VALUES (p_auth_user_id, extensions.pgp_sym_encrypt(p_name, p_secret_key), p_role, p_status, p_email)
    RETURNING users.id, users.auth_user_id, users.role, users.status, users.created_at, users.updated_at;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."create_user_encrypted"(uuid, text, public.user_role, text, text, public.user_status)
  TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

-- get_users_readable: expose email. pgp_sym_decrypt is schema-qualified
-- (extensions.pgp_sym_decrypt) — a LANGUAGE sql function body is planned
-- eagerly at CREATE time (unlike plpgsql, checked only at first call), so it
-- needs `extensions` resolvable in the *migration session's* search_path,
-- which isn't guaranteed to match the runtime search_path Supabase gives
-- PostgREST connections. Qualifying it removes the dependency either way —
-- discovered when `supabase db push` failed with "function
-- pgp_sym_decrypt(bytea, text) does not exist" on this exact statement.
DROP FUNCTION IF EXISTS public.get_users_readable(text);

CREATE FUNCTION public.get_users_readable (
  p_secret_key text
)
  RETURNS TABLE (
    id             uuid,
    auth_user_id   uuid,
    name           text,
    email          text,
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
        extensions.pgp_sym_decrypt(name, p_secret_key)::text AS name,
        email,
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