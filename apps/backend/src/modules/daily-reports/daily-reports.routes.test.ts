import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Router } from "../../core/http/router";
import { createFakeSupabase } from "../../test-support/fake-supabase";

const fake = createFakeSupabase();
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

async function buildRouter() {
  const { registerMobileDailyReportsRoutes } = await import("./daily-reports.routes");
  const router = new Router();
  registerMobileDailyReportsRoutes(router);
  return router;
}

beforeEach(() => {
  fake.reset({ daily_reports: [] });
  seedUsers();
});

describe("daily-reports HTTP routes", () => {
  it("GET /mobile/daily-reports?date= returns the driver's own report for that date", async () => {
    fake.tables.daily_reports = [
      {
        id: "dr1",
        driver_id: "driver-1",
        date: "2026-09-16",
        driven_km: 15,
        completed_stops: 4,
        routes_served: 1,
        time_on_route: "01:45:00",
        generated_at: "t",
        created_at: "t",
        updated_at: "t",
      },
    ];
    fake.setAuthUser({ id: DRIVER_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/daily-reports?date=2026-09-16", {
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { drivenKm: number }[];
    expect(body).toEqual([expect.objectContaining({ drivenKm: 15 })]);
  });

  it("GET /mobile/daily-reports returns an empty array, not an error, when nothing was generated yet", async () => {
    fake.setAuthUser({ id: DRIVER_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/daily-reports?date=2026-09-16", {
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("GET /mobile/daily-reports never returns another driver's report", async () => {
    fake.tables.daily_reports = [
      {
        id: "dr1",
        driver_id: "driver-1",
        date: "2026-09-16",
        driven_km: 15,
        completed_stops: 4,
        routes_served: 1,
        time_on_route: null,
        generated_at: "t",
        created_at: "t",
        updated_at: "t",
      },
    ];
    fake.setAuthUser({ id: OTHER_DRIVER_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/daily-reports?date=2026-09-16", {
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(await res.json()).toEqual([]);
  });

  it("GET /mobile/daily-reports as admin returns 403 (driver-only)", async () => {
    fake.setAuthUser({ id: ADMIN_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/daily-reports", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(403);
  });
});
