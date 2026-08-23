import { env } from "../config/env";
import { AppError } from "../errors/app-error";
import type { Middleware } from "../http/context";
import { buildSignaturePayload, verifySignature } from "../security/hmac";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

// Only /api/* is signed — /health, /docs and /openapi.json stay public so
// infra checks and the Scalar docs page keep working without a secret.
export const requestSigning: Middleware = async (ctx, next) => {
  const url = new URL(ctx.req.url);
  if (!url.pathname.startsWith("/api/")) return next();

  const signature = ctx.req.headers.get("x-signature");
  const timestamp = ctx.req.headers.get("x-timestamp");
  if (!signature || !timestamp) throw new AppError(401, "Missing request signature");

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS) {
    throw new AppError(401, "Request signature expired");
  }

  const body = await ctx.req.clone().text();
  const payload = buildSignaturePayload(
    ctx.req.method,
    `${url.pathname}${url.search}`,
    timestamp,
    body,
  );

  if (!verifySignature(env.REQUEST_SIGNING_SECRET, payload, signature)) {
    throw new AppError(401, "Invalid request signature");
  }

  return next();
};
