import { createHmac, timingSafeEqual } from "node:crypto";

// Shared between apps/backend (verifies) and apps/dashboard's server-side
// route handlers (sign, using REQUEST_SIGNING_SECRET as a private env var —
// never exposed to the browser). Both sides must build the exact same
// canonical payload or every signed request fails.

const HEX_PATTERN = /^[0-9a-f]+$/i;

// Canonical string both the signer and the verifier hash — order and separators
// matter, changing this shape is a breaking change for anything that signs requests.
export function buildSignaturePayload(
  method: string,
  pathWithQuery: string,
  timestamp: string,
  body: string,
): string {
  return `${method.toUpperCase()}\n${pathWithQuery}\n${timestamp}\n${body}`;
}

export function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

// Constant-time comparison — a length/early-exit check here would leak the
// valid signature length or prefix via response timing.
export function verifySignature(secret: string, payload: string, signatureHex: string): boolean {
  if (!HEX_PATTERN.test(signatureHex) || signatureHex.length % 2 !== 0) return false;

  const expected = Buffer.from(signPayload(secret, payload), "hex");
  const provided = Buffer.from(signatureHex, "hex");
  if (expected.length !== provided.length) return false;

  return timingSafeEqual(expected, provided);
}
