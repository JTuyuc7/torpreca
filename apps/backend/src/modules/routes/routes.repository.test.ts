import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createFakeSupabase } from "../../test-support/fake-supabase";

const fake = createFakeSupabase({
  insertDefaults: { routes: { status: "pending", driven_km: 0 } },
});
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

const BASE_ROW = {
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
};

beforeEach(() => {
  fake.reset({ routes: [] });
});

describe("routesRepository", () => {
  it("create() applies the pending/driven_km=0 defaults", async () => {
    const { routesRepository } = await import("./routes.repository");

    const route = await routesRepository.create(
      { code: "R-1", driverId: "driver-1", vehicleId: null, date: "2026-08-22", plannedKm: 10 },
      "admin-1",
    );

    expect(route).toMatchObject({
      code: "R-1",
      driverId: "driver-1",
      status: "pending",
      drivenKm: 0,
    });
  });

  it("list(filter) scopes by driverId and date", async () => {
    const { routesRepository } = await import("./routes.repository");
    fake.reset({
      routes: [BASE_ROW, { ...BASE_ROW, id: "r2", driver_id: "driver-2", date: "2026-08-23" }],
    });

    expect((await routesRepository.list({ driverId: "driver-1" })).map((r) => r.id)).toEqual([
      "r1",
    ]);
    expect((await routesRepository.list({ date: "2026-08-23" })).map((r) => r.id)).toEqual(["r2"]);
  });

  it("start() only succeeds for the owning driver while pending", async () => {
    const { routesRepository } = await import("./routes.repository");
    fake.reset({ routes: [BASE_ROW] });

    const wrongDriver = await routesRepository.start("r1", "someone-else");
    expect(wrongDriver).toBeNull();

    const started = await routesRepository.start("r1", "driver-1");
    expect(started?.status).toBe("in_progress");

    const alreadyStarted = await routesRepository.start("r1", "driver-1");
    expect(alreadyStarted).toBeNull();
  });

  it("finish() only succeeds while in_progress and records drivenKm", async () => {
    const { routesRepository } = await import("./routes.repository");
    fake.reset({ routes: [{ ...BASE_ROW, status: "in_progress", start_time: "t" }] });

    const notYourRoute = await routesRepository.finish("r1", "someone-else", 42);
    expect(notYourRoute).toBeNull();

    const finished = await routesRepository.finish("r1", "driver-1", 42);
    expect(finished).toMatchObject({ status: "completed", drivenKm: 42 });
  });
});
