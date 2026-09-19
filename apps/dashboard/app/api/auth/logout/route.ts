import { getServerAccessToken } from "@/lib/auth/server-access-token";
import { callBackend } from "@/lib/backend/signed-fetch";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// POST /api/auth/logout (TOR-124) — was a passthrough that needed the
// browser to supply its Bearer token; now reads it from the httpOnly cookie
// and also does the actual supabase.auth.signOut() here (the browser has no
// Supabase client left to call it with), which clears the cookie via the
// Set-Cookie the server client writes.
export async function POST(req: Request) {
  const token = await getServerAccessToken();

  if (token) {
    await callBackend("/api/v1/auth/logout", {
      method: "POST",
      authorization: `Bearer ${token}`,
      clientIp: req.headers.get("x-forwarded-for"),
    });
  }

  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  return new Response(null, { status: 204 });
}
