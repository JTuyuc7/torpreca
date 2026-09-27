import { getServerAccessToken } from "@/lib/auth/server-access-token";
import { callBackend, passthroughResponse } from "@/lib/backend/signed-fetch";

// PATCH /api/routes/:id/close — proxies PATCH /api/v1/routes/:id/close
// (close an overdue in-progress route as cancelled).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getServerAccessToken();
  if (!token) return new Response(null, { status: 401 });

  const { id } = await params;

  const res = await callBackend(`/api/v1/routes/${id}/close`, {
    method: "PATCH",
    authorization: `Bearer ${token}`,
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}
