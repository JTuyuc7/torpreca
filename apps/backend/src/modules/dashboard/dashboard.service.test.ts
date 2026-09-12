import { describe, expect, it } from "bun:test";
import type { Location, Route, User, Vehicle } from "@torpreca/shared";
import type { LocationsRepository } from "../locations/locations.repository";
import type { RoutesRepository } from "../routes/routes.repository";
import type { UsersRepository } from "../users/users.repository";
import type { VehiclesRepository } from "../vehicles/vehicles.repository";
import { createDashboardService } from "./dashboard.service";

function notUsed(): never {
  throw new Error("not used in these tests");
}

function fakeRoutesRepo(seed: Route[]): RoutesRepository {
  return {
    async list() {
      return seed;
    },
    getById: notUsed,
    create: notUsed,
    update: notUsed,
    start: notUsed,
    finish: notUsed,
  };
}

function fakeVehiclesRepo(seed: Vehicle[]): VehiclesRepository {
  return {
    async list(onlyActive = true) {
      return onlyActive ? seed.filter((v) => v.active) : seed;
    },
    getById: notUsed,
    getByPlate: notUsed,
    create: notUsed,
    update: notUsed,
    deactivate: notUsed,
  };
}

function fakeUsersRepo(seed: User[]): UsersRepository {
  return {
    async list(status = "active") {
      return status === "all" ? seed : seed.filter((u) => u.status === status);
    },
    getById: notUsed,
    getByAuthUserId: notUsed,
    create: notUsed,
    deactivate: notUsed,
    review: notUsed,
  };
}

function fakeLocationsRepo(seed: Location[]): LocationsRepository {
  return {
    async listLatestPerDriver() {
      return seed;
    },
    create: notUsed,
    listByRoute: notUsed,
  };
}

function route(overrides: Partial<Route>): Route {
  return {
    id: crypto.randomUUID(),
    code: "R-1",
    driverId: "driver-1",
    vehicleId: null,
    createdBy: "admin-1",
    date: "2026-09-12",
    status: "pending",
    plannedKm: null,
    drivenKm: 0,
    startTime: null,
    endTime: null,
    createdAt: "t",
    updatedAt: "t",
    ...overrides,
  };
}

function vehicle(overrides: Partial<Vehicle>): Vehicle {
  return {
    id: crypto.randomUUID(),
    plate: "P-1",
    model: "M",
    capacity: null,
    category: "light_vehicle",
    notes: null,
    active: true,
    createdAt: "t",
    updatedAt: "t",
    ...overrides,
  };
}

function user(overrides: Partial<User>): User {
  return {
    id: crypto.randomUUID(),
    authUserId: crypto.randomUUID(),
    name: "N",
    email: "n@example.com",
    role: "driver",
    status: "active",
    deactivatedAt: null,
    deactivatedBy: null,
    reviewedAt: null,
    reviewedBy: null,
    createdAt: "t",
    updatedAt: "t",
    ...overrides,
  };
}

function location(overrides: Partial<Location>): Location {
  return {
    id: crypto.randomUUID(),
    driverId: "driver-1",
    routeId: null,
    lat: 0,
    lng: 0,
    speed: null,
    recordedAt: new Date().toISOString(),
    synced: true,
    createdAt: "t",
    updatedAt: "t",
    ...overrides,
  };
}

describe("dashboardService.getSummary", () => {
  it("counts in-progress routes and today's pending routes separately", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const service = createDashboardService({
      routes: fakeRoutesRepo([
        route({ status: "in_progress", date: today }),
        route({ status: "in_progress", date: "2020-01-01" }),
        route({ status: "pending", date: today }),
        route({ status: "pending", date: "2020-01-01" }),
        route({ status: "completed", date: today }),
      ]),
      vehicles: fakeVehiclesRepo([]),
      users: fakeUsersRepo([]),
      locations: fakeLocationsRepo([]),
    });

    const summary = await service.getSummary();

    expect(summary.routesInProgress).toBe(2);
    expect(summary.routesPendingToday).toBe(1);
  });

  it("counts active vehicles out of all vehicles", async () => {
    const service = createDashboardService({
      routes: fakeRoutesRepo([]),
      vehicles: fakeVehiclesRepo([
        vehicle({ active: true }),
        vehicle({ active: true }),
        vehicle({ active: false }),
      ]),
      users: fakeUsersRepo([]),
      locations: fakeLocationsRepo([]),
    });

    const summary = await service.getSummary();

    expect(summary.vehiclesActive).toBe(2);
  });

  it("counts only active users with role driver", async () => {
    const service = createDashboardService({
      routes: fakeRoutesRepo([]),
      vehicles: fakeVehiclesRepo([]),
      users: fakeUsersRepo([
        user({ role: "driver", status: "active" }),
        user({ role: "driver", status: "active" }),
        user({ role: "supervisor", status: "active" }),
      ]),
      locations: fakeLocationsRepo([]),
    });

    const summary = await service.getSummary();

    expect(summary.driversActive).toBe(2);
  });

  it("counts a driver as online only if their last ping is within 5 minutes", async () => {
    const now = Date.now();
    const service = createDashboardService({
      routes: fakeRoutesRepo([]),
      vehicles: fakeVehiclesRepo([]),
      users: fakeUsersRepo([]),
      locations: fakeLocationsRepo([
        location({ recordedAt: new Date(now - 1000).toISOString() }),
        location({ recordedAt: new Date(now - 4 * 60 * 1000).toISOString() }),
        location({ recordedAt: new Date(now - 10 * 60 * 1000).toISOString() }),
      ]),
    });

    const summary = await service.getSummary();

    expect(summary.driversOnline).toBe(2);
  });
});
