import { AppError } from "../errors/app-error";
import type { Middleware } from "../http/context";

interface Bucket {
  count: number;
  resetAt: number;
}

// In-memory: good enough for the MVP on a single instance (Render/Railway).
// If this scales to multiple instances, move it to Redis.
export function rateLimit(maxRequests: number, windowMs: number): Middleware {
  const buckets = new Map<string, Bucket>();

  return async (ctx, next) => {
    const ip = ctx.req.headers.get("x-forwarded-for") ?? "unknown";
    const now = Date.now();
    const bucket = buckets.get(ip);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= maxRequests) {
      throw new AppError(429, "Too many requests. Please try again later.");
    }

    bucket.count += 1;
    return next();
  };
}

export const rateLimitGeneral = rateLimit(60, 60_000);

// Stricter limit for public, unauthenticated auth-sensitive endpoints
// (e.g. login-failed logging, future self-signup) — same criteria as
// documented for POST /auth/register in the self-signup design doc.
export const rateLimitAuth = rateLimit(5, 60_000);
