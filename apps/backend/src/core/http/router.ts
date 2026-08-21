import { toErrorResponse } from "../errors/app-error";
import type { Context, Handler, Middleware } from "./context";

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  middlewares: Middleware[];
  handler: Handler;
}

// Deliberately minimal: the closed stack calls for Bun + native WebSocket, no
// extra HTTP framework. Supports params (":id") and a middleware chain per route.
export class Router {
  private routes: Route[] = [];

  private register(method: string, path: string, middlewares: Middleware[], handler: Handler) {
    const paramNames: string[] = [];
    const patternSource = path
      .split("/")
      .map((segment) => {
        if (segment.startsWith(":")) {
          paramNames.push(segment.slice(1));
          return "([^/]+)";
        }
        return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("/");

    this.routes.push({
      method,
      pattern: new RegExp(`^${patternSource}$`),
      paramNames,
      middlewares,
      handler,
    });
  }

  get(path: string, ...rest: [...Middleware[], Handler]) {
    this.add("GET", path, rest);
  }

  post(path: string, ...rest: [...Middleware[], Handler]) {
    this.add("POST", path, rest);
  }

  patch(path: string, ...rest: [...Middleware[], Handler]) {
    this.add("PATCH", path, rest);
  }

  delete(path: string, ...rest: [...Middleware[], Handler]) {
    this.add("DELETE", path, rest);
  }

  private add(method: string, path: string, rest: unknown[]) {
    const handler = rest[rest.length - 1] as Handler;
    const middlewares = rest.slice(0, -1) as Middleware[];
    this.register(method, path, middlewares, handler);
  }

  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);

    for (const route of this.routes) {
      if (route.method !== req.method) continue;
      const match = route.pattern.exec(url.pathname);
      if (!match) continue;

      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1] ?? "");
      });

      const ctx: Context = { req, params };

      try {
        const chain = [...route.middlewares];
        const run = async (i: number): Promise<Response> => {
          const mw = chain[i];
          if (!mw) return route.handler(ctx);
          return mw(ctx, () => run(i + 1));
        };
        return await run(0);
      } catch (err) {
        return toErrorResponse(err);
      }
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }
}