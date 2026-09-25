import { getServerAccessToken } from "@/lib/auth/server-access-token";
import { callBackend, passthroughResponse } from "@/lib/backend/signed-fetch";

// PATCH /api/routes/:id/stops/order — proxies PATCH
// /api/v1/routes/:routeId/stops/order (body: { stopIds } in the new order).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getServerAccessToken();
  if (!token) return new Response(null, { status: 401 });

  const { id } = await params;
  const body = await req.text();

  const res = await callBackend(`/api/v1/routes/${id}/stops/order`, {
    method: "PATCH",
    authorization: `Bearer ${token}`,
    clientIp: req.headers.get("x-forwarded-for"),
    body,
  });
  return passthroughResponse(res);
}
