import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Router } from "../../core/http/router";
import type { Row, RpcHandler } from "../../test-support/fake-supabase";
import { createFakeSupabase } from "../../test-support/fake-supabase";

// stopsRepository reads/writes customer_name/address through RPCs (they're
// encrypted at rest) — see stops.repository.test.ts for the same handlers.
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

const updateStopEncrypted: RpcHandler = (tables, args) =>
  updateGuarded(tables, args, {
    customer_name: args.p_customer_name,
    address: args.p_address,
    lat: args.p_lat,
    lng: args.p_lng,
    instructions: args.p_instructions,
  });

const reorderStops: RpcHandler = (tables, args) => {
  (args.p_stop_ids as string[]).forEach((id, i) => {
    const row = (tables.stops ?? []).find((r) => r.id === id && r.route_id === args.p_route_id);
    if (row) row.order_index = i + 1;
  });
  return [];
};

const fake = createFakeSupabase({
  insertDefaults: { stops: { status: "pending" } },
  rpcHandlers: {
    get_stops_readable: getStopsReadable,
    create_stop_encrypted: createStopEncrypted,
    complete_stop_encrypted: completeStopEncrypted,
    delay_stop_encrypted: delayStopEncrypted,
    update_stop_encrypted: updateStopEncrypted,
    reorder_stops: reorderStops,
  },
});
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

const DRIVER_AUTH_ID = "auth-driver";
const OTHER_DRIVER_AUTH_ID = "auth-other-driver";
const ADMIN_AUTH_ID = "auth-admin";

function seedUsers() {
  fake.tables.users = [
    {
      id: "driver-1",
      auth_user_id: DRIVER_AUTH_ID,
      role: "driver",
      status: "active",
      created_at: "t",
      updated_at: "t",
    },
    {
      id: "driver-2",
      auth_user_id: OTHER_DRIVER_AUTH_ID,
      role: "driver",
      status: "active",
      created_at: "t",
      updated_at: "t",
    },
    {
      id: "admin-1",
      auth_user_id: ADMIN_AUTH_ID,
      role: "admin",
      status: "active",
      created_at: "t",
      updated_at: "t",
    },
  ];
}

