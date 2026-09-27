import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createFakeSupabase } from "../../test-support/fake-supabase";

const fake = createFakeSupabase();
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

beforeEach(() => {
  fake.reset({ daily_reports: [] });
});

describe("dailyReportsRepository", () => {
  it("getByDriverAndDate() returns null when no report exists yet", async () => {
    const { dailyReportsRepository } = await import("./daily-reports.repository");

    const report = await dailyReportsRepository.getByDriverAndDate("driver-1", "2026-09-16");

    expect(report).toBeNull();
  });

  it("upsert() inserts a new row when none exists for that driver/date", async () => {
    const { dailyReportsRepository } = await import("./daily-reports.repository");

    const report = await dailyReportsRepository.upsert({
      driverId: "driver-1",
      date: "2026-09-16",
      drivenKm: 10,
      completedStops: 3,
      routesServed: 1,
      timeOnRoute: "01:30:00",
    });

    expect(report).toMatchObject({ driverId: "driver-1", date: "2026-09-16", drivenKm: 10 });
    expect(fake.tables.daily_reports).toHaveLength(1);
  });

  it("upsert() replaces the existing row for the same driver/date instead of duplicating it", async () => {
    const { dailyReportsRepository } = await import("./daily-reports.repository");

    const first = await dailyReportsRepository.upsert({
      driverId: "driver-1",
      date: "2026-09-16",
      drivenKm: 10,
      completedStops: 3,
      routesServed: 1,
      timeOnRoute: "01:30:00",
    });

    const second = await dailyReportsRepository.upsert({
      driverId: "driver-1",
      date: "2026-09-16",
      drivenKm: 25,
      completedStops: 5,
      routesServed: 2,
      timeOnRoute: "03:00:00",
    });

    expect(fake.tables.daily_reports).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({ drivenKm: 25, completedStops: 5, routesServed: 2 });

    const stored = await dailyReportsRepository.getByDriverAndDate("driver-1", "2026-09-16");
    expect(stored).toMatchObject({ drivenKm: 25 });
  });

  it("upsert() keeps separate rows for different dates or drivers", async () => {
    const { dailyReportsRepository } = await import("./daily-reports.repository");

    await dailyReportsRepository.upsert({
      driverId: "driver-1",
      date: "2026-09-16",
      drivenKm: 10,
      completedStops: 1,
      routesServed: 1,
      timeOnRoute: null,
    });
    await dailyReportsRepository.upsert({
      driverId: "driver-1",
      date: "2026-09-17",
      drivenKm: 5,
      completedStops: 1,
      routesServed: 1,
      timeOnRoute: null,
    });
    await dailyReportsRepository.upsert({
      driverId: "driver-2",
      date: "2026-09-16",
      drivenKm: 8,
      completedStops: 1,
      routesServed: 1,
      timeOnRoute: null,
    });

    expect(fake.tables.daily_reports).toHaveLength(3);
  });
});
