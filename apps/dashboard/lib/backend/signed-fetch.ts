import { buildSignaturePayload, signPayload } from "@torpreca/shared";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const SIGNING_SECRET = process.env.REQUEST_SIGNING_SECRET;

if (!BACKEND_URL) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
if (!SIGNING_SECRET) throw new Error("Missing REQUEST_SIGNING_SECRET");

interface CallBackendInput {
  method: string;
  authorization?: string | null;
  clientIp?: string | null;
  body?: string;
}

// Thin server-side proxy: the backend requires every /api/* request to be
// HMAC-signed (apps/backend/src/core/middleware/request-signing.ts) using a
// secret that must never reach the browser. Route handlers under
// app/api/* run on the server, hold that secret (REQUEST_SIGNING_SECRET,
// no NEXT_PUBLIC_ prefix), and are the only place in the dashboard allowed
// to call the backend directly.
export async function callBackend(path: string, input: CallBackendInput): Promise<Response> {
  const body = input.body ?? "";
  const timestamp = Date.now().toString();
  const signature = signPayload(
    SIGNING_SECRET as string,
    buildSignaturePayload(input.method, path, timestamp, body),
  );

  const headers: Record<string, string> = { "x-signature": signature, "x-timestamp": timestamp };
  if (input.authorization) headers.authorization = input.authorization;
  // Backend rate limiting keys off x-forwarded-for — forward the browser's
  // real IP through so it isn't bucketed under this server's own IP.
  if (input.clientIp) headers["x-forwarded-for"] = input.clientIp;
  if (body) headers["content-type"] = "application/json";

  return fetch(`${BACKEND_URL}${path}`, {
    method: input.method,
    headers,
    body: body || undefined,
  });
}
