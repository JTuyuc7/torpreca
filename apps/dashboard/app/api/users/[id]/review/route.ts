import { getServerAccessToken } from "@/lib/auth/server-access-token";
import { callBackend, passthroughResponse } from "@/lib/backend/signed-fetch";

// PATCH /api/users/:id/review — proxies PATCH /api/v1/users/:id/review
// (approve/reject a pending driver registration).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getServerAccessToken();
  if (!token) return new Response(null, { status: 401 });

  const { id } = await params;
  const body = await req.text();

  const res = await callBackend(`/api/v1/users/${id}/review`, {
    method: "PATCH",
    authorization: `Bearer ${token}`,
    clientIp: req.headers.get("x-forwarded-for"),
    body,
  });
  return passthroughResponse(res);
}
