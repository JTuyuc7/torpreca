import { callBackend, passthroughResponse } from "@/lib/backend/signed-fetch";

// GET /api/vehicles — proxies GET /api/v1/vehicles. Powers the vehicle
// dropdown in "Gestión de rutas" (TOR-30); the full vehicle CRUD screen is
// TOR-44, not yet built.
export async function GET(req: Request) {
  const { search } = new URL(req.url);
  const res = await callBackend(`/api/v1/vehicles${search}`, {
    method: "GET",
    authorization: req.headers.get("authorization"),
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}