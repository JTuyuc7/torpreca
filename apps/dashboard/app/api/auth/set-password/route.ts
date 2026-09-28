import { SetPasswordSchema } from "@/lib/auth/set-password-schema";
import { resolveAuthUser } from "@/lib/auth/resolve-auth-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// POST /api/auth/set-password — completes the invite flow started by
// GET /auth/confirm: that route already landed a valid (passwordless)
// session in the httpOnly cookie via verifyOtp, so this only needs
// auth.updateUser({ password }) against that same cookie-backed client,
// then resolves the role exactly like /api/auth/login does so the caller
// can drop straight into the app afterwards.
export async function POST(req: Request) {
  const clientIp = req.headers.get("x-forwarded-for");
  const body = await req.json().catch(() => null);
  const parsed = SetPasswordSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return new Response(null, { status: 401 });

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (updateError) return new Response(null, { status: 400 });

  const result = await resolveAuthUser(clientIp);
  if (!result.ok) {
    await supabase.auth.signOut();
    return new Response(null, { status: result.status });
  }

  return Response.json(result.user);
}
