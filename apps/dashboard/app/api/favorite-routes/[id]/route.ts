import { getServerAccessToken } from "@/lib/auth/server-access-token";
import { callBackend, passthroughResponse } from "@/lib/backend/signed-fetch";

// DELETE /api/favorite-routes/:id — proxies DELETE /api/v1/favorite-routes/:id.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getServerAccessToken();
  if (!token) return new Response(null, { status: 401 });

  const { id } = await params;

  const res = await callBackend(`/api/v1/favorite-routes/${id}`, {
    method: "DELETE",
    authorization: `Bearer ${token}`,
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}
