import { supabase } from "./client";

// Shared by every data-fetching hook (lib/hooks/*) — each query/mutation
// needs the current Supabase access token to call this app's /api/* BFF
// routes. Throwing (instead of returning null) lets TanStack Query surface
// "no session" the same way as any other query/mutation failure, through its
// own error state, instead of every hook re-implementing that branch.
export async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sesión expirada. Recarga la página.");
  return session.access_token;
}