# Database schema changes — migrations, not manual SQL

Adopted 29 ago 2026 (session 17), riding along with TOR-91 (staging Supabase project)
while there was no real data in either database yet — see
`context/infra/deploy-plan-cicd.md` for the full context. Was originally deferred as
TOR-105 ("evaluate later"); done now because the cost of adopting migrations only grows
once real data and ad-hoc schema changes accumulate, and TOR-91 already produced a clean
full-schema snapshot to use as the baseline.

**From now on, schema changes are NOT applied by hand in Supabase's SQL Editor.** They go
through the Supabase CLI as tracked migration files in `supabase/migrations/`, applied to
both environments the same way.

## One-time setup already done

- `supabase/config.toml` — local CLI config (`project_id = "torpreca"`).
- `supabase/migrations/20260829231439_initial_schema.sql` — baseline migration, generated
  via `supabase db pull` against the production project. Represents the full schema as of
  that date (9 tables, 9 RPC functions, 5 enum types, 11 RLS policies). Already marked as
  "applied" in production's migration history (that's what `db pull` does — no need to
  push it there again), and applied to the staging project via `supabase db push`.

## Making a schema change going forward

1. `npx supabase link --project-ref <production-ref>` (once per machine/session — the CLI
   remembers it in `supabase/.temp/`, gitignored).
2. `npx supabase migration new <short-description>` — creates an empty, timestamped file
   in `supabase/migrations/`. Write the SQL by hand (`CREATE TABLE`, `ALTER TABLE`, new
   RPC function, etc.).
3. Apply it locally against whichever environment you're testing against first — usually
   staging: `npx supabase db push --db-url "<staging pooler connection string>"`.
4. Once verified, apply the same migration to production: `npx supabase db push` (targets
   the linked project, i.e. production) or `--db-url "<production connection string>"`.
5. Commit the migration file — it's the record of what ran where. Both environments
   should always be at the same migration version; if they drift, `supabase db push
   --dry-run` against each shows what's pending.

## Why not `supabase db diff` / editing via Studio first

`supabase db diff` (auto-generate a migration from changes made in the Supabase Studio
UI) is a valid alternative workflow, but starting with hand-written migration files (step
2 above) keeps the SQL Editor purely for querying/inspecting, not for schema changes —
avoids reintroducing the exact "changes exist nowhere but in the live DB" problem this
setup was meant to close.