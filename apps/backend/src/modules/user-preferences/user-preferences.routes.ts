import { UpdateUserPreferencesSchema } from "@torpreca/shared";
import type { Routable } from "../../core/http/router";
import { auth } from "../../core/middleware/auth";
import { rateLimitGeneral } from "../../core/middleware/rate-limit";
import { validateBody } from "../../core/middleware/validate-zod";
import { userPreferencesRepository } from "./user-preferences.repository";
import { createUserPreferencesService } from "./user-preferences.service";

const service = createUserPreferencesService(userPreferencesRepository);

// Self-scoped by ctx.user.id (from the JWT) — no requireRole. Every
// authenticated role reads/writes only its own row; theme/language apply to
// all roles, defaultMapView is only ever populated by the dashboard's
// admin/supervisor/super_admin roles, but that's a UI decision (TOR-131 card
// notes), not enforced here.
export function registerUserPreferencesRoutes(router: Routable) {
  router.get("/users/me/preferences", auth, rateLimitGeneral, async (ctx) => {
    return Response.json(await service.get(ctx.user!.id));
  });

  router.patch(
    "/users/me/preferences",
    auth,
    rateLimitGeneral,
    validateBody(UpdateUserPreferencesSchema),
    async (ctx) => {
      return Response.json(await service.update(ctx.user!.id, ctx.body as never));
    },
  );
}

// Unsigned counterpart under /mobile/* — the Flutter app has no BFF to hold
// REQUEST_SIGNING_SECRET (see request-signing.ts), same reasoning as
// registerMobileStopsRoutes/registerMobileRoutesRoutes. Only theme is
// exercised from mobile today (Perfil screen, TOR-11) — language/
// defaultMapView are dashboard-only concerns, but the endpoint doesn't
// special-case that: it's the same self-scoped contract either way.
export function registerMobileUserPreferencesRoutes(router: Routable) {
  router.get("/mobile/users/me/preferences", auth, rateLimitGeneral, async (ctx) => {
    return Response.json(await service.get(ctx.user!.id));
  });

  router.patch(
    "/mobile/users/me/preferences",
    auth,
    rateLimitGeneral,
    validateBody(UpdateUserPreferencesSchema),
    async (ctx) => {
      return Response.json(await service.update(ctx.user!.id, ctx.body as never));
    },
  );
}
