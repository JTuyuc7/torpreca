import { describe, expect, it } from "bun:test";
import type { AuthUser, Route, Stop } from "@torpreca/shared";
import type { RoutesRepository } from "../routes/routes.repository";
import type { StopsRepository } from "./stops.repository";
import { createStopsService } from "./stops.service";

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

function createFakeStopsRepo(seed: Stop[] = []): StopsRepository {
  const stops = [...seed];

  return {
    async listByRoute(routeId) {
      return stops.filter((s) => s.routeId === routeId);
    },
    async getById(id) {
      return stops.find((s) => s.id === id) ?? null;
    },
    async create(input) {
      const created: Stop = {
        id: crypto.randomUUID(),
        routeId: input.routeId,
        order: input.order,
        customerName: input.customerName,
        address: input.address,
        lat: input.lat,
        lng: input.lng,
        instructions: input.instructions,
        status: "pending",
        estimatedTime: null,
        completedTime: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      stops.push(created);
      return created;
    },
    async complete(id) {
      const stop = stops.find((s) => s.id === id);
      if (!stop || stop.status === "completed") return null;
      stop.status = "completed";
      stop.completedTime = new Date().toISOString();
      return stop;
    },
    async delay(id) {
      const stop = stops.find((s) => s.id === id);
      if (!stop || stop.status === "completed") return null;
      stop.status = "delayed";
      return stop;
    },
  };
}

const driver: AuthUser = { id: "driver-1", role: "driver", active: true };
const otherDriver: AuthUser = { id: "driver-2", role: "driver", active: true };
const admin: AuthUser = { id: "admin-1", role: "admin", active: true };

const baseRoute: Route = {
  id: "route-1",
  code: "R-1",
  driverId: driver.id,
  vehicleId: null,
  createdBy: admin.id,
  date: "2026-08-21",
  status: "in_progress",
  plannedKm: null,
  drivenKm: 0,
  startTime: new Date().toISOString(),
  endTime: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("stops.service", () => {
  it("creates a stop for an existing route", async () => {
    const service = createStopsService(createFakeStopsRepo(), createFakeRoutesRepo([baseRoute]));
    const stop = await service.create({
      routeId: baseRoute.id,
      order: 1,
      customerName: "Cliente 1",
      address: "Zona 1",
      lat: 14.6,
      lng: -90.5,
      instructions: null,
    });

    expect(stop.routeId).toBe(baseRoute.id);
    expect(stop.status).toBe("pending");
  });

  it("throws NotFoundError when the route doesn't exist", async () => {
    const service = createStopsService(createFakeStopsRepo(), createFakeRoutesRepo([]));
    await expect(
      service.create({
        routeId: "no-existe",
        order: 1,
        customerName: "Cliente 1",
        address: "Zona 1",
        lat: 14.6,
        lng: -90.5,
        instructions: null,
      }),
    ).rejects.toThrow("Route not found");
  });

  it("lets the owning driver complete a stop", async () => {
    const stopsRepo = createFakeStopsRepo();
    const service = createStopsService(stopsRepo, createFakeRoutesRepo([baseRoute]));
    const stop = await service.create({
      routeId: baseRoute.id,
      order: 1,
      customerName: "Cliente 1",
      address: "Zona 1",
      lat: 14.6,
      lng: -90.5,
      instructions: null,
    });

    const completed = await service.complete(stop.id, driver);
    expect(completed.status).toBe("completed");
    expect(completed.completedTime).not.toBeNull();
  });

  it("rejects completing a stop on another driver's route", async () => {
    const stopsRepo = createFakeStopsRepo();
    const service = createStopsService(stopsRepo, createFakeRoutesRepo([baseRoute]));
    const stop = await service.create({
      routeId: baseRoute.id,
      order: 1,
      customerName: "Cliente 1",
      address: "Zona 1",
      lat: 14.6,
      lng: -90.5,
      instructions: null,
    });

    await expect(service.complete(stop.id, otherDriver)).rejects.toThrow(
      "This stop belongs to another driver's route",
    );
  });

  it("rejects completing an already-completed stop", async () => {
    const stopsRepo = createFakeStopsRepo();
    const service = createStopsService(stopsRepo, createFakeRoutesRepo([baseRoute]));
    const stop = await service.create({
      routeId: baseRoute.id,
      order: 1,
      customerName: "Cliente 1",
      address: "Zona 1",
      lat: 14.6,
      lng: -90.5,
      instructions: null,
    });
    await service.complete(stop.id, driver);

    await expect(service.complete(stop.id, driver)).rejects.toThrow("Stop is already completed");
  });

  it("lets the owning driver mark a stop as delayed", async () => {
    const stopsRepo = createFakeStopsRepo();
    const service = createStopsService(stopsRepo, createFakeRoutesRepo([baseRoute]));
    const stop = await service.create({
      routeId: baseRoute.id,
      order: 1,
      customerName: "Cliente 1",
      address: "Zona 1",
      lat: 14.6,
      lng: -90.5,
      instructions: null,
    });

    const delayed = await service.delay(stop.id, driver);
    expect(delayed.status).toBe("delayed");
  });
});
