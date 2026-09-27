import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Row } from "../../test-support/fake-supabase";
import { createFakeSupabase } from "../../test-support/fake-supabase";

const fake = createFakeSupabase();
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

function log(overrides: Partial<Row>): Row {
  return {
    id: crypto.randomUUID(),
    user_id: "u1",
    role: "driver",
    action: "route.started",
    entity: "routes",
    entity_id: "r1",
    ip: "127.0.0.1",
    metadata: null,
    created_at: "2026-09-16T08:00:00.000Z",
    updated_at: "t",
    ...overrides,
  };
}

beforeEach(() => {
  fake.reset({ audit_logs: [] });
});

describe("auditLogsRepository", () => {
  it("list() returns a page, newest first, with the total across every matching row", async () => {
    const { auditLogsRepository } = await import("./audit-logs.repository");

    fake.tables.audit_logs = [
      log({ id: "l1", created_at: "2026-09-16T08:00:00.000Z" }),
      log({ id: "l2", created_at: "2026-09-16T10:00:00.000Z" }),
      log({ id: "l3", created_at: "2026-09-16T09:00:00.000Z" }),
    ];

    const page = await auditLogsRepository.list({ limit: 2, offset: 0 });

    expect(page.total).toBe(3);
    expect(page.logs.map((l) => l.id)).toEqual(["l2", "l3"]);
  });

  it("list() offset moves to the next page without changing the total", async () => {
    const { auditLogsRepository } = await import("./audit-logs.repository");

    fake.tables.audit_logs = [
      log({ id: "l1", created_at: "2026-09-16T08:00:00.000Z" }),
      log({ id: "l2", created_at: "2026-09-16T10:00:00.000Z" }),
      log({ id: "l3", created_at: "2026-09-16T09:00:00.000Z" }),
    ];

    const page = await auditLogsRepository.list({ limit: 2, offset: 2 });

    expect(page.total).toBe(3);
    expect(page.logs.map((l) => l.id)).toEqual(["l1"]);
  });

  it("list() filters by action", async () => {
    const { auditLogsRepository } = await import("./audit-logs.repository");

    fake.tables.audit_logs = [
      log({ id: "l1", action: "route.started" }),
      log({ id: "l2", action: "route.finished" }),
    ];

    const page = await auditLogsRepository.list({ action: "route.finished", limit: 20, offset: 0 });

    expect(page.total).toBe(1);
    expect(page.logs.map((l) => l.id)).toEqual(["l2"]);
  });

  it("list() filters by userId", async () => {
    const { auditLogsRepository } = await import("./audit-logs.repository");

    fake.tables.audit_logs = [log({ id: "l1", user_id: "u1" }), log({ id: "l2", user_id: "u2" })];

    const page = await auditLogsRepository.list({ userId: "u2", limit: 20, offset: 0 });

    expect(page.total).toBe(1);
    expect(page.logs.map((l) => l.id)).toEqual(["l2"]);
  });

  it("list() filters by date, matching only that calendar day", async () => {
    const { auditLogsRepository } = await import("./audit-logs.repository");

    fake.tables.audit_logs = [
      log({ id: "l1", created_at: "2026-09-16T08:00:00.000Z" }),
      log({ id: "l2", created_at: "2026-09-16T23:59:59.000Z" }),
      log({ id: "l3", created_at: "2026-09-17T00:00:00.000Z" }),
    ];

    const page = await auditLogsRepository.list({ date: "2026-09-16", limit: 20, offset: 0 });

    expect(page.total).toBe(2);
    expect(page.logs.map((l) => l.id).sort()).toEqual(["l1", "l2"]);
  });

  it("list() returns an empty page when there are no logs yet", async () => {
    const { auditLogsRepository } = await import("./audit-logs.repository");

    const page = await auditLogsRepository.list({ limit: 20, offset: 0 });

    expect(page).toEqual({ logs: [], total: 0 });
  });
});
