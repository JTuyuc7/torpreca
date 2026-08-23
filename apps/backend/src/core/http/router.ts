import { toErrorResponse } from "../errors/app-error";
import type { Context, Handler, Middleware } from "./context";

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  middlewares: Middleware[];
  handler: Handler;
}

// What module registration functions (registerXRoutes) are typed to accept —
// either a bare Router or a Router.withPrefix(...) view over one.
export interface Routable {
  get(path: string, ...rest: [...Middleware[], Handler]): void;
  post(path: string, ...rest: [...Middleware[], Handler]): void;
  patch(path: string, ...rest: [...Middleware[], Handler]): void;
  delete(path: string, ...rest: [...Middleware[], Handler]): void;
}

// Deliberately minimal: the closed stack calls for Bun + native WebSocket, no
// extra HTTP framework. Supports params (":id") and a middleware chain per route.
export class Router implements Routable {
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

  // Returns a view that prefixes every path registered through it (e.g. "/api/v1")
  // and prepends extraMiddlewares (e.g. `deprecated(...)`) ahead of each route's own.
  // Routes still end up on this same Router — only how registerXRoutes(...) sees it changes.
  withPrefix(prefix: string, ...extraMiddlewares: Middleware[]): Routable {
    return new PrefixedRouter(this, prefix, extraMiddlewares);
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

class PrefixedRouter implements Routable {
  constructor(
    private readonly router: Router,
    private readonly prefix: string,
    private readonly extraMiddlewares: Middleware[],
  ) {}

  get(path: string, ...rest: [...Middleware[], Handler]) {
    this.delegate("get", path, rest);
  }

  post(path: string, ...rest: [...Middleware[], Handler]) {
    this.delegate("post", path, rest);
  }

  patch(path: string, ...rest: [...Middleware[], Handler]) {
    this.delegate("patch", path, rest);
  }

  delete(path: string, ...rest: [...Middleware[], Handler]) {
    this.delegate("delete", path, rest);
  }

  private delegate(method: "get" | "post" | "patch" | "delete", path: string, rest: unknown[]) {
    const handler = rest[rest.length - 1] as Handler;
    const middlewares = rest.slice(0, -1) as Middleware[];
    this.router[method](`${this.prefix}${path}`, ...this.extraMiddlewares, ...middlewares, handler);
  }
}
