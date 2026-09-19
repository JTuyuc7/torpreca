import { createServerSupabaseClient } from "@/lib/supabase/server";

// Used by every /api/* BFF route handler that proxies to the backend (users,
// vehicles, routes, favorite-routes, audit-logs, locations, dashboard
// summary, ws-tickets) to resolve the caller's access token from the
// httpOnly session cookie, instead of trusting a client-supplied
// Authorization header — the browser has no Supabase client of its own and
// never holds the token to attach one (TOR-124).
export async function getServerAccessToken(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
