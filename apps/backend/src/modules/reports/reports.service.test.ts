import { describe, expect, it } from "bun:test";
import { businessDate, type Route, type User, type Vehicle } from "@torpreca/shared";
import type { RoutesRepository } from "../routes/routes.repository";
import type { UsersRepository } from "../users/users.repository";
import type { VehiclesRepository } from "../vehicles/vehicles.repository";
import { createReportsService } from "./reports.service";

function notUsed(): never {
  throw new Error("not used in these tests");
}

function fakeRoutesRepo(seed: Route[]): RoutesRepository {
  return {
    async list(filter = {}) {
      const inRange = seed.filter(
        (r) => (!filter.from || r.date >= filter.from) && (!filter.to || r.date <= filter.to),
      );
      const offset = filter.offset ?? 0;
      return filter.limit === undefined ? inRange : inRange.slice(offset, offset + filter.limit);
    },
    page: notUsed,
    getById: notUsed,
    create: notUsed,
    update: notUsed,
    start: notUsed,
    finish: notUsed,
    close: notUsed,
    delete: notUsed,
  };
}

function fakeUsersRepo(seed: User[]): UsersRepository {
  return {
    async list() {
      return seed;
    },
    getById: notUsed,
    getByAuthUserId: notUsed,
    create: notUsed,
    invite: notUsed,
    deactivate: notUsed,
    updateRole: notUsed,
    review: notUsed,
  };
}

function fakeVehiclesRepo(seed: Vehicle[]): VehiclesRepository {
  return {
    async list() {
      return seed;
    },
    getById: notUsed,
    getByPlate: notUsed,
    create: notUsed,
    update: notUsed,
    deactivate: notUsed,
  };
}

const DRIVER_A = "11111111-1111-4111-8111-111111111111";
const DRIVER_B = "22222222-2222-4222-8222-222222222222";
const VEHICLE_1 = "33333333-3333-4333-8333-333333333333";

function route(overrides: Partial<Route>): Route {
  return {
    id: crypto.randomUUID(),
    code: "R-00001",
    driverId: DRIVER_A,
    vehicleId: null,
    createdBy: "admin-1",
    date: "2026-01-01",
    status: "completed",
    plannedKm: 10,
    drivenKm: 12,
    startTime: null,
    endTime: null,
    createdAt: "t",
    updatedAt: "t",
    ...overrides,
  };
}

function service(routes: Route[], users: User[] = [], vehicles: Vehicle[] = []) {
  return createReportsService({
    routes: fakeRoutesRepo(routes),
    users: fakeUsersRepo(users),
    vehicles: fakeVehiclesRepo(vehicles),
  });
}

describe("reports.service routesReport", () => {
  it("is all zeros, with one entry per day, for a range without routes", async () => {
    const report = await service([]).routesReport("2026-01-01", "2026-01-03");

    expect(report.totals).toEqual({
      routes: 0,
      completed: 0,
      plannedKm: 0,
      drivenKm: 0,
      completionRate: 0,
    });
    expect(report.byDay.map((d) => d.date)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
    expect(report.byDriver).toEqual([]);
    expect(report.byStatus.every((s) => s.count === 0)).toBe(true);
  });

  it("totals the routes and counts kilometers on completed routes only", async () => {
    const report = await service([
      route({ plannedKm: 10, drivenKm: 12.345 }),
      route({ plannedKm: 5, drivenKm: 5 }),
      route({ status: "cancelled", plannedKm: 100, drivenKm: 3 }),
      route({ status: "pending", plannedKm: 50, drivenKm: 0, date: "2999-01-01" }),
    ]).routesReport("2026-01-01", "2999-12-31");

    expect(report.totals).toEqual({
      routes: 4,
      completed: 2,
      plannedKm: 15,
      drivenKm: 17.35,
      completionRate: 0.5,
    });
  });

  it("buckets every route exactly once by status, past open routes as overdue", async () => {
    const today = businessDate();
    const report = await service([
      route({ status: "completed" }),
      route({ status: "pending", date: "2020-01-01" }),
      route({ status: "in_progress", date: "2020-01-01" }),
      route({ status: "pending", date: "2999-01-01" }),
      route({ status: "delayed", date: today }),
      route({ status: "cancelled" }),
    ]).routesReport("2020-01-01", "2999-12-31");

    const counts = Object.fromEntries(report.byStatus.map((s) => [s.status, s.count]));
    expect(counts).toEqual({
      pending: 1,
      in_progress: 0,
      completed: 1,
      delayed: 1,
      cancelled: 1,
      overdue: 2,
    });
    expect(report.byStatus.reduce((sum, s) => sum + s.count, 0)).toBe(report.totals.routes);
  });

  it("groups by day, driver (busiest first) and vehicle (null = unassigned)", async () => {
    const report = await service([
      route({ date: "2026-01-01", driverId: DRIVER_A, vehicleId: VEHICLE_1 }),
      route({ date: "2026-01-01", driverId: DRIVER_B }),
      route({ date: "2026-01-03", driverId: DRIVER_B, status: "cancelled" }),
      route({ date: "2026-01-03", driverId: DRIVER_B, vehicleId: VEHICLE_1 }),
    ]).routesReport("2026-01-01", "2026-01-03");

    expect(report.byDay.map((d) => [d.date, d.routes])).toEqual([
      ["2026-01-01", 2],
      ["2026-01-02", 0],
      ["2026-01-03", 2],
    ]);
    expect(report.byDriver.map((d) => [d.driverId, d.routes, d.completed])).toEqual([
      [DRIVER_B, 3, 2],
      [DRIVER_A, 1, 1],
    ]);
    expect(report.byVehicle.map((v) => [v.vehicleId, v.routes])).toEqual([
      [VEHICLE_1, 2],
      [null, 2],
    ]);
  });

  it("reads a range bigger than one fetch page without dropping routes", async () => {
    const many = Array.from({ length: 2500 }, () => route({}));
    const report = await service(many).routesReport("2026-01-01", "2026-01-01");

    expect(report.totals.routes).toBe(2500);
  });
});

describe("reports.service routesCsv", () => {
  const driver = { id: DRIVER_A, name: "Carlos Pérez" } as User;
  const vehicle = { id: VEHICLE_1, plate: "P-123ABC" } as Vehicle;

  it("writes a BOM, a header and one line per route with the names resolved", async () => {
    const csv = await service(
      [
        route({ code: "R-00002", date: "2026-01-02", vehicleId: VEHICLE_1 }),
        route({ code: "R-00001", date: "2026-01-01", plannedKm: null, drivenKm: 0 }),
      ],
      [driver],
      [vehicle],
    ).routesCsv("2026-01-01", "2026-01-02");

    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual([
      "code,date,status,driver,vehicle,planned_km,driven_km,start_time,end_time",
      "R-00001,2026-01-01,completed,Carlos Pérez,,,0,,",
      "R-00002,2026-01-02,completed,Carlos Pérez,P-123ABC,10,12,,",
      "",
    ]);
  });

  it("quotes commas and quotes, and defuses spreadsheet formulas", async () => {
    const csv = await service(
      [route({ vehicleId: VEHICLE_1 })],
      [{ ...driver, name: 'Pérez, "Carlos"' }],
      [{ ...vehicle, plate: "=1+1" }],
    ).routesCsv("2026-01-01", "2026-01-01");

    expect(csv).toContain('"Pérez, ""Carlos"""');
    expect(csv).toContain(",'=1+1,");
  });
});
