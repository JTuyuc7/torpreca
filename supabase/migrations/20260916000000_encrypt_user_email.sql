-- Found 16 sep 2026 reviewing the DB directly: `users.email` (added in
-- 20260908203000_add_user_email.sql) was never encrypted — only `name` was.
-- CLAUDE.md only ever said "Encriptar nombre"; email slipped in as plain
-- `text` with no note that skipping encryption there was a deliberate call.
-- It's PII same as name, so this closes that gap.
--
-- Zero-downtime, staged rollout (existing rows already hold real emails in
-- plain text on staging/production — this can't be a single destructive
-- ALTER):
--   1. This migration adds `email_encrypted bytea` alongside the existing
--      plain `email` column, and updates both RPCs to write/read the new
--      column going forward — `get_users_readable` falls back to the plain
--      column via COALESCE for any row not yet migrated, so nothing breaks
--      before the backfill runs.
--   2. Immediately after this migration is applied to an environment, run
--      once (Supabase SQL editor, with that environment's real SECRET_KEY —
--      never put the actual key in a migration file or commit it):
--        SELECT public.backfill_encrypt_user_emails('<SECRET_KEY>');
--      Safe to re-run — it only touches rows where email_encrypted IS NULL.
--   3. A follow-up migration (once the backfill is confirmed on every
--      environment, including production) drops the plain `email` column.
--      Not done here on purpose — dropping it in the same migration that
--      introduces the encrypted one would leave no fallback if the backfill
--      step gets missed on some environment.

ALTER TABLE public.users ADD COLUMN email_encrypted bytea;

CREATE FUNCTION public.backfill_encrypt_user_emails(p_secret_key text)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.users
  SET email_encrypted = extensions.pgp_sym_encrypt(email, p_secret_key)
  WHERE email_encrypted IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.backfill_encrypt_user_emails(text)
  TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

-- create_user_encrypted: encrypt p_email into email_encrypted too, same as
-- p_name. The plain `email` column is still written for now (dropped in the
-- follow-up migration once every environment is confirmed backfilled).
-- Signature/RETURNS TABLE are unchanged, so CREATE OR REPLACE is enough —
-- unlike the registration-status migration, no DROP FUNCTION needed here.
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
    INSERT INTO public.users (auth_user_id, name, role, status, email, email_encrypted)
    VALUES (
      p_auth_user_id,
      extensions.pgp_sym_encrypt(p_name, p_secret_key),
      p_role,
      p_status,
      p_email,
      extensions.pgp_sym_encrypt(p_email, p_secret_key)
    )
    RETURNING users.id, users.auth_user_id, users.role, users.status, users.created_at, users.updated_at;
END;
$function$;

-- get_users_readable: decrypt email_encrypted when present, falling back to
-- the plain column for any row not yet backfilled — see the rollout note
-- above. Return shape is unchanged (email was already `text`).
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
        COALESCE(extensions.pgp_sym_decrypt(email_encrypted, p_secret_key)::text, email) AS email,
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
