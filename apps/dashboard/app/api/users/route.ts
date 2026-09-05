import { callBackend, passthroughResponse } from "../../../lib/backend/signed-fetch";

// GET /api/users?status=pending — proxies GET /api/v1/users on the real
// backend, forwarding the query string as-is (status=pending powers the
// driver approval queue; see the self-signup design doc).
export async function GET(req: Request) {
  const { search } = new URL(req.url);
  const res = await callBackend(`/api/v1/users${search}`, {
    method: "GET",
    authorization: req.headers.get("authorization"),
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}