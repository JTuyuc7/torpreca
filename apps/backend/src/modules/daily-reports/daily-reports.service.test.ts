import { describe, expect, it } from "bun:test";
import type { Route, Stop } from "@torpreca/shared";
import type { RoutesRepository } from "../routes/routes.repository";
import type { StopsRepository } from "../stops/stops.repository";
import type { DailyReportsRepository, UpsertDailyReportInput } from "./daily-reports.repository";
import { createDailyReportsService } from "./daily-reports.service";

function fakeRoutesRepo(routes: Route[]): RoutesRepository {
  return {
    async list(filter) {
      return routes.filter(
        (r) =>
          (!filter?.driverId || r.driverId === filter.driverId) &&
          (!filter?.date || r.date === filter.date),
      );
    },
    async getById(id) {
      return routes.find((r) => r.id === id) ?? null;
    },
    async create() {
      throw new Error("not used in these tests");
    },
    async update() {
      throw new Error("not used in these tests");
    },
    async start() {
      throw new Error("not used in these tests");
    },
    async finish() {
      throw new Error("not used in these tests");
    },
  };
}

function fakeStopsRepo(stops: Stop[]): StopsRepository {
  return {
    async listByRoute(routeId) {
      return stops.filter((s) => s.routeId === routeId);
    },
    async getById(id) {
      return stops.find((s) => s.id === id) ?? null;
    },
    async create() {
      throw new Error("not used in these tests");
    },
    async update() {
      throw new Error("not used in these tests");
    },
    async delete() {
      throw new Error("not used in these tests");
    },
    async reorder() {
      throw new Error("not used in these tests");
    },
    async complete() {
      throw new Error("not used in these tests");
    },
    async delay() {
      throw new Error("not used in these tests");
    },
  };
}

function fakeDailyReportsRepo(): DailyReportsRepository & { upserted: UpsertDailyReportInput[] } {
  const upserted: UpsertDailyReportInput[] = [];
  return {
    upserted,
    async getByDriverAndDate() {
      return null;
    },
    async upsert(input) {
      upserted.push(input);
      const now = new Date().toISOString();
      return {
        id: crypto.randomUUID(),
        ...input,
        generatedAt: now,
        createdAt: now,
        updatedAt: now,
      };
    },
  };
}

const DRIVER_ID = "driver-1";
const DATE = "2026-09-16";

function route(overrides: Partial<Route>): Route {
  return {
    id: crypto.randomUUID(),
    code: "R-1",
    driverId: DRIVER_ID,
    vehicleId: null,
    createdBy: "admin-1",
    date: DATE,
    status: "completed",
    plannedKm: null,
    drivenKm: 0,
    startTime: null,
    endTime: null,
    createdAt: "t",
    updatedAt: "t",
    ...overrides,
  };
}

function stop(overrides: Partial<Stop>): Stop {
  return {
    id: crypto.randomUUID(),
    routeId: "",
    order: 1,
    customerName: "Cliente",
    address: "Dirección",
    lat: 14.6,
    lng: -90.5,
    instructions: null,
    status: "completed",
    estimatedTime: null,
    completedTime: null,
    createdAt: "t",
    updatedAt: "t",
    ...overrides,
  };
}

describe("daily-reports.service", () => {
  it("consolidates driven km, completed stops and routes served across the day's completed routes", async () => {
    const r1 = route({
      drivenKm: 10,
      startTime: "2026-09-16T08:00:00Z",
      endTime: "2026-09-16T09:30:00Z",
    });
    const r2 = route({
      drivenKm: 5,
      startTime: "2026-09-16T10:00:00Z",
      endTime: "2026-09-16T10:15:00Z",
    });
    const stops = [
      stop({ routeId: r1.id, status: "completed" }),
      stop({ routeId: r1.id, status: "pending" }),
      stop({ routeId: r2.id, status: "completed" }),
    ];

    const dailyRepo = fakeDailyReportsRepo();
    const service = createDailyReportsService(
      dailyRepo,
      fakeRoutesRepo([r1, r2]),
      fakeStopsRepo(stops),
    );

    const report = await service.generateForDriverDate(DRIVER_ID, DATE);

    expect(report).toMatchObject({
      driverId: DRIVER_ID,
      date: DATE,
      drivenKm: 15,
      completedStops: 2,
      routesServed: 2,
      // 1h30m + 15m = 1h45m
      timeOnRoute: "01:45:00",
    });
  });

  it("ignores routes that aren't completed yet and routes from other drivers/dates", async () => {
    const pendingRoute = route({ status: "pending", drivenKm: 99 });
    const otherDriverRoute = route({ driverId: "driver-2", drivenKm: 99 });
    const otherDateRoute = route({ date: "2026-09-01", drivenKm: 99 });
    const completed = route({ drivenKm: 8 });

    const dailyRepo = fakeDailyReportsRepo();
    const service = createDailyReportsService(
      dailyRepo,
      fakeRoutesRepo([pendingRoute, otherDriverRoute, otherDateRoute, completed]),
      fakeStopsRepo([]),
    );

    const report = await service.generateForDriverDate(DRIVER_ID, DATE);

    expect(report).toMatchObject({ drivenKm: 8, routesServed: 1, completedStops: 0 });
  });

  it("returns null timeOnRoute when no completed route has both a start and end time", async () => {
    const r = route({ drivenKm: 3, startTime: null, endTime: null });
    const dailyRepo = fakeDailyReportsRepo();
    const service = createDailyReportsService(dailyRepo, fakeRoutesRepo([r]), fakeStopsRepo([]));

    const report = await service.generateForDriverDate(DRIVER_ID, DATE);

    expect(report.timeOnRoute).toBeNull();
  });
});
