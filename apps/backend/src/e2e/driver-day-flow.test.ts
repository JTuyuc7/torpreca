// TOR-17 — end-to-end integration coverage. Every other *.routes.test.ts in
// this codebase builds a router for ONE module and exercises ONE endpoint at
// a time; this file builds the full router (same modules index.ts wires
// together, minus the raw Bun.serve/WebSocket transport, which isn't
// reachable through Router.handle()) and drives one continuous, realistic
// driver day across route/stop/sync-queue/locations — reusing IDs returned
// from one request as input to the next, exactly like a real client would.
// Still against the in-memory fake Supabase (see test-support/fake-supabase.ts)
// — no real Postgres — but this is the one place the codebase asserts on the
// *interaction* between modules (the sync-queue drain fanning out into
// stops/routes/locations in a single request; ownership holding across every
// endpoint a driver actually touches, not just the one that created a row).
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Router } from "../core/http/router";
import type { Row, RpcHandler } from "../test-support/fake-supabase";
import { createFakeSupabase } from "../test-support/fake-supabase";

// Mirrors modules/stops/stops.routes.test.ts's RPC handlers — stops read/
// write customer_name/address through RPCs (encrypted at rest).
const getStopsReadable: RpcHandler = (tables) => tables.stops ?? [];

const createStopEncrypted: RpcHandler = (tables, args) => {
  const now = new Date().toISOString();
  const row: Row = {
    id: crypto.randomUUID(),
    route_id: args.p_route_id,
    order_index: args.p_order_index,
    customer_name: args.p_customer_name,
    address: args.p_address,
    lat: args.p_lat,
    lng: args.p_lng,
    instructions: args.p_instructions,
    status: "pending",
    estimated_time: null,
    completed_time: null,
    created_at: now,
    updated_at: now,
  };
  tables.stops = [...(tables.stops ?? []), row];
  const { customer_name, address, ...returned } = row;
  return [returned];
};

function updateGuarded(tables: Record<string, Row[]>, args: Record<string, unknown>, patch: Row) {
  const row = (tables.stops ?? []).find((r) => r.id === args.p_id && r.status !== "completed");
  if (!row) return [];
  Object.assign(row, patch, { updated_at: new Date().toISOString() });
  return [row];
}

const completeStopEncrypted: RpcHandler = (tables, args) =>
  updateGuarded(tables, args, { status: "completed", completed_time: new Date().toISOString() });

const delayStopEncrypted: RpcHandler = (tables, args) =>
  updateGuarded(tables, args, { status: "delayed" });

