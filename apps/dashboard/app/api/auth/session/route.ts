import { resolveAuthUser } from "@/lib/auth/resolve-auth-user";

// GET /api/auth/session (TOR-124) — was POST + a client-supplied Bearer
// token; now reads the session straight from the httpOnly cookie, so the
// protected layout can just `fetch()` this with no headers to build. Called
// on every (protected) layout mount that isn't already served by the
// sessionStorage cache (lib/auth/session-cache.ts).
export async function GET(req: Request) {
  const result = await resolveAuthUser(req.headers.get("x-forwarded-for"));
  if (!result.ok) return new Response(null, { status: result.status });
  return Response.json(result.user);
}
