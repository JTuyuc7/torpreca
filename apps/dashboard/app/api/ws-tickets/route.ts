import { getServerAccessToken } from "@/lib/auth/server-access-token";
import { callBackend, passthroughResponse } from "@/lib/backend/signed-fetch";

// POST /api/ws-tickets — proxies POST /api/v1/ws-tickets. Mints a short-lived,
// single-use ticket the browser then attaches as a query param on the direct
// WebSocket connection to the backend (see lib/hooks/use-live-locations.ts) —
// the JWT itself never travels in a WS URL.
export async function POST(req: Request) {
  const token = await getServerAccessToken();
  if (!token) return new Response(null, { status: 401 });

  const res = await callBackend("/api/v1/ws-tickets", {
    method: "POST",
    authorization: `Bearer ${token}`,
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}
