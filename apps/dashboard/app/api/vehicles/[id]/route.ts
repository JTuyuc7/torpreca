import { callBackend, passthroughResponse } from "../../../../lib/backend/signed-fetch";

// PATCH /api/vehicles/:id — proxies PATCH /api/v1/vehicles/:id (edit fields,
// or reactivate via { active: true }).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.text();

  const res = await callBackend(`/api/v1/vehicles/${id}`, {
    method: "PATCH",
    authorization: req.headers.get("authorization"),
    clientIp: req.headers.get("x-forwarded-for"),
    body,
  });
  return passthroughResponse(res);
}

// DELETE /api/vehicles/:id — proxies DELETE /api/v1/vehicles/:id (deactivate).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const res = await callBackend(`/api/v1/vehicles/${id}`, {
    method: "DELETE",
    authorization: req.headers.get("authorization"),
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}