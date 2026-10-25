import { getServerAccessToken } from "@/lib/auth/server-access-token";
import { callBackend, passthroughResponse } from "@/lib/backend/signed-fetch";

// GET /api/reports/routes — proxies GET /api/v1/reports/routes (admin,
// supervisor and super_admin only, enforced backend-side). The query string
// carries the date range, so it has to be forwarded as is.
export async function GET(req: Request) {
  const token = await getServerAccessToken();
  if (!token) return new Response(null, { status: 401 });

  const { search } = new URL(req.url);
  const res = await callBackend(`/api/v1/reports/routes${search}`, {
    method: "GET",
    authorization: `Bearer ${token}`,
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}
