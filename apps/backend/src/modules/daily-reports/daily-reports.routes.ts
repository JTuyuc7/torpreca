import type { Routable } from "../../core/http/router";
import { auth } from "../../core/middleware/auth";
import { rateLimitGeneral } from "../../core/middleware/rate-limit";
import { requireRole } from "../../core/middleware/role";
import { routesRepository } from "../routes/routes.repository";
import { stopsRepository } from "../stops/stops.repository";
import { dailyReportsRepository } from "./daily-reports.repository";
import { createDailyReportsService } from "./daily-reports.service";

const service = createDailyReportsService(
  dailyReportsRepository,
  routesRepository,
  stopsRepository,
);

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// Unsigned /mobile route only, same reasoning as routes/stops — Flutter can't
// hold REQUEST_SIGNING_SECRET. Nothing outside the mobile app reads a
// driver's own daily report yet (a dashboard-facing "Reportes históricos" is
// a separate, later ticket), so there's no signed /daily-reports counterpart
// to mirror today.
export function registerMobileDailyReportsRoutes(router: Routable) {
  // Array response (0 or 1 items), not a single object/404 — mirrors
  // GET /mobile/routes?date=: "no report generated yet for this date" is a
  // normal, common state (e.g. before the driver finishes their first route
  // of the day), not an error.
  router.get(
    "/mobile/daily-reports",
    auth,
    requireRole("driver"),
    rateLimitGeneral,
    async (ctx) => {
      const date = new URL(ctx.req.url).searchParams.get("date") ?? todayIsoDate();
      const report = await service.getByDriverAndDate(ctx.user!.id, date);
      return Response.json(report ? [report] : []);
    },
  );
}
