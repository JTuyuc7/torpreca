import { CreateFavoriteRouteSchema } from "@torpreca/shared";
import type { Routable } from "../../core/http/router";
import { auth } from "../../core/middleware/auth";
import { rateLimitGeneral } from "../../core/middleware/rate-limit";
import { requireRole } from "../../core/middleware/role";
import { validateBody } from "../../core/middleware/validate-zod";
import { favoriteRoutesRepository } from "./favorite-routes.repository";
import { createFavoriteRoutesService } from "./favorite-routes.service";

const service = createFavoriteRoutesService(favoriteRoutesRepository);

// Reusable A→B pairs for the "Calcular en mapa" modal in /rutas (TOR-127) —
// not one of the 12 audit_logs events, so no logEvent call here, same as
// vehicles.routes.ts.
export function registerFavoriteRoutesRoutes(router: Routable) {
  router.get("/favorite-routes", auth, rateLimitGeneral, async () => {
    return Response.json(await service.list());
  });

  router.post(
    "/favorite-routes",
    auth,
    requireRole("admin", "supervisor", "super_admin"),
    rateLimitGeneral,
    validateBody(CreateFavoriteRouteSchema),
    async (ctx) => {
      const favoriteRoute = await service.create(ctx.body as never, ctx.user!.id);
      return Response.json(favoriteRoute, { status: 201 });
    },
  );

  router.delete(
    "/favorite-routes/:id",
    auth,
    requireRole("admin", "supervisor", "super_admin"),
    rateLimitGeneral,
    async (ctx) => {
      await service.remove(ctx.params.id!);
      return new Response(null, { status: 204 });
    },
  );
}
