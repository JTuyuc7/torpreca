import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Router } from "../../core/http/router";
import { createFakeSupabase } from "../../test-support/fake-supabase";

const fake = createFakeSupabase({
  insertDefaults: { routes: { status: "pending", driven_km: 0 } },
});
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

const DRIVER_AUTH_ID = "auth-driver";
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
      id: "admin-1",
      auth_user_id: ADMIN_AUTH_ID,
      role: "admin",
      active: true,
      created_at: "t",
      updated_at: "t",
    },
  ];
}

function asDriver() {
  fake.setAuthUser({ id: DRIVER_AUTH_ID });
}

function asAdmin() {
  fake.setAuthUser({ id: ADMIN_AUTH_ID });
}

async function buildRouter() {
  const { registerRoutesRoutes } = await import("./routes.routes");
  const router = new Router();
  registerRoutesRoutes(router);
  return router;
}

beforeEach(() => {
  fake.reset({ routes: [], audit_logs: [] });
  seedUsers();
});

describe("routes HTTP routes", () => {
  it("POST /routes as driver returns 403 (only admin/supervisor/super_admin create)", async () => {
    asDriver();
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/routes", {
        method: "POST",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({
          code: "R-1",
          driverId: crypto.randomUUID(),
          vehicleId: null,
          date: "2026-08-22",
          plannedKm: 10,
        }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("POST /routes as admin creates a route and logs route.created", async () => {
    asAdmin();
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/routes", {
        method: "POST",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({
          code: "R-1",
          driverId: crypto.randomUUID(),
          vehicleId: null,
          date: "2026-08-22",
          plannedKm: 10,
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(fake.tables.audit_logs?.[0]).toMatchObject({ action: "route.created" });
  });

  it("PATCH /routes/:id/start as a different driver returns 409", async () => {
    fake.tables.routes = [
      {
        id: "r1",
        code: "R-1",
        driver_id: "someone-else",
        vehicle_id: null,
        created_by: "admin-1",
        date: "2026-08-22",
        status: "pending",
        planned_km: 10,
        driven_km: 0,
        start_time: null,
        end_time: null,
        created_at: "t",
        updated_at: "t",
      },
    ];
    asDriver();
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/routes/r1/start", {
        method: "PATCH",
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(res.status).toBe(409);
  });

  it("PATCH /routes/:id/start as admin returns 403 (driver-only action)", async () => {
    fake.tables.routes = [
      {
        id: "r1",
        code: "R-1",
        driver_id: "driver-1",
        vehicle_id: null,
        created_by: "admin-1",
        date: "2026-08-22",
        status: "pending",
        planned_km: 10,
        driven_km: 0,
        start_time: null,
        end_time: null,
        created_at: "t",
        updated_at: "t",
      },
    ];
    asAdmin();
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/routes/r1/start", {
        method: "PATCH",
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(res.status).toBe(403);
  });

  it("start then finish as the owning driver succeeds and logs both events", async () => {
    fake.tables.routes = [
      {
        id: "r1",
        code: "R-1",
        driver_id: "driver-1",
        vehicle_id: null,
        created_by: "admin-1",
        date: "2026-08-22",
        status: "pending",
        planned_km: 10,
        driven_km: 0,
        start_time: null,
        end_time: null,
        created_at: "t",
        updated_at: "t",
      },
    ];
    asDriver();
    const router = await buildRouter();

    const startRes = await router.handle(
      new Request("http://x/routes/r1/start", {
        method: "PATCH",
        headers: { authorization: "Bearer t" },
      }),
    );
    expect(startRes.status).toBe(200);

    const finishRes = await router.handle(
      new Request("http://x/routes/r1/finish", {
        method: "PATCH",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({ drivenKm: 12.5 }),
      }),
    );
    expect(finishRes.status).toBe(200);
    const body = (await finishRes.json()) as { status: string; drivenKm: number };
    expect(body).toMatchObject({ status: "completed", drivenKm: 12.5 });

    expect(fake.tables.audit_logs?.map((l) => l.action)).toEqual([
      "route.started",
      "route.finished",
    ]);
  });
});
