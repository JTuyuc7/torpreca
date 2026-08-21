import type { AuthUser } from "@torpreca/shared";

export interface Context {
  req: Request;
  params: Record<string, string>;
  user?: AuthUser;
  body?: unknown;
}

export type Handler = (ctx: Context) => Promise<Response> | Response;

export type Middleware = (ctx: Context, next: () => Promise<Response>) => Promise<Response>;
