import type { DailyReport } from "@torpreca/shared";
import type { RoutesRepository } from "../routes/routes.repository";
import type { StopsRepository } from "../stops/stops.repository";
import type { DailyReportsRepository } from "./daily-reports.repository";

function msToInterval(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
}

// Takes routes/stops repositories directly (not their services) — this only
// ever reads data those modules already validated/authorized on the way in;
// re-running their service-level auth checks here would be redundant (this
// runs server-side, triggered by an already-authorized route.finished, never
// directly off a request).
export function createDailyReportsService(
  repo: DailyReportsRepository,
  routesRepo: RoutesRepository,
  stopsRepo: StopsRepository,
) {
  return {
    async getByDriverAndDate(driverId: string, date: string): Promise<DailyReport | null> {
      return repo.getByDriverAndDate(driverId, date);
    },

    // Recomputes the whole day from scratch across every one of the driver's
    // completed routes that date (not just the one that just finished) — the
    // uncommon case of two routes finishing the same day still ends up with
    // one correct consolidated row instead of the second overwriting the
    // first's numbers.
    async generateForDriverDate(driverId: string, date: string): Promise<DailyReport> {
      const routes = await routesRepo.list({ driverId, date });
      const completedRoutes = routes.filter((r) => r.status === "completed");

      let drivenKm = 0;
      let completedStops = 0;
      let timeOnRouteMs = 0;

      for (const route of completedRoutes) {
        drivenKm += route.drivenKm;

        const stops = await stopsRepo.listByRoute(route.id);
        completedStops += stops.filter((s) => s.status === "completed").length;

        if (route.startTime && route.endTime) {
          timeOnRouteMs += new Date(route.endTime).getTime() - new Date(route.startTime).getTime();
        }
      }

      return repo.upsert({
        driverId,
        date,
        drivenKm,
        completedStops,
        routesServed: completedRoutes.length,
        timeOnRoute: timeOnRouteMs > 0 ? msToInterval(timeOnRouteMs) : null,
      });
    },
  };
}

export type DailyReportsService = ReturnType<typeof createDailyReportsService>;
