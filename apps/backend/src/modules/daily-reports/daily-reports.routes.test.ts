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

  describe("GET /mobile/daily-reports/history", () => {
    // Own IP so these requests don't drain the shared "unknown" rate-limit
    // bucket other test files count on (same fix as routes.routes.test.ts).
    const IP = "203.0.113.90";

    function report(driverId: string, date: string) {
      return {
        id: `dr-${driverId}-${date}`,
        driver_id: driverId,
        date,
        driven_km: 10,
        completed_stops: 3,
        routes_served: 1,
        time_on_route: null,
        generated_at: "t",
        created_at: "t",
        updated_at: "t",
      };
    }

    // 7 days of the driver's own reports plus one of another driver's.
    function seedReports() {
      fake.tables.daily_reports = [
        ...["01", "02", "03", "04", "05", "06", "07"].map((d) =>
          report("driver-1", `2026-09-${d}`),
        ),
        report("driver-2", "2026-09-08"),
      ];
    }

    async function history(query = "") {
      fake.setAuthUser({ id: DRIVER_AUTH_ID });
      const router = await buildRouter();
      return router.handle(
        new Request(`http://x/mobile/daily-reports/history${query}`, {
          headers: { authorization: "Bearer t", "x-forwarded-for": IP },
        }),
      );
    }

    const dates = async (res: Response) =>
      ((await res.json()) as { date: string }[]).map((r) => r.date);

    it("returns the driver's 5 newest reports by default, never someone else's", async () => {
      seedReports();

      const res = await history();

      expect(res.status).toBe(200);
      expect(await dates(res)).toEqual([
        "2026-09-07",
        "2026-09-06",
        "2026-09-05",
        "2026-09-04",
        "2026-09-03",
      ]);
    });

    it("continues after `before` for the next page", async () => {
      seedReports();

      expect(await dates(await history("?before=2026-09-03"))).toEqual([
        "2026-09-02",
        "2026-09-01",
      ]);
    });

    it("filters by an inclusive from/to range and honours limit", async () => {
      seedReports();

      expect(await dates(await history("?from=2026-09-03&to=2026-09-05"))).toEqual([
        "2026-09-05",
        "2026-09-04",
        "2026-09-03",
      ]);
      expect(await dates(await history("?limit=2"))).toEqual(["2026-09-07", "2026-09-06"]);
    });

    it("rejects an invalid query with 400", async () => {
      expect((await history("?limit=0")).status).toBe(400);
      expect((await history("?before=yesterday")).status).toBe(400);
    });

    it("returns 403 for an admin (driver-only)", async () => {
      fake.setAuthUser({ id: ADMIN_AUTH_ID });
      const router = await buildRouter();

      const res = await router.handle(
        new Request("http://x/mobile/daily-reports/history", {
          headers: { authorization: "Bearer t", "x-forwarded-for": IP },
        }),
      );

      expect(res.status).toBe(403);
    });
  });
});
