import { callBackend, passthroughResponse } from "../../../lib/backend/signed-fetch";

// GET /api/users?status=pending|all — proxies GET /api/v1/users on the real
// backend, forwarding the query string as-is (status=pending powers the
// driver approval queue; status=all powers "Gestión de usuarios").
export async function GET(req: Request) {
  const { search } = new URL(req.url);
  const res = await callBackend(`/api/v1/users${search}`, {
    method: "GET",
    authorization: req.headers.get("authorization"),
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}

// POST /api/users — proxies POST /api/v1/users (links an existing Supabase
// Auth user to a new `users` profile row; see the scope note on TOR-42).
export async function POST(req: Request) {
  const body = await req.text();

  const res = await callBackend("/api/v1/users", {
    method: "POST",
    authorization: req.headers.get("authorization"),
    clientIp: req.headers.get("x-forwarded-for"),
    body,
  });
  return passthroughResponse(res);
}