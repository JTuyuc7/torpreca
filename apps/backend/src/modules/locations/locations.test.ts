import { describe, expect, it } from "bun:test";
import type { AuthUser, Location, Route } from "@torpreca/shared";
import type { RoutesRepository } from "../routes/routes.repository";
import type { LocationsRepository } from "./locations.repository";
import { createLocationsService } from "./locations.service";

function createFakeRoutesRepo(seed: Route[]): RoutesRepository {
  return {
    async list() {
      return seed;
    },
    async getById(id) {
      return seed.find((r) => r.id === id) ?? null;
    },
    async create() {
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

function createFakeLocationsRepo(seed: Location[] = []): LocationsRepository {
  const locations = [...seed];

  return {
    async create(input, driverId) {
      const created: Location = {
        id: crypto.randomUUID(),
        driverId,
        routeId: input.routeId,
        lat: input.lat,
        lng: input.lng,
        speed: input.speed,
        recordedAt: input.recordedAt,
        synced: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      locations.push(created);
      return created;
    },
    async listByRoute(routeId) {
      return locations.filter((l) => l.routeId === routeId);
    },
    async listLatestPerDriver() {
      return locations;
    },
  };
}

const driver: AuthUser = { id: "driver-1", role: "driver", status: "active" };
const otherDriver: AuthUser = { id: "driver-2", role: "driver", status: "active" };
const admin: AuthUser = { id: "admin-1", role: "admin", status: "active" };

const baseRoute: Route = {
  id: "route-1",
  code: "R-1",
  driverId: driver.id,
  vehicleId: null,
  createdBy: admin.id,
  date: "2026-08-23",
  status: "in_progress",
  plannedKm: null,
  drivenKm: 0,
  startTime: new Date().toISOString(),
  endTime: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const pingInput = {
  routeId: baseRoute.id,
  lat: 14.6,
  lng: -90.5,
  speed: 10,
  recordedAt: new Date().toISOString(),
};

describe("locations.service", () => {
  it("records a ping for the owning driver, deriving driverId server-side", async () => {
    const service = createLocationsService(
      createFakeLocationsRepo(),
      createFakeRoutesRepo([baseRoute]),
    );
    const location = await service.recordPing(pingInput, driver);

    expect(location.driverId).toBe(driver.id);
    expect(location.routeId).toBe(baseRoute.id);
  });

  it("rejects a ping for another driver's route", async () => {
    const service = createLocationsService(
      createFakeLocationsRepo(),
      createFakeRoutesRepo([baseRoute]),
    );
    await expect(service.recordPing(pingInput, otherDriver)).rejects.toThrow(
      "This route belongs to another driver",
    );
  });

  it("allows admin to list a route's history without an ownership check", async () => {
    const locationsRepo = createFakeLocationsRepo();
    const service = createLocationsService(locationsRepo, createFakeRoutesRepo([baseRoute]));
    await service.recordPing(pingInput, driver);

    const history = await service.listByRoute(baseRoute.id, admin);
    expect(history).toHaveLength(1);
  });

  it("rejects another driver listing a route's history", async () => {
    const locationsRepo = createFakeLocationsRepo();
    const service = createLocationsService(locationsRepo, createFakeRoutesRepo([baseRoute]));
    await service.recordPing(pingInput, driver);

    await expect(service.listByRoute(baseRoute.id, otherDriver)).rejects.toThrow(
      "This route belongs to another driver",
    );
  });
});
