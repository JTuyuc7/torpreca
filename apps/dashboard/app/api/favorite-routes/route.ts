import { callBackend, passthroughResponse } from "@/lib/backend/signed-fetch";

// GET /api/favorite-routes — proxies GET /api/v1/favorite-routes.
export async function GET(req: Request) {
  const res = await callBackend("/api/v1/favorite-routes", {
    method: "GET",
    authorization: req.headers.get("authorization"),
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}

// POST /api/favorite-routes — proxies POST /api/v1/favorite-routes (save a
// calculated A→B pair from the "Calcular en mapa" modal, TOR-127).
export async function POST(req: Request) {
  const body = await req.text();

  const res = await callBackend("/api/v1/favorite-routes", {
    method: "POST",
    authorization: req.headers.get("authorization"),
    clientIp: req.headers.get("x-forwarded-for"),
    body,
  });
  return passthroughResponse(res);
}
