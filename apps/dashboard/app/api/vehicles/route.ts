import { callBackend, passthroughResponse } from "@/lib/backend/signed-fetch";

// GET /api/vehicles — proxies GET /api/v1/vehicles. `?all=true` lifts the
// active-only default (used by "Gestión de vehículos", TOR-44, to also show
// deactivated ones); the assignment dropdown in "Gestión de rutas" (TOR-30)
// calls it with no query, getting only active vehicles.
export async function GET(req: Request) {
  const { search } = new URL(req.url);
  const res = await callBackend(`/api/v1/vehicles${search}`, {
    method: "GET",
    authorization: req.headers.get("authorization"),
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}

// POST /api/vehicles — proxies POST /api/v1/vehicles (create).
export async function POST(req: Request) {
  const body = await req.text();

  const res = await callBackend("/api/v1/vehicles", {
    method: "POST",
    authorization: req.headers.get("authorization"),
    clientIp: req.headers.get("x-forwarded-for"),
    body,
  });
  return passthroughResponse(res);
}