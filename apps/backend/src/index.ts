import { env } from "./core/config/env";
import { Router } from "./core/http/router";
import { cors } from "./core/middleware/cors";
import { securityHeaders } from "./core/middleware/headers";
import { registerRoutesRoutes } from "./modules/routes/routes.routes";
import { registerStopsRoutes } from "./modules/stops/stops.routes";
import { registerUsersRoutes } from "./modules/users/users.routes";
import { registerVehiclesRoutes } from "./modules/vehicles/vehicles.routes";
import { docsPageHtml } from "./openapi/docs-page";
import { openApiDocument } from "./openapi/document";

const router = new Router();
registerVehiclesRoutes(router);
registerUsersRoutes(router);
registerRoutesRoutes(router);
registerStopsRoutes(router);

router.get("/health", () => Response.json({ ok: true }));
router.get("/openapi.json", () => Response.json(openApiDocument));
router.get("/docs", () => new Response(docsPageHtml, { headers: { "content-type": "text/html" } }));

const globalMiddlewares = [cors, securityHeaders];

const server = Bun.serve({
  port: env.PORT,
  async fetch(req) {
    const ctx = { req, params: {} };
    const run = (i: number): Promise<Response> => {
      const mw = globalMiddlewares[i];
      if (!mw) return router.handle(req);
      return mw(ctx, () => run(i + 1));
    };
    return run(0);
  },
});

console.log(`Torpreca backend listening on http://localhost:${server.port}`);
