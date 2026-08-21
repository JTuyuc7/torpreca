import { CreateVehicleSchema } from "@torpreca/shared";
import type { Router } from "../../core/http/router";
import { auth } from "../../core/middleware/auth";
import { rateLimitGeneral } from "../../core/middleware/rate-limit";
import { requireRole } from "../../core/middleware/role";
import { validateBody } from "../../core/middleware/validate-zod";
import { vehiclesRepository } from "./vehicles.repository";
import { createVehiclesService } from "./vehicles.service";

const service = createVehiclesService(vehiclesRepository);

export function registerVehiclesRoutes(router: Router) {
  router.get("/vehicles", auth, rateLimitGeneral, async (ctx) => {
    const onlyActive = !ctx.req.url.includes("all=true");
    return Response.json(await service.list(onlyActive));
  });

  router.get("/vehicles/:id", auth, rateLimitGeneral, async (ctx) => {
    return Response.json(await service.getById(ctx.params.id!));
  });

  router.post(
    "/vehicles",
    auth,
    requireRole("admin", "super_admin"),
    rateLimitGeneral,
    validateBody(CreateVehicleSchema),
    async (ctx) => {
      const vehicle = await service.create(ctx.body as never);
      return Response.json(vehicle, { status: 201 });
    },
  );

  router.delete(
    "/vehicles/:id",
    auth,
    requireRole("admin", "super_admin"),
    rateLimitGeneral,
    async (ctx) => {
      await service.deactivate(ctx.params.id!);
      return new Response(null, { status: 204 });
    },
  );
}
