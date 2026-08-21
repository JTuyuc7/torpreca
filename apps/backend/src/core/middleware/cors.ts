import { env } from "../config/env";
import type { Middleware } from "../http/context";

export const cors: Middleware = async (ctx, next) => {
  const origin = ctx.req.headers.get("origin") ?? "";
  const allowed = env.ALLOWED_ORIGINS.includes(origin);

  if (ctx.req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowed ? origin : "",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Authorization,Content-Type",
      },
    });
  }

  const res = await next();
  if (allowed) res.headers.set("Access-Control-Allow-Origin", origin);
  return res;
};
