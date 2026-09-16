import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Router } from "../../core/http/router";
import { createFakeSupabase } from "../../test-support/fake-supabase";

const fake = createFakeSupabase();
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

const SUPER_ADMIN_AUTH_ID = "auth-super-admin";
const ADMIN_AUTH_ID = "auth-admin";
const DRIVER_AUTH_ID = "auth-driver";

function seedUsers() {
  fake.tables.users = [
    {
      id: "super-1",
      auth_user_id: SUPER_ADMIN_AUTH_ID,
      role: "super_admin",
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
    {
      id: "driver-1",
      auth_user_id: DRIVER_AUTH_ID,
      role: "driver",
      status: "active",
      created_at: "t",
      updated_at: "t",
    },
  ];
}

async function buildRouter() {
  const { registerAuditLogsRoutes } = await import("./audit-logs.routes");
  const router = new Router();
  registerAuditLogsRoutes(router);
  return router;
}

beforeEach(() => {
  fake.reset({ audit_logs: [], users: [] });
  seedUsers();
});

describe("audit-logs HTTP routes", () => {
  it("GET /audit-logs as super_admin returns every log", async () => {
    fake.tables.audit_logs = [
      {
        id: "l1",
        user_id: "driver-1",
        role: "driver",
        action: "route.started",
        entity: "routes",
        entity_id: "r1",
        ip: null,
        metadata: null,
        created_at: "t",
        updated_at: "t",
      },
    ];
    fake.setAuthUser({ id: SUPER_ADMIN_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/audit-logs", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body).toHaveLength(1);
  });

  it("GET /audit-logs as admin returns 403 (super_admin-only)", async () => {
    fake.setAuthUser({ id: ADMIN_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/audit-logs", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(403);
  });

  it("GET /audit-logs as driver returns 403 (super_admin-only)", async () => {
    fake.setAuthUser({ id: DRIVER_AUTH_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/audit-logs", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(403);
  });

  it("GET /audit-logs without a token returns 401", async () => {
    const router = await buildRouter();

    const res = await router.handle(new Request("http://x/audit-logs"));

    expect(res.status).toBe(401);
  });
});
