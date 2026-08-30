import { callBackend, passthroughResponse } from "../../../../lib/backend/signed-fetch";

export async function POST(req: Request) {
  const body = await req.text();
  const res = await callBackend("/api/v1/auth/login-failed", {
    method: "POST",
    body,
    clientIp: req.headers.get("x-forwarded-for"),
  });
  return passthroughResponse(res);
}