function seedRouteAndStop() {
  fake.tables.routes = [
    {
      id: "r1",
      code: "R-1",
      driver_id: "driver-1",
      vehicle_id: null,
      created_by: "admin-1",
      date: "2026-08-22",
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
      id: "s1",
      route_id: "r1",
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
  const { registerStopsRoutes, registerMobileStopsRoutes } = await import("./stops.routes");
  const router = new Router();
  registerStopsRoutes(router);
  registerMobileStopsRoutes(router);
  return router;
}

beforeEach(() => {
  fake.reset({ routes: [], stops: [], users: [], audit_logs: [] });
  seedUsers();
  seedRouteAndStop();
});

describe("stops HTTP routes", () => {
  it("GET /routes/:routeId/stops for another driver's route returns 403", async () => {
    fake.setAuthUser({ id: OTHER_DRIVER_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/routes/r1/stops", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(403);
  });

  it("GET /routes/:routeId/stops for the owning driver returns 200", async () => {
    fake.setAuthUser({ id: DRIVER_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/routes/r1/stops", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body).toHaveLength(1);
  });

  it("POST /routes/:routeId/stops as driver returns 403 (only admin/supervisor/super_admin create)", async () => {
    fake.setAuthUser({ id: DRIVER_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/routes/r1/stops", {
        method: "POST",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({
          order: 2,
          customerName: "Otro Cliente",
          address: "Calle 2",
          lat: 14.6,
          lng: -90.5,
          instructions: null,
        }),
      }),
    );

    expect(res.status).toBe(403);
  });

  describe("stop management (TOR-137)", () => {
    // z.uuid() on the reorder body needs a real uuid; the seeded stop is "s1".
    const STOP_ID = "11111111-1111-4111-8111-111111111111";
    const stopBody = {
      customerName: "Nuevo Cliente",
      address: "Calle 2",
      lat: 14.6,
      lng: -90.5,
      instructions: null,
    };

    // Own IP so these requests don't drain the shared "unknown" rate-limit bucket
    // (same fix as users.routes.test.ts / favorite-routes.routes.test.ts).
    const IP = "203.0.113.77";

    function request(method: string, path: string, body?: unknown) {
      return new Request(`http://x${path}`, {
        method,
        headers: {
          authorization: "Bearer t",
          "content-type": "application/json",
          "x-forwarded-for": IP,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }

    beforeEach(() => {
      fake.setAuthUser({ id: ADMIN_AUTH_ID });
      // Stops are only editable while their route is still pending.
      fake.tables.routes![0]!.status = "pending";
      fake.tables.stops![0]!.id = STOP_ID;
    });

    it("POST appends a stop after the last one when no order is given", async () => {
      const router = await buildRouter();
      const res = await router.handle(request("POST", "/routes/r1/stops", stopBody));

      expect(res.status).toBe(201);
      expect(await res.json()).toMatchObject({ customerName: "Nuevo Cliente", order: 2 });
    });

    it("POST on a route that already started returns 409", async () => {
      fake.tables.routes![0]!.status = "in_progress";
      const router = await buildRouter();
      const res = await router.handle(request("POST", "/routes/r1/stops", stopBody));
      expect(res.status).toBe(409);
    });

    it("PATCH /stops/:id edits the stop", async () => {
      const router = await buildRouter();
      const res = await router.handle(request("PATCH", `/stops/${STOP_ID}`, stopBody));

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ id: STOP_ID, customerName: "Nuevo Cliente" });
    });

    it("PATCH /stops/:id rejects an invalid body with 400", async () => {
      const router = await buildRouter();
      const res = await router.handle(
        request("PATCH", `/stops/${STOP_ID}`, { ...stopBody, lat: 999 }),
      );
      expect(res.status).toBe(400);
    });

    it("DELETE /stops/:id removes the stop (204) and 404s afterwards", async () => {
      const router = await buildRouter();
      const first = await router.handle(request("DELETE", `/stops/${STOP_ID}`));
      const second = await router.handle(request("DELETE", `/stops/${STOP_ID}`));

      expect(first.status).toBe(204);
      expect(second.status).toBe(404);
    });

    it("PATCH /routes/:routeId/stops/order reorders and returns the stops", async () => {
      const router = await buildRouter();
      const res = await router.handle(
        request("PATCH", "/routes/r1/stops/order", { stopIds: [STOP_ID] }),
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toHaveLength(1);
    });

    it("PATCH /routes/:routeId/stops/order with a wrong id set returns 400", async () => {
      const router = await buildRouter();
      const res = await router.handle(
        request("PATCH", "/routes/r1/stops/order", { stopIds: [crypto.randomUUID()] }),
      );
      expect(res.status).toBe(400);
    });

    it("editing endpoints are closed to drivers (403)", async () => {
      fake.setAuthUser({ id: DRIVER_AUTH_ID });
      const router = await buildRouter();

      expect((await router.handle(request("PATCH", `/stops/${STOP_ID}`, stopBody))).status).toBe(
        403,
      );
      expect((await router.handle(request("DELETE", `/stops/${STOP_ID}`))).status).toBe(403);
      expect(
        (await router.handle(request("PATCH", "/routes/r1/stops/order", { stopIds: [STOP_ID] })))
          .status,
      ).toBe(403);
    });
  });

  it("PATCH /stops/:id/complete as the owning driver logs stop.completed", async () => {
    fake.setAuthUser({ id: DRIVER_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/stops/s1/complete", {
        method: "PATCH",
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("completed");
    expect(fake.tables.audit_logs?.[0]).toMatchObject({ action: "stop.completed" });
  });

  it("PATCH /stops/:id/complete for another driver's route returns 403", async () => {
    fake.setAuthUser({ id: OTHER_DRIVER_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/stops/s1/complete", {
        method: "PATCH",
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(res.status).toBe(403);
  });

  it("PATCH /stops/:id/complete twice returns 409 the second time", async () => {
    fake.setAuthUser({ id: DRIVER_AUTH_ID });
    const router = await buildRouter();

    await router.handle(
      new Request("http://x/stops/s1/complete", {
        method: "PATCH",
        headers: { authorization: "Bearer t" },
      }),
    );
    const second = await router.handle(
      new Request("http://x/stops/s1/complete", {
        method: "PATCH",
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(second.status).toBe(409);
  });

  it("GET /mobile/routes/:routeId/stops for the owning driver returns 200", async () => {
    fake.setAuthUser({ id: DRIVER_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/routes/r1/stops", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body).toHaveLength(1);
  });

  it("GET /mobile/routes/:routeId/stops for another driver's route returns 403", async () => {
    fake.setAuthUser({ id: OTHER_DRIVER_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/routes/r1/stops", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(403);
  });

  it("GET /mobile/routes/:routeId/stops as admin returns 403 (driver-only)", async () => {
    fake.setAuthUser({ id: ADMIN_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/routes/r1/stops", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(403);
  });

  it("PATCH /mobile/stops/:id/complete as the owning driver logs stop.completed", async () => {
    fake.setAuthUser({ id: DRIVER_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/stops/s1/complete", {
        method: "PATCH",
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("completed");
    expect(fake.tables.audit_logs?.[0]).toMatchObject({ action: "stop.completed" });
  });

  it("PATCH /mobile/stops/:id/complete for another driver's route returns 403", async () => {
    fake.setAuthUser({ id: OTHER_DRIVER_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/stops/s1/complete", {
        method: "PATCH",
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(res.status).toBe(403);
  });

  it("PATCH /mobile/stops/:id/delay as the owning driver logs stop.delayed", async () => {
    fake.setAuthUser({ id: DRIVER_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/stops/s1/delay", {
        method: "PATCH",
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("delayed");
    expect(fake.tables.audit_logs?.[0]).toMatchObject({ action: "stop.delayed" });
  });

  it("PATCH /mobile/stops/:id/complete as admin returns 403 (driver-only)", async () => {
    fake.setAuthUser({ id: ADMIN_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/stops/s1/complete", {
        method: "PATCH",
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(res.status).toBe(403);
  });
});
