import { getServerAccessToken } from "@/lib/auth/server-access-token";
import { callBackend, passthroughResponse } from "@/lib/backend/signed-fetch";

// GET /api/preferences — proxies GET /api/v1/users/me/preferences.
export async function GET(req: Request) {
  const token = await getServerAccessToken();
  if (!token) return new Response(null, { status: 401 });

  const res = await callBackend("/api/v1/users/me/preferences", {
    method: "GET",
    authorization: `Bearer ${token}`,
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}

// PATCH /api/preferences — proxies PATCH /api/v1/users/me/preferences.
export async function PATCH(req: Request) {
  const token = await getServerAccessToken();
  if (!token) return new Response(null, { status: 401 });

  const body = await req.text();

  const res = await callBackend("/api/v1/users/me/preferences", {
    method: "PATCH",
    authorization: `Bearer ${token}`,
    clientIp: req.headers.get("x-forwarded-for"),
    body,
  });
  return passthroughResponse(res);
}
