import { LoginSchema } from "@/lib/auth/login-schema";
import { resolveAuthUser } from "@/lib/auth/resolve-auth-user";
import { callBackend } from "@/lib/backend/signed-fetch";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// POST /api/auth/login (TOR-124) — replaces the old flow where the browser
// called supabase.auth.signInWithPassword() itself and then POSTed the
// resulting token to /api/auth/session. Both steps now happen server-side:
// this route signs in against Supabase directly, which lands the session in
// an httpOnly cookie via lib/supabase/server.ts, then resolves the role via
// the backend exactly like /api/auth/session did. The browser only ever
// gets the resolved AuthUser back — it never sees the JWT.
export async function POST(req: Request) {
  const clientIp = req.headers.get("x-forwarded-for");
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });

  const { email, password } = parsed.data;
  const supabase = await createServerSupabaseClient();
  const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError || !data.session) {
    await callBackend("/api/v1/auth/login-failed", {
      method: "POST",
      body: JSON.stringify({ email }),
      clientIp,
    });
    return new Response(null, { status: 401 });
  }

  const result = await resolveAuthUser(clientIp);
  if (!result.ok) {
    // Rejected role (403) or a backend hiccup — either way the Supabase
    // session this route just created shouldn't be left standing.
    await supabase.auth.signOut();
    return new Response(null, { status: result.status });
  }

  return Response.json(result.user);
}
