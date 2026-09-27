-- Follow-up to 20260916000000_encrypt_user_email.sql — step 3 of that
-- migration's rollout plan. Confirmed via a read-only count query against
-- both staging and production (16 sep 2026) that every row already has
-- email_encrypted populated (0 missing on either environment) before
-- writing this: safe to drop the plain fallback now.

-- create_user_encrypted: stop writing the plain column. Signature/RETURNS
-- TABLE unchanged, so CREATE OR REPLACE is enough.
CREATE OR REPLACE FUNCTION public.create_user_encrypted (
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
    INSERT INTO public.users (auth_user_id, name, role, status, email_encrypted)
    VALUES (
      p_auth_user_id,
      extensions.pgp_sym_encrypt(p_name, p_secret_key),
      p_role,
      p_status,
      extensions.pgp_sym_encrypt(p_email, p_secret_key)
    )
    RETURNING users.id, users.auth_user_id, users.role, users.status, users.created_at, users.updated_at;
END;
$function$;

-- get_users_readable: no more COALESCE fallback — email_encrypted is the
-- only source now.
CREATE OR REPLACE FUNCTION public.get_users_readable (
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
        extensions.pgp_sym_decrypt(email_encrypted, p_secret_key)::text AS email,
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

-- Now safe to drop — nothing reads or writes it anymore.
ALTER TABLE public.users DROP COLUMN email;

-- email_encrypted keeps its name (not renamed back to `email`) — renaming a
-- bytea column to the name a lot of tooling/muscle-memory expects as plain
-- text risks someone re-introducing a plain-text write path by mistake.
