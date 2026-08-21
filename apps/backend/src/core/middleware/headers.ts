import type { Middleware } from "../http/context";

export const securityHeaders: Middleware = async (_ctx, next) => {
  const res = await next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  return res;
};
