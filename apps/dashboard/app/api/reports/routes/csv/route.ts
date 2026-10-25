import { getServerAccessToken } from "@/lib/auth/server-access-token";
import { callBackend, passthroughResponse } from "@/lib/backend/signed-fetch";

// GET /api/reports/routes/csv — proxies GET /api/v1/reports/routes/csv. The
// browser saves the body itself (reports-client.ts names the file), so only
// the content type needs to travel back.
export async function GET(req: Request) {
  const token = await getServerAccessToken();
  if (!token) return new Response(null, { status: 401 });

  const { search } = new URL(req.url);
  const res = await callBackend(`/api/v1/reports/routes/csv${search}`, {
    method: "GET",
    authorization: `Bearer ${token}`,
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}
