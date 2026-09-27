import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Router } from "../../core/http/router";
import type { RpcHandler } from "../../test-support/fake-supabase";
import { createFakeSupabase } from "../../test-support/fake-supabase";

// Finishing a route now also generates that day's daily report (TOR-78),
// which reads the route's stops via stops.repository.ts's
// get_stops_readable RPC — needed here even though this file never creates
// a stop through its own routes.
const getStopsReadable: RpcHandler = (tables) => tables.stops ?? [];

// "Duplicar" creates the copied stops through the same encrypting RPC the
// stops module uses. `failAtStop` lets a test make the Nth call blow up.
let failAtStop: number | null = null;
let createdStops = 0;
const createStopEncrypted: RpcHandler = (tables, args) => {
  createdStops += 1;
  if (failAtStop === createdStops) throw new Error("create_stop_encrypted failed");
  const row = {
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
    created_at: "t",
    updated_at: "t",
  };
  tables.stops = [...(tables.stops ?? []), row];
  return [row];
};

const fake = createFakeSupabase({
  insertDefaults: { routes: { status: "pending", driven_km: 0 } },
  rpcHandlers: { get_stops_readable: getStopsReadable, create_stop_encrypted: createStopEncrypted },
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
  failAtStop = null;
  createdStops = 0;
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

  describe("overdue routes: close and duplicate", () => {
    const IP = "203.0.113.89";

    function request(method: string, path: string, body?: unknown) {
      return new Request(`http://x${path}`, {
        method,
        headers: {
          authorization: "Bearer t",
          "x-forwarded-for": IP,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
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
          status: "in_progress",
          planned_km: 10,
          driven_km: 0,
          start_time: "2020-01-01T10:00:00.000Z",
          end_time: null,
          created_at: "t",
          updated_at: "t",
          ...overrides,
        },
      ];
    }

    function ping(lat: number, recordedAt: string) {
      return {
        id: crypto.randomUUID(),
        driver_id: "driver-1",
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

    // 0.01 degrees of latitude is ~1.11 km.
    function seedPings() {
      fake.tables.locations = [
        ping(14.63, "2020-01-01T10:05:00.000Z"),
        ping(14.64, "2020-01-01T10:10:00.000Z"),
        // Days after the route's own day — must not be counted against it.
        ping(15.64, "2020-01-05T10:10:00.000Z"),
      ];
    }

    it("PATCH /mobile/routes/:id/finish caps the km and end time at the end of the route's day", async () => {
      seedRoute();
      seedPings();
      asDriver();
      const router = await buildRouter();

      const res = await router.handle(request("PATCH", "/mobile/routes/r1/finish"));

      expect(res.status).toBe(200);
      const body = (await res.json()) as { drivenKm: number; endTime: string };
      expect(body.drivenKm).toBeCloseTo(1.11, 1);
      // 2020-01-01 ends at Guatemala midnight = 06:00Z of the next day.
      expect(body.endTime).toBe("2020-01-02T06:00:00.000Z");
    });

    it("PATCH /mobile/routes/:id/close lets the driver close their overdue route as cancelled", async () => {
      seedRoute();
      seedPings();
      asDriver();
      const router = await buildRouter();

      const res = await router.handle(request("PATCH", "/mobile/routes/r1/close"));

      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string; drivenKm: number };
      expect(body.status).toBe("cancelled");
      expect(body.drivenKm).toBeCloseTo(1.11, 1);
      expect(fake.tables.audit_logs).toEqual([
        expect.objectContaining({
          action: "route.updated",
          entity_id: "r1",
          metadata: expect.objectContaining({ closedIncomplete: true }),
        }),
      ]);
      // A cancelled route doesn't count as a route served.
      expect(fake.tables.daily_reports ?? []).toHaveLength(0);
    });

    it("PATCH /mobile/routes/:id/close on someone else's route returns 403", async () => {
      seedRoute({ driver_id: "someone-else" });
      asDriver();
      const router = await buildRouter();

      expect((await router.handle(request("PATCH", "/mobile/routes/r1/close"))).status).toBe(403);
    });

    it("PATCH /mobile/routes/:id/close on a route that isn't in progress returns 409", async () => {
      seedRoute({ status: "pending", start_time: null });
      asDriver();
      const router = await buildRouter();

      expect((await router.handle(request("PATCH", "/mobile/routes/r1/close"))).status).toBe(409);
    });

    it("PATCH /routes/:id/close lets an admin close a driver's overdue route", async () => {
      seedRoute();
      seedPings();
      asAdmin();
      const router = await buildRouter();

      const res = await router.handle(request("PATCH", "/routes/r1/close"));

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ status: "cancelled" });
      expect(fake.tables.audit_logs?.[0]).toMatchObject({ action: "route.updated" });
    });

    it("PATCH /routes/:id/close as a driver returns 403 (admin-only on the signed route)", async () => {
      seedRoute();
      asDriver();
      const router = await buildRouter();

      expect((await router.handle(request("PATCH", "/routes/r1/close"))).status).toBe(403);
    });

    it("GET /mobile/routes?status=in_progress returns the driver's open routes of any date", async () => {
      seedRoute();
      fake.tables.routes?.push({
        ...(fake.tables.routes[0] as Record<string, unknown>),
        id: "r2",
        code: "R-2",
        date: "2026-09-26",
        status: "pending",
      });
      asDriver();
      const router = await buildRouter();

      const res = await router.handle(request("GET", "/mobile/routes?status=in_progress"));

      expect(res.status).toBe(200);
      expect(((await res.json()) as { id: string }[]).map((r) => r.id)).toEqual(["r1"]);
    });

    it("GET /mobile/routes?status=bogus returns 400", async () => {
      asDriver();
      const router = await buildRouter();

      expect((await router.handle(request("GET", "/mobile/routes?status=bogus"))).status).toBe(400);
    });

    const stopBody = (name: string) => ({
      customerName: name,
      address: `${name} address`,
      lat: 14.6,
      lng: -90.5,
      instructions: null,
    });

    const duplicateBody = (stops: unknown[]) => ({
      code: "R-20260927-01",
      driverId: crypto.randomUUID(),
      vehicleId: null,
      date: "2026-09-27",
      plannedKm: 12,
      stops,
    });

    it("POST /routes/:id/duplicate creates a pending route with the given stops, in order", async () => {
      seedRoute({ status: "pending", start_time: null });
      asAdmin();
      const router = await buildRouter();

      const res = await router.handle(
        request("POST", "/routes/r1/duplicate", duplicateBody([stopBody("A"), stopBody("B")])),
      );

      expect(res.status).toBe(201);
      const created = (await res.json()) as { id: string; status: string; date: string };
      expect(created).toMatchObject({ status: "pending", date: "2026-09-27" });
      expect(fake.tables.routes).toHaveLength(2);
      expect(
        fake.tables.stops?.map((st) => [st.route_id, st.order_index, st.customer_name, st.status]),
      ).toEqual([
        [created.id, 1, "A", "pending"],
        [created.id, 2, "B", "pending"],
      ]);
      expect(fake.tables.audit_logs?.[0]).toMatchObject({
        action: "route.created",
        entity_id: created.id,
        metadata: { duplicatedFrom: "r1" },
      });
    });

    it("POST /routes/:id/duplicate deletes the new route again if a stop fails", async () => {
      seedRoute();
      failAtStop = 2;
      asAdmin();
      const router = await buildRouter();

      const res = await router.handle(
        request("POST", "/routes/r1/duplicate", duplicateBody([stopBody("A"), stopBody("B")])),
      );

      expect(res.status).toBe(500);
      // Only the source route is left; no audit event for a route that never existed.
      expect(fake.tables.routes?.map((r) => r.id)).toEqual(["r1"]);
      expect(fake.tables.audit_logs ?? []).toHaveLength(0);
    });

    it("POST /routes/:id/duplicate on a missing route returns 404", async () => {
      asAdmin();
      const router = await buildRouter();

      const res = await router.handle(
        request("POST", "/routes/nope/duplicate", duplicateBody([stopBody("A")])),
      );

      expect(res.status).toBe(404);
    });

    it("POST /routes/:id/duplicate as a driver returns 403", async () => {
      seedRoute();
      asDriver();
      const router = await buildRouter();

      const res = await router.handle(
        request("POST", "/routes/r1/duplicate", duplicateBody([stopBody("A")])),
      );

      expect(res.status).toBe(403);
    });
  });

  describe("GET /mobile/routes/history (Rutas anteriores)", () => {
    const IP = "203.0.113.91";

    function get(path: string) {
      return new Request(`http://x${path}`, {
        headers: { authorization: "Bearer t", "x-forwarded-for": IP },
      });
    }

    function route(id: string, day: string, status: string, driverId = "driver-1") {
      return {
        id,
        code: `R-${id}`,
        driver_id: driverId,
        vehicle_id: null,
        created_by: "admin-1",
        date: `2026-09-${day}`,
        status,
        planned_km: 10,
        driven_km: 5,
        start_time: null,
        end_time: null,
        // The fake orders by this column only (the real query orders by date
        // first): keep it consistent with the date.
        created_at: `2026-09-${day}T08:00:00.000Z`,
        updated_at: "t",
      };
    }

    function seed() {
      fake.tables.routes = [
        route("a", "01", "completed"),
        route("b", "02", "cancelled"),
        route("c", "03", "completed"),
        route("d", "04", "completed"),
        route("e", "05", "completed"),
        route("f", "06", "completed"),
        route("g", "07", "completed"),
        // Not history: still open, and another driver's.
        route("open", "08", "in_progress"),
        route("todo", "09", "pending"),
        route("other", "10", "completed", "driver-2"),
      ];
    }

    const ids = async (res: Response) => ((await res.json()) as { id: string }[]).map((r) => r.id);

    it("returns the driver's 5 newest finished routes by default", async () => {
      seed();
      asDriver();
      const router = await buildRouter();

      const res = await router.handle(get("/mobile/routes/history"));

      expect(res.status).toBe(200);
      expect(await ids(res)).toEqual(["g", "f", "e", "d", "c"]);
    });

    it("pages with offset and includes routes closed without finishing", async () => {
      seed();
      asDriver();
      const router = await buildRouter();

      expect(await ids(await router.handle(get("/mobile/routes/history?offset=5")))).toEqual([
        "b",
        "a",
      ]);
      expect(
        await ids(await router.handle(get("/mobile/routes/history?limit=2&offset=1"))),
      ).toEqual(["f", "e"]);
    });

    it("filters by an inclusive from/to date range", async () => {
      seed();
      asDriver();
      const router = await buildRouter();

      const res = await router.handle(get("/mobile/routes/history?from=2026-09-03&to=2026-09-05"));

      expect(await ids(res)).toEqual(["e", "d", "c"]);
    });

    it("rejects an invalid query with 400", async () => {
      asDriver();
      const router = await buildRouter();

      expect((await router.handle(get("/mobile/routes/history?limit=0"))).status).toBe(400);
      expect((await router.handle(get("/mobile/routes/history?from=ayer"))).status).toBe(400);
    });

    it("returns 403 for an admin (driver-only)", async () => {
      asAdmin();
      const router = await buildRouter();

      expect((await router.handle(get("/mobile/routes/history"))).status).toBe(403);
    });
  });
});
