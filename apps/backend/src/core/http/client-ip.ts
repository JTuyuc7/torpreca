import type { Context } from "./context";

export function clientIp(ctx: Context): string | null {
  return ctx.req.headers.get("x-forwarded-for");
}