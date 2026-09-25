import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Router } from "../../core/http/router";
import type { RpcHandler } from "../../test-support/fake-supabase";
import { createFakeSupabase } from "../../test-support/fake-supabase";

// Finishing a route now also generates that day's daily report (TOR-78),
// which reads the route's stops via stops.repository.ts's
// get_stops_readable RPC — needed here even though this file never creates
// a stop through its own routes.
const getStopsReadable: RpcHandler = (tables) => tables.stops ?? [];

const fake = createFakeSupabase({
  insertDefaults: { routes: { status: "pending", driven_km: 0 } },
  rpcHandlers: { get_stops_readable: getStopsReadable },
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

function asDriver() {
  fake.setAuthUser({ id: DRIVER_AUTH_ID });
}

function asAdmin() {
  fake.setAuthUser({ id: ADMIN_AUTH_ID });
}

async function buildRouter() {
  const { registerRoutesRoutes, registerMobileRoutesRoutes } = await import("./routes.routes");
  const router = new Router();
  registerRoutesRoutes(router);
  registerMobileRoutesRoutes(router);
  return router;
}

beforeEach(() => {
  fake.reset({ routes: [], stops: [], daily_reports: [], audit_logs: [] });
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

  it("PATCH /routes/:id as supervisor edits a pending route and logs route.updated", async () => {
    fake.tables.users!.push({
      id: "sup-1",
      auth_user_id: "auth-sup",
      role: "supervisor",
      status: "active",
      created_at: "t",
      updated_at: "t",
    });
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
    fake.setAuthUser({ id: "auth-sup" });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/routes/r1", {
        method: "PATCH",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({ plannedKm: 25 }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { plannedKm: number };
    expect(body.plannedKm).toBe(25);
    expect(fake.tables.audit_logs?.[0]).toMatchObject({ action: "route.updated" });
  });

  it("PATCH /routes/:id as driver returns 403 (only admin/supervisor/super_admin edit)", async () => {
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

    const res = await router.handle(
      new Request("http://x/routes/r1", {
        method: "PATCH",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({ plannedKm: 25 }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("PATCH /routes/:id/start as a different driver returns 403", async () => {
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

    expect(res.status).toBe(403);
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

    expect(fake.tables.daily_reports).toEqual([
      expect.objectContaining({
        driver_id: "driver-1",
        date: "2026-08-22",
        driven_km: 12.5,
        routes_served: 1,
      }),
    ]);
  });

  it("GET /mobile/routes as driver returns only that driver's routes", async () => {
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
      {
        id: "r2",
        code: "R-2",
        driver_id: "someone-else",
        vehicle_id: null,
        created_by: "admin-1",
        date: "2026-08-22",
        status: "pending",
        planned_km: 5,
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
      new Request("http://x/mobile/routes", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string }[];
    expect(body).toHaveLength(1);
    expect(body[0]?.id).toBe("r1");
  });

  it("GET /mobile/routes as admin returns 403 (driver-only)", async () => {
    asAdmin();
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/routes", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(403);
  });

  it("GET /mobile/routes/:id for another driver's route returns 403", async () => {
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
      new Request("http://x/mobile/routes/r1", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(403);
  });

  describe("driver app start/finish (TOR-138)", () => {
    // Own IP so these requests don't drain the shared "unknown" rate-limit
    // bucket (same fix as users.routes.test.ts / favorite-routes.routes.test.ts).
    const IP = "203.0.113.88";

    function patch(path: string) {
      return new Request(`http://x${path}`, {
        method: "PATCH",
        headers: { authorization: "Bearer t", "x-forwarded-for": IP },
      });
    }

    function seedRoute(overrides: Record<string, unknown> = {}) {
      fake.tables.routes = [
        {
          id: "r1",
          code: "R-1",
          driver_id: "driver-1",
          vehicle_id: null,
          created_by: "admin-1",
          date: "2020-01-01",
          status: "pending",
          planned_km: 10,
          driven_km: 0,
          start_time: null,
          end_time: null,
          created_at: "t",
          updated_at: "t",
          ...overrides,
        },
      ];
    }

    function ping(driverId: string, lat: number, recordedAt: string) {
      return {
        id: crypto.randomUUID(),
        driver_id: driverId,
        route_id: null,
        lat,
        lng: -90.51,
        speed: null,
        recorded_at: recordedAt,
        synced: true,
        created_at: "t",
        updated_at: "t",
      };
    }

    beforeEach(() => {
      fake.tables.locations = [];
      asDriver();
    });

    it("PATCH /mobile/routes/:id/start moves the route to in_progress and logs route.started", async () => {
      seedRoute();
      const router = await buildRouter();

      const res = await router.handle(patch("/mobile/routes/r1/start"));

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ status: "in_progress" });
      expect(fake.tables.audit_logs?.map((l) => l.action)).toEqual(["route.started"]);
    });

    it("PATCH /mobile/routes/:id/start on someone else's route returns 403, as admin returns 403", async () => {
      seedRoute({ driver_id: "someone-else" });
      const router = await buildRouter();
      expect((await router.handle(patch("/mobile/routes/r1/start"))).status).toBe(403);

      seedRoute();
      asAdmin();
      expect((await router.handle(patch("/mobile/routes/r1/start"))).status).toBe(403);
    });

    it("PATCH /mobile/routes/:id/finish measures the km from the driver's pings inside the route window", async () => {
      seedRoute({ status: "in_progress", start_time: "2020-01-01T10:00:00.000Z" });
      fake.tables.locations = [
        // before the route started: must not count
        ping("driver-1", 14.6, "2020-01-01T09:00:00.000Z"),
        ping("driver-1", 14.63, "2020-01-01T10:05:00.000Z"),
        // 0.01 degrees of latitude is ~1.11 km
        ping("driver-1", 14.64, "2020-01-01T10:10:00.000Z"),
        // another driver's pings must not count either
        ping("driver-2", 20, "2020-01-01T10:12:00.000Z"),
      ];
      const router = await buildRouter();

      const res = await router.handle(patch("/mobile/routes/r1/finish"));

      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string; drivenKm: number };
      expect(body.status).toBe("completed");
      expect(body.drivenKm).toBeCloseTo(1.11, 1);
      expect(fake.tables.audit_logs?.map((l) => l.action)).toEqual(["route.finished"]);
      expect(fake.tables.daily_reports).toEqual([
        expect.objectContaining({ driver_id: "driver-1", routes_served: 1 }),
      ]);
    });

    it("finishing with no pings records 0 km instead of failing", async () => {
      seedRoute({ status: "in_progress", start_time: "2020-01-01T10:00:00.000Z" });
      const router = await buildRouter();

      const res = await router.handle(patch("/mobile/routes/r1/finish"));

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ status: "completed", drivenKm: 0 });
    });

    it("PATCH /mobile/routes/:id/finish on a route that was never started returns 409", async () => {
      seedRoute();
      const router = await buildRouter();

      const res = await router.handle(patch("/mobile/routes/r1/finish"));

      expect(res.status).toBe(409);
      expect(fake.tables.audit_logs ?? []).toHaveLength(0);
    });

    it("PATCH /mobile/routes/:id/finish on someone else's route returns 403", async () => {
      seedRoute({
        status: "in_progress",
        driver_id: "someone-else",
        start_time: "2020-01-01T10:00:00.000Z",
      });
      const router = await buildRouter();

      expect((await router.handle(patch("/mobile/routes/r1/finish"))).status).toBe(403);
    });
  });
});
