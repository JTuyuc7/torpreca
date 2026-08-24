import { env } from "./core/config/env";
import { toErrorResponse } from "./core/errors/app-error";
import { Router } from "./core/http/router";
import { cors } from "./core/middleware/cors";
import { securityHeaders } from "./core/middleware/headers";
import { requestSigning } from "./core/middleware/request-signing";
import {
  handleClose,
  handleMessage,
  handleOpen,
  type TrackingWs,
} from "./core/ws/tracking-handlers";
import { resolveUpgradeData, type TrackingSocketData } from "./core/ws/upgrade";
import { locationsRepository } from "./modules/locations/locations.repository";
import { registerLocationsRoutes } from "./modules/locations/locations.routes";
import { createLocationsService } from "./modules/locations/locations.service";
import { routesRepository } from "./modules/routes/routes.repository";
import { registerRoutesRoutes } from "./modules/routes/routes.routes";
import { registerStopsRoutes } from "./modules/stops/stops.routes";
import { registerSyncQueueRoutes } from "./modules/sync-queue/sync-queue.routes";
import { registerUsersRoutes } from "./modules/users/users.routes";
import { registerVehiclesRoutes } from "./modules/vehicles/vehicles.routes";
import { registerWsTicketsRoutes } from "./modules/ws-tickets/ws-tickets.routes";
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
registerLocationsRoutes(v1);
registerWsTicketsRoutes(v1);
registerSyncQueueRoutes(v1);

// Unversioned infra routes — not signed, not tied to an API version.
router.get("/health", () => Response.json({ ok: true }));
router.get("/openapi.json", () => Response.json(openApiDocument));
router.get("/docs", () => new Response(docsPageHtml, { headers: { "content-type": "text/html" } }));

const globalMiddlewares = [cors, securityHeaders, requestSigning];

const locationsService = createLocationsService(locationsRepository, routesRepository);

// `let` (not `const`) so the `websocket.message` closure below can reference
// `server.publish` — it's only evaluated when a message actually arrives,
// well after Bun.serve has returned and assigned it, so no TDZ issue.
let server: ReturnType<typeof Bun.serve<TrackingSocketData>>;

server = Bun.serve<TrackingSocketData>({
  port: env.PORT,
  async fetch(req, srv) {
    const url = new URL(req.url);

    // /ws lives outside /api/v1 and outside requestSigning's /api/* gate on
    // purpose: the client authenticates via a short-lived ticket (minted
    // through the normal signed+authenticated POST /api/v1/ws-tickets), not a
    // header this transport can't carry on the handshake — same trust
    // boundary as REST auth, just delivered differently.
    if (url.pathname === "/ws") {
      const data = resolveUpgradeData(req);
      if (!data) return new Response("Unauthorized", { status: 401 });
      const upgraded = srv.upgrade(req, { data });
      return upgraded ? undefined : new Response("Upgrade failed", { status: 400 });
    }

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
  websocket: {
    open: (ws) => handleOpen(ws as unknown as TrackingWs),
    message: (ws, message) =>
      handleMessage(ws as unknown as TrackingWs, message, {
        recordPing: (input, user) => locationsService.recordPing(input, user),
        publish: (topic, message2) => server.publish(topic, message2),
      }),
    close: (ws) => handleClose(ws as unknown as TrackingWs),
  },
});

console.log(`Torpreca backend listening on http://localhost:${server.port}`);
