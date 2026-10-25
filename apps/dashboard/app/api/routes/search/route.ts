import { getServerAccessToken } from "@/lib/auth/server-access-token";
import { callBackend, passthroughResponse } from "@/lib/backend/signed-fetch";

// GET /api/routes/search — proxies GET /api/v1/routes/search (filtered, paged
// list of the Rutas table). The query string carries every filter, so it has
// to be forwarded as is.
export async function GET(req: Request) {
  const token = await getServerAccessToken();
  if (!token) return new Response(null, { status: 401 });

  const { search } = new URL(req.url);
  const res = await callBackend(`/api/v1/routes/search${search}`, {
    method: "GET",
    authorization: `Bearer ${token}`,
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}
