import { callBackend, passthroughResponse } from "@/lib/backend/signed-fetch";

// GET /api/locations/latest — proxies GET /api/v1/locations/latest (initial
// snapshot for the live map; the WebSocket connection takes over from there).
export async function GET(req: Request) {
  const res = await callBackend("/api/v1/locations/latest", {
    method: "GET",
    authorization: req.headers.get("authorization"),
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}