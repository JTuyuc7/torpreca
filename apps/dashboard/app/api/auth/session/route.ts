import { callBackend, passthroughResponse } from "../../../../lib/backend/signed-fetch";

export async function POST(req: Request) {
  const res = await callBackend("/api/v1/auth/session", {
    method: "POST",
    authorization: req.headers.get("authorization"),
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}
