import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Router } from "../../core/http/router";
import type { Row, RpcHandler } from "../../test-support/fake-supabase";
import { createFakeSupabase } from "../../test-support/fake-supabase";

// stopsRepository dispatches through RPCs (encrypted columns) — same fake
// handlers as stops.repository.test.ts.
function updateGuarded(tables: Record<string, Row[]>, args: Record<string, unknown>, patch: Row) {
  const row = (tables.stops ?? []).find((r) => r.id === args.p_id && r.status !== "completed");
  if (!row) return [];
  Object.assign(row, patch, { updated_at: new Date().toISOString() });
  return [row];
}

const getStopsReadable: RpcHandler = (tables) => tables.stops ?? [];

const completeStopEncrypted: RpcHandler = (tables, args) =>
  updateGuarded(tables, args, { status: "completed", completed_time: new Date().toISOString() });

const delayStopEncrypted: RpcHandler = (tables, args) =>
  updateGuarded(tables, args, { status: "delayed" });

const fake = createFakeSupabase({
  rpcHandlers: {
    get_stops_readable: getStopsReadable,
    complete_stop_encrypted: completeStopEncrypted,
    delay_stop_encrypted: delayStopEncrypted,
  },
});
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

const DRIVER_AUTH_ID = "auth-driver";
const ADMIN_AUTH_ID = "auth-admin";
const ROUTE_ID = "11111111-1111-4111-8111-111111111111";
const STOP_ID = "22222222-2222-4222-8222-222222222222";

function seedUsers() {
  fake.tables.users = [
    {
      id: "driver-1",
      auth_user_id: DRIVER_AUTH_ID,
      role: "driver",
      active: true,
      created_at: "t",
      updated_at: "t",
    },
    {
      id: "admin-1",
      auth_user_id: ADMIN_AUTH_ID,
      role: "admin",
      active: true,
      created_at: "t",
      updated_at: "t",
    },
  ];
}

function seedRouteAndStop() {
  fake.tables.routes = [
    {
      id: ROUTE_ID,
      code: "R-1",
      driver_id: "driver-1",
      vehicle_id: null,
      created_by: "admin-1",
      date: "2026-08-24",
      status: "in_progress",
      planned_km: 10,
      driven_km: 0,
      start_time: "t",
      end_time: null,
      created_at: "t",
      updated_at: "t",
    },
  ];
  fake.tables.stops = [
    {
      id: STOP_ID,
      route_id: ROUTE_ID,
      order_index: 1,
      customer_name: "Cliente",
      address: "Calle 1",
      lat: 14.6,
      lng: -90.5,
      instructions: null,
      status: "pending",
      estimated_time: null,
      completed_time: null,
      created_at: "t",
      updated_at: "t",
    },
  ];
}

async function buildRouter() {
  const { registerSyncQueueRoutes } = await import("./sync-queue.routes");
  const router = new Router();
  registerSyncQueueRoutes(router);
  return router;
}

beforeEach(() => {
  fake.reset({ routes: [], stops: [], locations: [], sync_queue: [], users: [], audit_logs: [] });
  seedUsers();
  seedRouteAndStop();
});

function post(body: unknown) {
  return new Request("http://x/sync", {
    method: "POST",
    headers: { authorization: "Bearer t", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("sync-queue HTTP routes", () => {
  it("POST /sync without a token returns 401", async () => {
    const router = await buildRouter();
    const res = await router.handle(new Request("http://x/sync", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("POST /sync as admin returns 403 (driver-only)", async () => {
    fake.setAuthUser({ id: ADMIN_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      post([
        {
          eventType: "stop.completed",
          recordedAt: "2026-08-24T10:00:00.000Z",
          payload: { stopId: STOP_ID },
        },
      ]),
    );

    expect(res.status).toBe(403);
  });

  it("POST /sync rejects an empty batch", async () => {
    fake.setAuthUser({ id: DRIVER_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(post([]));
    expect(res.status).toBe(400);
  });

  it("POST /sync rejects a malformed item without processing the rest of the batch", async () => {
    fake.setAuthUser({ id: DRIVER_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      post([
        {
          eventType: "stop.completed",
          recordedAt: "2026-08-24T10:00:00.000Z",
          payload: { stopId: STOP_ID },
        },
        { eventType: "bogus", recordedAt: "2026-08-24T10:00:00.000Z", payload: {} },
      ]),
    );

    expect(res.status).toBe(400);
    expect(fake.tables.stops?.[0]?.status).toBe("pending");
  });

  it("POST /sync processes a mixed batch and reports per-item status", async () => {
    fake.setAuthUser({ id: DRIVER_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      post([
        {
          eventType: "location.ping",
          recordedAt: "2026-08-24T10:00:00.000Z",
          payload: {
            routeId: ROUTE_ID,
            lat: 14.6,
            lng: -90.5,
            speed: 10,
            recordedAt: "2026-08-24T10:00:00.000Z",
          },
        },
        {
          eventType: "stop.completed",
          recordedAt: "2026-08-24T10:01:00.000Z",
          payload: { stopId: STOP_ID },
        },
        {
          eventType: "stop.completed",
          recordedAt: "2026-08-24T10:02:00.000Z",
          payload: { stopId: STOP_ID },
        },
      ]),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: { status: string }[] };
    expect(body.results.map((r) => r.status)).toEqual(["applied", "applied", "conflict"]);
  });
});
