import { describe, expect, it, mock } from "bun:test";
import type { AuthUser, Location, Route, Stop, SyncQueueItem } from "@torpreca/shared";
import { createFakeSupabase } from "../../test-support/fake-supabase";
import type { LocationsRepository } from "../locations/locations.repository";
import { createLocationsService } from "../locations/locations.service";
import type { RoutesRepository } from "../routes/routes.repository";
import { createRoutesService } from "../routes/routes.service";
import type { StopsRepository } from "../stops/stops.repository";
import { createStopsService } from "../stops/stops.service";
import type { SyncQueueRepository } from "./sync-queue.repository";
import { createSyncQueueService } from "./sync-queue.service";

// The domain services use hand-written fake repositories below (no
// fake-supabase involved), but logEvent (called internally by this service)
// still goes through the real core/audit/log-event.ts -> supabaseAdmin.
// Mocking core/db/supabase here (same pattern as every other test file, not
// mocking log-event.ts itself) keeps it scoped to this file and stops it
// from making a real network call — mocking log-event.ts directly instead
// stuck around for the rest of the test run and silently broke audit_logs
// assertions in unrelated files (users.routes.test.ts, vehicles.routes.test.ts).
const fakeSupabase = createFakeSupabase();
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fakeSupabase.client }));

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
    async start(id, driverId) {
      const route = seed.find(
        (r) => r.id === id && r.driverId === driverId && r.status === "pending",
      );
      if (!route) return null;
      route.status = "in_progress";
      route.startTime = new Date().toISOString();
      return route;
    },
    async finish(id, driverId, drivenKm) {
      const route = seed.find(
        (r) => r.id === id && r.driverId === driverId && r.status === "in_progress",
      );
      if (!route) return null;
      route.status = "completed";
      route.drivenKm = drivenKm;
      return route;
    },
  };
}

function createFakeStopsRepo(seed: Stop[]): StopsRepository {
  return {
    async listByRoute(routeId) {
      return seed.filter((s) => s.routeId === routeId);
    },
    async getById(id) {
      return seed.find((s) => s.id === id) ?? null;
    },
    async create() {
      throw new Error("not used in these tests");
    },
    async complete(id) {
      const stop = seed.find((s) => s.id === id);
      if (!stop || stop.status === "completed") return null;
      stop.status = "completed";
      stop.completedTime = new Date().toISOString();
      return stop;
    },
    async delay(id) {
      const stop = seed.find((s) => s.id === id);
      if (!stop || stop.status === "completed") return null;
      stop.status = "delayed";
      return stop;
    },
  };
}

function createFakeLocationsRepo(): LocationsRepository {
  const locations: Location[] = [];
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

function createFakeSyncQueueRepo(): SyncQueueRepository & { records: SyncQueueItem[] } {
  const records: SyncQueueItem[] = [];
  return {
    records,
    async record(input) {
      const item: SyncQueueItem = {
        id: crypto.randomUUID(),
        userId: input.userId,
        eventType: input.eventType,
        payload: input.payload,
        synced: input.synced,
        recordedAt: input.recordedAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      records.push(item);
      return item;
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
  date: "2026-08-24",
  status: "pending",
  plannedKm: null,
  drivenKm: 0,
  startTime: null,
  endTime: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const baseStop: Stop = {
  id: "stop-1",
  routeId: baseRoute.id,
  order: 1,
  customerName: "Cliente 1",
  address: "Zona 1",
  lat: 14.6,
  lng: -90.5,
  instructions: null,
  status: "pending",
  estimatedTime: null,
  completedTime: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function buildService(routesSeed: Route[], stopsSeed: Stop[]) {
  const routesRepo = createFakeRoutesRepo(routesSeed);
  const routesService = createRoutesService(routesRepo);
  const stopsService = createStopsService(createFakeStopsRepo(stopsSeed), routesRepo);
  const locationsService = createLocationsService(createFakeLocationsRepo(), routesRepo);
  const syncRepo = createFakeSyncQueueRepo();
  const service = createSyncQueueService(syncRepo, locationsService, stopsService, routesService);
  return { service, syncRepo, routesService };
}

describe("sync-queue.service", () => {
  it("applies a location.ping event", async () => {
    const { service, syncRepo } = buildService([{ ...baseRoute }], []);
    const results = await service.drain(
      [
        {
          eventType: "location.ping",
          recordedAt: "2026-08-24T10:00:00.000Z",
          payload: {
            routeId: null,
            lat: 14.6,
            lng: -90.5,
            speed: 10,
            recordedAt: "2026-08-24T10:00:00.000Z",
          },
        },
      ],
      driver,
      null,
    );

    expect(results).toEqual([
      { eventType: "location.ping", recordedAt: "2026-08-24T10:00:00.000Z", status: "applied" },
    ]);
    expect(syncRepo.records).toHaveLength(1);
    expect(syncRepo.records[0]?.synced).toBe(true);
  });

  it("applies a stop.completed event, then treats a repeat as a conflict", async () => {
    const { service, syncRepo } = buildService(
      [{ ...baseRoute, status: "in_progress" }],
      [{ ...baseStop }],
    );
    const event = {
      eventType: "stop.completed" as const,
      recordedAt: "2026-08-24T10:05:00.000Z",
      payload: { stopId: baseStop.id },
    };

    const [first] = await service.drain([event], driver, null);
    expect(first?.status).toBe("applied");

    const [second] = await service.drain([event], driver, null);
    expect(second?.status).toBe("conflict");
    expect(second?.message).toContain("already completed");

    expect(syncRepo.records).toHaveLength(2);
    expect(syncRepo.records.every((r) => r.synced)).toBe(true);
  });

  it("applies route.started then route.finished", async () => {
    const { service } = buildService([{ ...baseRoute }], []);

    const results = await service.drain(
      [
        { eventType: "route.started", recordedAt: "t1", payload: { routeId: baseRoute.id } },
        {
          eventType: "route.finished",
          recordedAt: "t2",
          payload: { routeId: baseRoute.id, drivenKm: 12 },
        },
      ],
      driver,
      null,
    );

    expect(results.map((r) => r.status)).toEqual(["applied", "applied"]);
  });

  it("processes a mixed batch independently — one error doesn't block the rest", async () => {
    const { service, syncRepo } = buildService(
      [
        { ...baseRoute, status: "in_progress" },
        { ...baseRoute, id: "route-2", driverId: otherDriver.id },
      ],
      [{ ...baseStop }],
    );

    const results = await service.drain(
      [
        { eventType: "stop.completed", recordedAt: "t1", payload: { stopId: baseStop.id } },
        { eventType: "stop.completed", recordedAt: "t2", payload: { stopId: baseStop.id } },
        { eventType: "route.started", recordedAt: "t3", payload: { routeId: "route-2" } },
      ],
      driver,
      null,
    );

    expect(results.map((r) => r.status)).toEqual(["applied", "conflict", "error"]);
    expect(results[2]?.message).toContain("another driver");
    // Only the applied + conflict items get a sync_queue row — the error doesn't.
    expect(syncRepo.records).toHaveLength(2);
  });
});
