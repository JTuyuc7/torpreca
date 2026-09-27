import { getServerAccessToken } from "@/lib/auth/server-access-token";
import { callBackend, passthroughResponse } from "@/lib/backend/signed-fetch";

// POST /api/routes/:id/duplicate — proxies POST /api/v1/routes/:id/duplicate
// (create a pending route, with the given stops, modelled on another route).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getServerAccessToken();
  if (!token) return new Response(null, { status: 401 });

  const { id } = await params;
  const body = await req.text();

  const res = await callBackend(`/api/v1/routes/${id}/duplicate`, {
    method: "POST",
    authorization: `Bearer ${token}`,
    clientIp: req.headers.get("x-forwarded-for"),
    body,
  });
  return passthroughResponse(res);
}
