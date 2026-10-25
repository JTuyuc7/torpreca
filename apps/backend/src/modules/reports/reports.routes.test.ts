import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Router } from "../../core/http/router";
import { createFakeSupabase } from "../../test-support/fake-supabase";

// Names are encrypted at rest: the users repository reads them through this RPC.
const fake = createFakeSupabase({
  rpcHandlers: {
    get_users_readable: (tables) =>
      (tables.users ?? []).map((u) => ({ ...u, name: "Test User", email: "t@example.com" })),
  },
});
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

const DRIVER_AUTH_ID = "auth-driver";
const SUPERVISOR_AUTH_ID = "auth-supervisor";

function seedUsers() {
  fake.tables.users = [
    { id: "driver-1", auth_user_id: DRIVER_AUTH_ID, role: "driver", status: "active" },
    { id: "sup-1", auth_user_id: SUPERVISOR_AUTH_ID, role: "supervisor", status: "active" },
  ].map((u) => ({ ...u, created_at: "t", updated_at: "t" }));
}

async function buildRouter() {
  const { registerReportsRoutes } = await import("./reports.routes");
  const router = new Router();
  registerReportsRoutes(router);
  return router;
}

function get(path: string) {
  return new Request(`http://x${path}`, { headers: { authorization: "Bearer t" } });
}

beforeEach(() => {
  fake.reset({
    routes: [
      {
        id: "r1",
        code: "R-00001",
        driver_id: "driver-1",
        vehicle_id: null,
        created_by: "sup-1",
        date: "2026-01-02",
        status: "completed",
        planned_km: 10,
        driven_km: 11,
        start_time: null,
        end_time: null,
        created_at: "t",
        updated_at: "t",
      },
    ],
    vehicles: [],
  });
  seedUsers();
  fake.setAuthUser({ id: SUPERVISOR_AUTH_ID });
});

describe("reports HTTP routes", () => {
  it("GET /reports/routes returns the aggregates for the range", async () => {
    const res = await (await buildRouter()).handle(
      get("/reports/routes?from=2026-01-01&to=2026-01-03"),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { totals: { routes: number }; byDay: unknown[] };
    expect(body.totals.routes).toBe(1);
    expect(body.byDay).toHaveLength(3);
  });

  it("GET /reports/routes/csv answers a downloadable CSV", async () => {
    const res = await (await buildRouter()).handle(
      get("/reports/routes/csv?from=2026-01-01&to=2026-01-03"),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="routes-2026-01-01_2026-01-03.csv"',
    );
    expect(await res.text()).toContain("R-00001,2026-01-02,completed");
  });

  it("rejects a missing, inverted or too long range with 400", async () => {
    const router = await buildRouter();

    for (const query of [
      "",
      "?from=2026-01-01",
      "?from=2026-01-05&to=2026-01-01",
      "?from=2025-01-01&to=2026-12-31",
      "?from=nope&to=2026-01-01",
    ]) {
      expect((await router.handle(get(`/reports/routes${query}`))).status).toBe(400);
      expect((await router.handle(get(`/reports/routes/csv${query}`))).status).toBe(400);
    }
  });

  it("is closed to drivers (403)", async () => {
    fake.setAuthUser({ id: DRIVER_AUTH_ID });
    const router = await buildRouter();

    expect((await router.handle(get("/reports/routes?from=2026-01-01&to=2026-01-03"))).status).toBe(
      403,
    );
    expect(
      (await router.handle(get("/reports/routes/csv?from=2026-01-01&to=2026-01-03"))).status,
    ).toBe(403);
  });
});
