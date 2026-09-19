import { getServerAccessToken } from "@/lib/auth/server-access-token";
import { callBackend, passthroughResponse } from "@/lib/backend/signed-fetch";

// POST /api/users/invite — proxies POST /api/v1/users/invite (TOR-125:
// self-service admin/supervisor creation via Supabase's invite-by-email).
export async function POST(req: Request) {
  const token = await getServerAccessToken();
  if (!token) return new Response(null, { status: 401 });

  const body = await req.text();

  const res = await callBackend("/api/v1/users/invite", {
    method: "POST",
    authorization: `Bearer ${token}`,
    clientIp: req.headers.get("x-forwarded-for"),
    body,
  });
  return passthroughResponse(res);
}