const fake = createFakeSupabase({
  insertDefaults: { routes: { status: "pending", driven_km: 0 }, stops: { status: "pending" } },
  rpcHandlers: {
    get_stops_readable: getStopsReadable,
    create_stop_encrypted: createStopEncrypted,
    complete_stop_encrypted: completeStopEncrypted,
    delay_stop_encrypted: delayStopEncrypted,
  },
});
mock.module("../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

const ADMIN_AUTH_ID = "auth-admin";
const DRIVER_AUTH_ID = "auth-driver";
const OTHER_DRIVER_AUTH_ID = "auth-other-driver";

// `POST /routes` validates driverId as a real z.uuid() — unlike most other
// tests here, this file has to send it back on the wire, so the fixture id
// itself has to be a valid UUID, not a readable slug like "driver-1".
const ADMIN_ID = crypto.randomUUID();
const DRIVER_ID = crypto.randomUUID();
const OTHER_DRIVER_ID = crypto.randomUUID();

function seedUsers() {
  fake.tables.users = [
    {
      id: ADMIN_ID,
      auth_user_id: ADMIN_AUTH_ID,
      role: "admin",
      status: "active",
      created_at: "t",
      updated_at: "t",
    },
    {
      id: DRIVER_ID,
      auth_user_id: DRIVER_AUTH_ID,
      role: "driver",
      status: "active",
      created_at: "t",
      updated_at: "t",
    },
    {
      id: OTHER_DRIVER_ID,
      auth_user_id: OTHER_DRIVER_AUTH_ID,
      role: "driver",
      status: "active",
      created_at: "t",
      updated_at: "t",
    },
  ];
}

async function buildFullRouter() {
  const { registerRoutesRoutes, registerMobileRoutesRoutes } = await import(
    "../modules/routes/routes.routes"
  );
  const { registerStopsRoutes, registerMobileStopsRoutes } = await import(
    "../modules/stops/stops.routes"
  );
  const { registerMobileSyncQueueRoutes } = await import("../modules/sync-queue/sync-queue.routes");

  const router = new Router();
  registerRoutesRoutes(router);
  registerMobileRoutesRoutes(router);
  registerStopsRoutes(router);
  registerMobileStopsRoutes(router);
  registerMobileSyncQueueRoutes(router);
  return router;
}

beforeEach(() => {
  fake.reset({ routes: [], stops: [], locations: [], sync_queue: [], audit_logs: [] });
  seedUsers();
});

describe("driver day — end to end across routes, stops, locations and sync-queue", () => {
  it("plans a route, the driver works it via /mobile, then syncs offline progress and finishes", async () => {
    const router = await buildFullRouter();
    const today = new Date().toISOString().slice(0, 10);

    // 1. Admin plans the route.
    fake.setAuthUser({ id: ADMIN_AUTH_ID });
    const createRouteRes = await router.handle(
      new Request("http://x/routes", {
        method: "POST",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({
          code: "R-1",
          driverId: DRIVER_ID,
          vehicleId: null,
          date: today,
          plannedKm: 12,
        }),
      }),
    );
    expect(createRouteRes.status).toBe(201);
    const route = (await createRouteRes.json()) as { id: string };

    // 2. Admin adds its one stop.
    const createStopRes = await router.handle(
      new Request(`http://x/routes/${route.id}/stops`, {
        method: "POST",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({
          order: 1,
          customerName: "Distribuidora Santa María",
          address: "12 Av. 3-45, zona 7",
          lat: 14.6,
          lng: -90.5,
          instructions: null,
        }),
      }),
    );
    expect(createStopRes.status).toBe(201);
    const stop = (await createStopRes.json()) as { id: string };

    // 3. Driver starts the route (signed /routes endpoint — same as the
    //    live-connection path; only reads go through /mobile today).
    fake.setAuthUser({ id: DRIVER_AUTH_ID });
    const startRes = await router.handle(
      new Request(`http://x/routes/${route.id}/start`, {
        method: "PATCH",
        headers: { authorization: "Bearer t" },
      }),
    );
    expect(startRes.status).toBe(200);

    // 4. Driver reads the assigned route + its stop through the unsigned
    //    /mobile endpoints — what the Flutter app actually calls.
    const mobileRoutesRes = await router.handle(
      new Request("http://x/mobile/routes", { headers: { authorization: "Bearer t" } }),
    );
    const mobileRoutes = (await mobileRoutesRes.json()) as { id: string; status: string }[];
    expect(mobileRoutes).toEqual([
      expect.objectContaining({ id: route.id, status: "in_progress" }),
    ]);

    const mobileStopsRes = await router.handle(
      new Request(`http://x/mobile/routes/${route.id}/stops`, {
        headers: { authorization: "Bearer t" },
      }),
    );
    expect((await mobileStopsRes.json()) as unknown[]).toHaveLength(1);

    // 5. A different driver can't see any of it — ownership holds across the
    //    whole flow, not just on whichever endpoint happened to create a row.
    fake.setAuthUser({ id: OTHER_DRIVER_AUTH_ID });
    const otherDriverRoutesRes = await router.handle(
      new Request("http://x/mobile/routes", { headers: { authorization: "Bearer t" } }),
    );
    expect((await otherDriverRoutesRes.json()) as unknown[]).toEqual([]);

    const otherDriverStopsRes = await router.handle(
      new Request(`http://x/mobile/routes/${route.id}/stops`, {
        headers: { authorization: "Bearer t" },
      }),
    );
    expect(otherDriverStopsRes.status).toBe(403);

    // 6. Driver goes offline mid-route: a GPS ping, completing the stop, and
    //    finishing the route all queue locally, then drain in one batch on
    //    reconnect — the real-world case the sync-queue module exists for.
    fake.setAuthUser({ id: DRIVER_AUTH_ID });
    const syncRes = await router.handle(
      new Request("http://x/mobile/sync", {
        method: "POST",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify([
          {
            eventType: "location.ping",
            recordedAt: "2026-09-15T12:00:00.000Z",
            payload: {
              routeId: route.id,
              lat: 14.61,
              lng: -90.51,
              speed: 5,
              recordedAt: "2026-09-15T12:00:00.000Z",
            },
          },
          {
            eventType: "stop.completed",
            recordedAt: "2026-09-15T12:05:00.000Z",
            payload: { stopId: stop.id },
          },
          {
            eventType: "route.finished",
            recordedAt: "2026-09-15T12:10:00.000Z",
            payload: { routeId: route.id, drivenKm: 11.8 },
          },
        ]),
      }),
    );
    expect(syncRes.status).toBe(200);
    const { results } = (await syncRes.json()) as { results: { status: string }[] };
    expect(results.map((r) => r.status)).toEqual(["applied", "applied", "applied"]);

    // 7. Final state, read straight from the tables — not just trusting the
    //    sync response — every piece the driver touched actually landed.
    expect(fake.tables.routes?.[0]).toMatchObject({ status: "completed", driven_km: 11.8 });
    expect(fake.tables.stops?.[0]).toMatchObject({ status: "completed" });
    expect(fake.tables.locations).toHaveLength(1);
    expect(fake.tables.locations?.[0]).toMatchObject({ driver_id: DRIVER_ID, route_id: route.id });

    // 8. The audit trail reads as one coherent story, in order: the two live
    //    events from steps 1 and 3, then the sync drain in the batch's own
    //    order — location.ping has no domain event of its own (only its
    //    sync.completed), stop.completed/route.finished each get both.
    expect(fake.tables.audit_logs?.map((l) => l.action)).toEqual([
      "route.created",
      "route.started",
      "sync.completed",
      "stop.completed",
      "sync.completed",
      "route.finished",
      "sync.completed",
    ]);
  });

  it("re-syncing the same finish event afterward is a no-op conflict, not a duplicate completion", async () => {
    const router = await buildFullRouter();
    const today = new Date().toISOString().slice(0, 10);

    fake.setAuthUser({ id: ADMIN_AUTH_ID });
    const route = (await (
      await router.handle(
        new Request("http://x/routes", {
          method: "POST",
          headers: { authorization: "Bearer t", "content-type": "application/json" },
          body: JSON.stringify({
            code: "R-2",
            driverId: DRIVER_ID,
            vehicleId: null,
            date: today,
            plannedKm: 5,
          }),
        }),
      )
    ).json()) as { id: string };

    fake.setAuthUser({ id: DRIVER_AUTH_ID });
    await router.handle(
      new Request(`http://x/routes/${route.id}/start`, {
        method: "PATCH",
        headers: { authorization: "Bearer t" },
      }),
    );

    const finishEvent = {
      eventType: "route.finished",
      recordedAt: "2026-09-15T13:00:00.000Z",
      payload: { routeId: route.id, drivenKm: 4.2 },
    };

    // Same offline-batch shape the app would actually retry with: the
    // finish event appears twice, as it would if a flaky connection meant
    // the client never saw the first attempt's response and queued it again.
    const syncRes = await router.handle(
      new Request("http://x/mobile/sync", {
        method: "POST",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify([finishEvent, finishEvent]),
      }),
    );

    const { results } = (await syncRes.json()) as { results: { status: string }[] };
    expect(results.map((r) => r.status)).toEqual(["applied", "conflict"]);
    // drivenKm from the first (accepted) attempt only — the retried duplicate
    // never touches the route again.
    expect(fake.tables.routes?.[0]).toMatchObject({ status: "completed", driven_km: 4.2 });
  });
});
