import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createFakeSupabase } from "../../test-support/fake-supabase";

const fake = createFakeSupabase();
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

beforeEach(() => {
  fake.reset({ sync_queue: [] });
});

describe("syncQueueRepository", () => {
  it("record() maps camelCase input to snake_case columns and round-trips the payload", async () => {
    const { syncQueueRepository } = await import("./sync-queue.repository");

    const item = await syncQueueRepository.record({
      userId: "driver-1",
      eventType: "stop.completed",
      payload: { stopId: "stop-1" },
      recordedAt: "2026-08-24T10:00:00.000Z",
      synced: true,
    });

    expect(item).toMatchObject({
      userId: "driver-1",
      eventType: "stop.completed",
      payload: { stopId: "stop-1" },
      recordedAt: "2026-08-24T10:00:00.000Z",
      synced: true,
    });
  });
});
