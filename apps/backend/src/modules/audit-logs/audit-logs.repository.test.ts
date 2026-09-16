import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createFakeSupabase } from "../../test-support/fake-supabase";

const fake = createFakeSupabase();
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

beforeEach(() => {
  fake.reset({ audit_logs: [] });
});

describe("auditLogsRepository", () => {
  it("list() returns every row, newest first", async () => {
    const { auditLogsRepository } = await import("./audit-logs.repository");

    fake.tables.audit_logs = [
      {
        id: "l1",
        user_id: "u1",
        role: "driver",
        action: "route.started",
        entity: "routes",
        entity_id: "r1",
        ip: "127.0.0.1",
        metadata: null,
        created_at: "2026-09-16T08:00:00.000Z",
        updated_at: "t",
      },
      {
        id: "l2",
        user_id: "u1",
        role: "driver",
        action: "route.finished",
        entity: "routes",
        entity_id: "r1",
        ip: "127.0.0.1",
        metadata: null,
        created_at: "2026-09-16T10:00:00.000Z",
        updated_at: "t",
      },
    ];

    const logs = await auditLogsRepository.list();

    expect(logs.map((l) => l.id)).toEqual(["l2", "l1"]);
    expect(logs[0]).toMatchObject({ action: "route.finished", userId: "u1" });
  });

  it("list() returns an empty array when there are no logs yet", async () => {
    const { auditLogsRepository } = await import("./audit-logs.repository");

    expect(await auditLogsRepository.list()).toEqual([]);
  });
});
