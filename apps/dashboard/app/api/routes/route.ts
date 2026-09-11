import { callBackend, passthroughResponse } from "@/lib/backend/signed-fetch";

// GET /api/routes — proxies GET /api/v1/routes.
export async function GET(req: Request) {
  const { search } = new URL(req.url);
  const res = await callBackend(`/api/v1/routes${search}`, {
    method: "GET",
    authorization: req.headers.get("authorization"),
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}

// POST /api/routes — proxies POST /api/v1/routes (create + assign driver/vehicle).
export async function POST(req: Request) {
  const body = await req.text();

  const res = await callBackend("/api/v1/routes", {
    method: "POST",
    authorization: req.headers.get("authorization"),
    clientIp: req.headers.get("x-forwarded-for"),
    body,
  });
  return passthroughResponse(res);
}