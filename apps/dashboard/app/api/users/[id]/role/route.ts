import { callBackend, passthroughResponse } from "../../../../../lib/backend/signed-fetch";

// PATCH /api/users/:id/role — proxies PATCH /api/v1/users/:id/role
// (TOR-126: promotes/demotes a user past the pending-review step).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.text();

  const res = await callBackend(`/api/v1/users/${id}/role`, {
    method: "PATCH",
    authorization: req.headers.get("authorization"),
    clientIp: req.headers.get("x-forwarded-for"),
    body,
  });
  return passthroughResponse(res);
}
