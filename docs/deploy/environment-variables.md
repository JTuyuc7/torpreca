# Environment variables — staging vs production

Runbook for the 4 Render services (backend + dashboard, staging + production — see
`context/infra/deploy-plan-cicd.md` for the full CI/CD design). All values below live
**only in each Render service's own env var settings** — GitHub Actions never needs any
of them, it doesn't run the apps, it only triggers deploys.

## Which service tracks which branch

| Service | Branch | Env vars set here |
|---|---|---|
| `torpreca-backend-staging` | `main` | Backend staging |
| `torpreca-backend-production` | `release` | Backend production |
| `torpreca-dashboard-staging` | `main` | Dashboard staging |
| `torpreca-dashboard-production` | `release` | Dashboard production |

## Backend (both environments)

Schema enforced by `apps/backend/src/core/config/env.ts` — the process fails at boot if
any of these is missing or malformed:

| Variable | Type | Notes |
|---|---|---|
| `SUPABASE_URL` | plain | Different value per environment — points at the staging or production Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Different per environment |
| `SECRET_KEY` | **Secret** | pgcrypto key for `pgp_sym_encrypt`/`pgp_sym_decrypt` — different per environment (staging and production must never share this) |
| `REQUEST_SIGNING_SECRET` | **Secret** | ⚠️ See "Keeping REQUEST_SIGNING_SECRET in sync" below |
| `PORT` | plain | Leave unset — Render injects its own `PORT` and the schema only falls back to `3000` when unset (local dev) |
| `ALLOWED_ORIGINS` | plain | ⚠️ Must be the dashboard's URL **for that same environment** — see "Common mistake" below |

## Dashboard (both environments)

| Variable | Type | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | plain, public | Same value as that environment's backend `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | plain, public | anon key only — never the service role key |
| `NEXT_PUBLIC_BACKEND_URL` | plain, public | Points at `torpreca-backend-staging`/`-production`'s URL for that same environment |
| `REQUEST_SIGNING_SECRET` | **Secret** | Server-only (read in `lib/backend/signed-fetch.ts`, never exposed to the browser) — must be byte-identical to the backend's value in the same environment, see below |

## Keeping `REQUEST_SIGNING_SECRET` in sync (highest-risk step, no automated guard)

The backend verifies HMAC signatures with this secret; the dashboard's BFF route handlers
(`app/api/auth/*`) sign every backend call with it. **It must be byte-identical between
the backend and dashboard service of the same environment** — staging↔staging,
production↔production — but the two environments must use *different* values from each
other.

- Generate with `openssl rand -hex 32`.
- Recommended: create a Render **Environment Group** per environment by hand in the
  dashboard (`Environment > Env Groups` — `torpreca-staging-shared`,
  `torpreca-production-shared`), add this one variable there, and attach the group to
  both services of that environment. This is a dashboard-level construct, not something
  `render.yaml` declares (an earlier version of this file tried to define
  `envVarGroups` in the Blueprint itself — Render's validator rejected that field on
  `Service`, so each service in `render.yaml` just lists `REQUEST_SIGNING_SECRET`
  individually; the Env Group is what actually keeps the *value* from drifting).
- If skipping the Env Group and setting it per-service instead: update both services in
  the same maintenance window, and
  expect every `/api/auth/*` request to fail with a signature error on the dashboard
  until both sides match again.

## Common mistake: `ALLOWED_ORIGINS`

Staging and production **must have different `ALLOWED_ORIGINS`** — each backend only
allows CORS requests from its own environment's dashboard origin. Copying production's
value into staging (or vice versa) breaks CORS silently for whichever dashboard doesn't
match.

## Marking variables as "Secret" in Render

Render distinguishes plain env vars from secret-flagged ones (masked in logs/UI, excluded
from `render.yaml`'s plaintext `envVars` list — declared there with `sync: false`
instead, which prompts for the value once per service). Mark at minimum:
`SUPABASE_SERVICE_ROLE_KEY`, `SECRET_KEY`, `REQUEST_SIGNING_SECRET`. These are the values
most likely to get pasted into a plain field by habit since they don't look like a
typical "API key."

## Local development

Local dev still uses `apps/backend/.env` / `apps/dashboard/.env.local` (gitignored,
`template.env` at the repo root documents the current backend schema). Nothing above
changes local dev — this runbook only covers the two deployed environments.