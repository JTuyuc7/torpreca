import { ReportRangeQuerySchema } from "@torpreca/shared";
import { ValidationError } from "../../core/errors/app-error";
import type { Routable } from "../../core/http/router";
import { auth } from "../../core/middleware/auth";
import { rateLimitGeneral } from "../../core/middleware/rate-limit";
import { requireRole } from "../../core/middleware/role";
import { routesRepository } from "../routes/routes.repository";
import { usersRepository } from "../users/users.repository";
import { vehiclesRepository } from "../vehicles/vehicles.repository";
import { createReportsService } from "./reports.service";

const service = createReportsService({
  routes: routesRepository,
  users: usersRepository,
  vehicles: vehiclesRepository,
});

function rangeOf(req: Request) {
  const parsed = ReportRangeQuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsed.success) throw new ValidationError("Invalid query", parsed.error.issues);
  return parsed.data;
}

// Reports are for whoever manages routes; drivers have no use for fleet-wide data.
export function registerReportsRoutes(router: Routable) {
  router.get(
    "/reports/routes",
    auth,
    requireRole("admin", "supervisor", "super_admin"),
    rateLimitGeneral,
    async (ctx) => {
      const { from, to } = rangeOf(ctx.req);
      return Response.json(await service.routesReport(from, to));
    },
  );

  router.get(
    "/reports/routes/csv",
    auth,
    requireRole("admin", "supervisor", "super_admin"),
    rateLimitGeneral,
    async (ctx) => {
      const { from, to } = rangeOf(ctx.req);
      return new Response(await service.routesCsv(from, to), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="routes-${from}_${to}.csv"`,
        },
      });
    },
  );
}
