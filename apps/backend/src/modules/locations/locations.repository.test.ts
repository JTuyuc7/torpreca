import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createFakeSupabase } from "../../test-support/fake-supabase";

const fake = createFakeSupabase();
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

const BASE_ROW = {
  id: "l1",
  driver_id: "driver-1",
  route_id: "r1",
  lat: 14.6,
  lng: -90.5,
  speed: 10,
  recorded_at: "2026-08-23T10:00:00.000Z",
  synced: true,
  created_at: "t",
  updated_at: "t",
};

beforeEach(() => {
  fake.reset({ locations: [] });
});

describe("locationsRepository", () => {
  it("create() maps camelCase input to snake_case columns and marks synced=true", async () => {
    const { locationsRepository } = await import("./locations.repository");

    const location = await locationsRepository.create(
      { routeId: "r1", lat: 14.6, lng: -90.5, speed: 10, recordedAt: "2026-08-23T10:00:00.000Z" },
      "driver-1",
    );

    expect(location).toMatchObject({
      driverId: "driver-1",
      routeId: "r1",
      lat: 14.6,
      lng: -90.5,
      speed: 10,
      synced: true,
    });
  });

  it("listByRoute filters by route and orders by recordedAt ascending", async () => {
    const { locationsRepository } = await import("./locations.repository");
    fake.reset({
      locations: [
        { ...BASE_ROW, id: "l2", recorded_at: "2026-08-23T10:05:00.000Z" },
        { ...BASE_ROW, id: "l1", recorded_at: "2026-08-23T10:00:00.000Z" },
        { ...BASE_ROW, id: "l3", route_id: "r2" },
      ],
    });

    const locations = await locationsRepository.listByRoute("r1");
    expect(locations.map((l) => l.id)).toEqual(["l1", "l2"]);
  });

  it("listLatestPerDriver returns one row per driver, the most recent one", async () => {
    const { locationsRepository } = await import("./locations.repository");
    fake.reset({
      locations: [
        { ...BASE_ROW, id: "l1", driver_id: "driver-1", recorded_at: "2026-08-23T10:00:00.000Z" },
        { ...BASE_ROW, id: "l2", driver_id: "driver-1", recorded_at: "2026-08-23T10:05:00.000Z" },
        { ...BASE_ROW, id: "l3", driver_id: "driver-2", recorded_at: "2026-08-23T10:02:00.000Z" },
      ],
    });

    const latest = await locationsRepository.listLatestPerDriver();
    expect(latest.map((l) => l.id).sort()).toEqual(["l2", "l3"]);
  });
});
