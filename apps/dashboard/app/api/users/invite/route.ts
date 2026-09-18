import { callBackend, passthroughResponse } from "../../../../lib/backend/signed-fetch";

// POST /api/users/invite — proxies POST /api/v1/users/invite (TOR-125:
// self-service admin/supervisor creation via Supabase's invite-by-email).
export async function POST(req: Request) {
  const body = await req.text();

  const res = await callBackend("/api/v1/users/invite", {
    method: "POST",
    authorization: req.headers.get("authorization"),
    clientIp: req.headers.get("x-forwarded-for"),
    body,
  });
  return passthroughResponse(res);
}
