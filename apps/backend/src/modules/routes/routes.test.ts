import { describe, expect, it } from "bun:test";
import type { AuthUser, Route } from "@torpreca/shared";
import type { RoutesRepository } from "./routes.repository";
import { createRoutesService } from "./routes.service";

// In-memory fake of the repository — same pattern as vehicles.test.ts / users.test.ts.
function createFakeRepo(seed: Route[] = []): RoutesRepository {
  const routes = [...seed];

  return {
    async list(filter = {}) {
      return routes.filter((r) => {
        if (filter.driverId && r.driverId !== filter.driverId) return false;
        if (filter.date && r.date !== filter.date) return false;
        return true;
      });
    },
    async getById(id) {
      return routes.find((r) => r.id === id) ?? null;
    },
    async create(input, createdBy) {
      const created: Route = {
        id: crypto.randomUUID(),
        code: input.code,
        driverId: input.driverId,
        vehicleId: input.vehicleId,
        createdBy,
        date: input.date,
        status: "pending",
        plannedKm: input.plannedKm,
        drivenKm: 0,
        startTime: null,
        endTime: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      routes.push(created);
      return created;
    },
    async start(id, driverId) {
      const route = routes.find(
        (r) => r.id === id && r.driverId === driverId && r.status === "pending",
      );
      if (!route) return null;
      route.status = "in_progress";
      route.startTime = new Date().toISOString();
      return route;
    },
    async finish(id, driverId, drivenKm) {
      const route = routes.find(
        (r) => r.id === id && r.driverId === driverId && r.status === "in_progress",
      );
      if (!route) return null;
      route.status = "completed";
      route.endTime = new Date().toISOString();
      route.drivenKm = drivenKm;
      return route;
    },
  };
}

const driver: AuthUser = { id: "driver-1", role: "driver", active: true };
const otherDriver: AuthUser = { id: "driver-2", role: "driver", active: true };
const admin: AuthUser = { id: "admin-1", role: "admin", active: true };

describe("routes.service", () => {
  it("creates a new route", async () => {
    const service = createRoutesService(createFakeRepo());
    const route = await service.create(
      { code: "R-1", driverId: driver.id, vehicleId: null, date: "2026-08-21", plannedKm: 10 },
      admin.id,
    );

    expect(route.code).toBe("R-1");
    expect(route.status).toBe("pending");
    expect(route.createdBy).toBe(admin.id);
  });

  it("scopes list() to the driver's own routes", async () => {
    const repo = createFakeRepo();
    const service = createRoutesService(repo);
    await service.create(
      { code: "R-1", driverId: driver.id, vehicleId: null, date: "2026-08-21", plannedKm: null },
      admin.id,
    );
    await service.create(
      {
        code: "R-2",
        driverId: otherDriver.id,
        vehicleId: null,
        date: "2026-08-21",
        plannedKm: null,
      },
      admin.id,
    );

    const driverRoutes = await service.list(driver);
    expect(driverRoutes).toHaveLength(1);
    expect(driverRoutes[0]?.driverId).toBe(driver.id);

    const adminRoutes = await service.list(admin);
    expect(adminRoutes).toHaveLength(2);
  });

  it("throws ForbiddenError when a driver reads another driver's route", async () => {
    const repo = createFakeRepo();
    const service = createRoutesService(repo);
    const route = await service.create(
      {
        code: "R-1",
        driverId: otherDriver.id,
        vehicleId: null,
        date: "2026-08-21",
        plannedKm: null,
      },
      admin.id,
    );

    await expect(service.getById(route.id, driver)).rejects.toThrow(
      "This route belongs to another driver",
    );
  });

  it("throws NotFoundError for a missing id", async () => {
    const service = createRoutesService(createFakeRepo());
    await expect(service.getById("no-existe", admin)).rejects.toThrow("Route not found");
  });

  it("starts a route owned by the driver", async () => {
    const repo = createFakeRepo();
    const service = createRoutesService(repo);
    const route = await service.create(
      { code: "R-1", driverId: driver.id, vehicleId: null, date: "2026-08-21", plannedKm: null },
      admin.id,
    );

    const started = await service.start(route.id, driver.id);
    expect(started.status).toBe("in_progress");
    expect(started.startTime).not.toBeNull();
  });

  it("rejects starting a route that belongs to another driver", async () => {
    const repo = createFakeRepo();
    const service = createRoutesService(repo);
    const route = await service.create(
      {
        code: "R-1",
        driverId: otherDriver.id,
        vehicleId: null,
        date: "2026-08-21",
        plannedKm: null,
      },
      admin.id,
    );

    await expect(service.start(route.id, driver.id)).rejects.toThrow(
      "This route belongs to another driver",
    );
  });

  it("rejects starting a route that isn't pending", async () => {
    const repo = createFakeRepo();
    const service = createRoutesService(repo);
    const route = await service.create(
      { code: "R-1", driverId: driver.id, vehicleId: null, date: "2026-08-21", plannedKm: null },
      admin.id,
    );
    await service.start(route.id, driver.id);

    await expect(service.start(route.id, driver.id)).rejects.toThrow(
      "Route cannot be started (not pending)",
    );
  });

  it("finishes a route in progress", async () => {
    const repo = createFakeRepo();
    const service = createRoutesService(repo);
    const route = await service.create(
      { code: "R-1", driverId: driver.id, vehicleId: null, date: "2026-08-21", plannedKm: null },
      admin.id,
    );
    await service.start(route.id, driver.id);

    const finished = await service.finish(route.id, driver.id, 42);
    expect(finished.status).toBe("completed");
    expect(finished.drivenKm).toBe(42);
  });

  it("rejects finishing a route that hasn't started", async () => {
    const repo = createFakeRepo();
    const service = createRoutesService(repo);
    const route = await service.create(
      { code: "R-1", driverId: driver.id, vehicleId: null, date: "2026-08-21", plannedKm: null },
      admin.id,
    );

    await expect(service.finish(route.id, driver.id, 10)).rejects.toThrow(
      "Route cannot be finished (not in progress)",
    );
  });

  it("rejects finishing a route that belongs to another driver", async () => {
    const repo = createFakeRepo();
    const service = createRoutesService(repo);
    const route = await service.create(
      {
        code: "R-1",
        driverId: otherDriver.id,
        vehicleId: null,
        date: "2026-08-21",
        plannedKm: null,
      },
      admin.id,
    );
    await service.start(route.id, otherDriver.id);

    await expect(service.finish(route.id, driver.id, 10)).rejects.toThrow(
      "This route belongs to another driver",
    );
  });
});
