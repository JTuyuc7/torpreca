import { callBackend, passthroughResponse } from "@/lib/backend/signed-fetch";

// GET /api/audit-logs — proxies GET /api/v1/audit-logs (super_admin-only,
// enforced backend-side; this BFF route just forwards the signature).
export async function GET(req: Request) {
  const res = await callBackend("/api/v1/audit-logs", {
    method: "GET",
    authorization: req.headers.get("authorization"),
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}
