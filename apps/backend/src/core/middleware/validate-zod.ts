import type { ZodEmail, ZodType } from "zod";
import type { Writeable } from "zod/v3";
import type { $strip } from "zod/v4/core";
import { ValidationError } from "../errors/app-error";
import type { Middleware } from "../http/context";

export function validateBody(
  schema: ZodObject<Writeable<{ email: ZodEmail }>, $strip>,
): Middleware {
  return async (ctx, next) => {
    let raw: unknown;
    try {
      raw = await ctx.req.json();
    } catch {
      throw new ValidationError("Body must be a valid JSON object", []);
    }

    const result = schema.safeParse(raw);
    if (!result.success) {
      throw new ValidationError("Invalid data", result.error.issues);
    }

    ctx.body = result.data;
    return next();
  };
}
