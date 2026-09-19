import { getServerAccessToken } from "@/lib/auth/server-access-token";
import { callBackend, passthroughResponse } from "../../../../lib/backend/signed-fetch";

// GET /api/users/:id — proxies GET /api/v1/users/:id.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getServerAccessToken();
  if (!token) return new Response(null, { status: 401 });

  const { id } = await params;

  const res = await callBackend(`/api/v1/users/${id}`, {
    method: "GET",
    authorization: `Bearer ${token}`,
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}

// DELETE /api/users/:id — proxies DELETE /api/v1/users/:id (deactivates the
// user; backend has no hard-delete for `users`).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getServerAccessToken();
  if (!token) return new Response(null, { status: 401 });

  const { id } = await params;

  const res = await callBackend(`/api/v1/users/${id}`, {
    method: "DELETE",
    authorization: `Bearer ${token}`,
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}
