import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Router } from "../../core/http/router";
import { createFakeSupabase } from "../../test-support/fake-supabase";

const fake = createFakeSupabase({ insertDefaults: { stops: { status: "pending" } } });
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
      active: true,
      created_at: "t",
      updated_at: "t",
    },
    {
      id: "driver-2",
      auth_user_id: OTHER_DRIVER_AUTH_ID,
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
  const { registerStopsRoutes } = await import("./stops.routes");
  const router = new Router();
  registerStopsRoutes(router);
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
});
