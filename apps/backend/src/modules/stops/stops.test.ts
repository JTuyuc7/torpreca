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
    async update(id, input) {
      const stop = stops.find((s) => s.id === id);
      if (!stop || stop.status === "completed") return null;
      Object.assign(stop, input);
      return stop;
    },
    async delete(id) {
      const i = stops.findIndex((s) => s.id === id);
      if (i === -1) return false;
      stops.splice(i, 1);
      return true;
    },
    async reorder(routeId, stopIds) {
      stopIds.forEach((id, i) => {
        const stop = stops.find((s) => s.id === id && s.routeId === routeId);
        if (stop) stop.order = i + 1;
      });
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

const driver: AuthUser = { id: "driver-1", role: "driver", status: "active" };
const otherDriver: AuthUser = { id: "driver-2", role: "driver", status: "active" };
const admin: AuthUser = { id: "admin-1", role: "admin", status: "active" };

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
  const pendingRoute: Route = { ...baseRoute, status: "pending", startTime: null };
  const body = {
    customerName: "Cliente 1",
    address: "Zona 1",
    lat: 14.6,
    lng: -90.5,
    instructions: null,
  };

  it("creates a stop for an existing pending route, appended after the last one", async () => {
    const service = createStopsService(createFakeStopsRepo(), createFakeRoutesRepo([pendingRoute]));
    const first = await service.create(pendingRoute.id, body);
    const second = await service.create(pendingRoute.id, body);

    expect(first.routeId).toBe(pendingRoute.id);
    expect(first.status).toBe("pending");
    expect([first.order, second.order]).toEqual([1, 2]);
  });

  it("honours an explicit order on create", async () => {
    const service = createStopsService(createFakeStopsRepo(), createFakeRoutesRepo([pendingRoute]));
    const stop = await service.create(pendingRoute.id, { ...body, order: 5 });
    expect(stop.order).toBe(5);
  });

  it("throws NotFoundError when the route doesn't exist", async () => {
    const service = createStopsService(createFakeStopsRepo(), createFakeRoutesRepo([]));
    await expect(service.create("no-existe", body)).rejects.toThrow("Route not found");
  });

  it("rejects adding a stop to a route that is no longer pending (409)", async () => {
    const service = createStopsService(createFakeStopsRepo(), createFakeRoutesRepo([baseRoute]));
    await expect(service.create(baseRoute.id, body)).rejects.toThrow(
      "Stops cannot be edited (route is not pending)",
    );
  });

  it("updates a stop's fields", async () => {
    const service = createStopsService(createFakeStopsRepo(), createFakeRoutesRepo([pendingRoute]));
    const stop = await service.create(pendingRoute.id, body);
    const updated = await service.update(stop.id, {
      ...body,
      customerName: "Otro",
      instructions: "Timbre",
    });
    expect(updated.customerName).toBe("Otro");
    expect(updated.instructions).toBe("Timbre");
  });

  it("rejects updating a stop of a non-pending route or an unknown stop", async () => {
    const stopsRepo = createFakeStopsRepo();
    const service = createStopsService(stopsRepo, createFakeRoutesRepo([baseRoute]));
    const stop = await stopsRepo.create({ ...body, routeId: baseRoute.id, order: 1 });
    await expect(service.update(stop.id, body)).rejects.toThrow("Stops cannot be edited");
    await expect(service.update("nope", body)).rejects.toThrow("Stop not found");
  });

  it("deletes a stop, and 404s on an unknown one", async () => {
    const stopsRepo = createFakeStopsRepo();
    const service = createStopsService(stopsRepo, createFakeRoutesRepo([pendingRoute]));
    const stop = await service.create(pendingRoute.id, body);
    await service.remove(stop.id);
    expect(await stopsRepo.listByRoute(pendingRoute.id)).toHaveLength(0);
    await expect(service.remove(stop.id)).rejects.toThrow("Stop not found");
  });

  it("reorders a route's stops and returns them in the new order", async () => {
    const service = createStopsService(createFakeStopsRepo(), createFakeRoutesRepo([pendingRoute]));
    const a = await service.create(pendingRoute.id, { ...body, customerName: "A" });
    const b = await service.create(pendingRoute.id, { ...body, customerName: "B" });

    const result = await service.reorder(pendingRoute.id, { stopIds: [b.id, a.id] });
    expect(
      result
        .map((s) => [s.customerName, s.order])
        .sort((x, y) => (x[1] as number) - (y[1] as number)),
    ).toEqual([
      ["B", 1],
      ["A", 2],
    ]);
  });

  it("rejects a reorder that doesn't list every stop exactly once (400)", async () => {
    const service = createStopsService(createFakeStopsRepo(), createFakeRoutesRepo([pendingRoute]));
    const a = await service.create(pendingRoute.id, body);
    await service.create(pendingRoute.id, body);

    await expect(service.reorder(pendingRoute.id, { stopIds: [a.id] })).rejects.toThrow(
      "exactly once",
    );
    await expect(service.reorder(pendingRoute.id, { stopIds: [a.id, a.id] })).rejects.toThrow(
      "exactly once",
    );
  });

  it("lets the owning driver complete a stop", async () => {
    const stopsRepo = createFakeStopsRepo();
    const service = createStopsService(stopsRepo, createFakeRoutesRepo([baseRoute]));
    const stop = await stopsRepo.create({
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
    const stop = await stopsRepo.create({
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
    const stop = await stopsRepo.create({
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
    const stop = await stopsRepo.create({
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
