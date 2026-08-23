import { env } from "./core/config/env";
import { toErrorResponse } from "./core/errors/app-error";
import { Router } from "./core/http/router";
import { cors } from "./core/middleware/cors";
import { securityHeaders } from "./core/middleware/headers";
import { requestSigning } from "./core/middleware/request-signing";
import { registerRoutesRoutes } from "./modules/routes/routes.routes";
import { registerStopsRoutes } from "./modules/stops/stops.routes";
import { registerUsersRoutes } from "./modules/users/users.routes";
import { registerVehiclesRoutes } from "./modules/vehicles/vehicles.routes";
import { docsPageHtml } from "./openapi/docs-page";
import { openApiDocument } from "./openapi/document";

const router = new Router();

// /api/v1: all module routes live here. When v2 ships, mount it the same way
// and add `deprecated({ sunset, link })` as an extra middleware on this v1 group.
const v1 = router.withPrefix("/api/v1");
registerVehiclesRoutes(v1);
registerUsersRoutes(v1);
registerRoutesRoutes(v1);
registerStopsRoutes(v1);

// Unversioned infra routes — not signed, not tied to an API version.
router.get("/health", () => Response.json({ ok: true }));
router.get("/openapi.json", () => Response.json(openApiDocument));
router.get("/docs", () => new Response(docsPageHtml, { headers: { "content-type": "text/html" } }));

const globalMiddlewares = [cors, securityHeaders, requestSigning];

const server = Bun.serve({
  port: env.PORT,
  async fetch(req) {
    const ctx = { req, params: {} };
    // Caught per-level (not once at the top) so an outer middleware like `cors`
    // still gets a real Response from `next()` and can decorate it — an error
    // caught only at the top would skip cors/securityHeaders entirely.
    const run = async (i: number): Promise<Response> => {
      const mw = globalMiddlewares[i];
      if (!mw) return router.handle(req);
      try {
        return await mw(ctx, () => run(i + 1));
      } catch (err) {
        return toErrorResponse(err);
      }
    };
    return run(0);
  },
});

console.log(`Torpreca backend listening on http://localhost:${server.port}`);
