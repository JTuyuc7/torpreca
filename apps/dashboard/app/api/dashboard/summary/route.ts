import { callBackend, passthroughResponse } from "@/lib/backend/signed-fetch";

// GET /api/dashboard/summary — proxies GET /api/v1/dashboard/summary.
export async function GET(req: Request) {
  const res = await callBackend("/api/v1/dashboard/summary", {
    method: "GET",
    authorization: req.headers.get("authorization"),
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}