import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Router } from "../../core/http/router";
import type { Row, RpcHandler } from "../../test-support/fake-supabase";
import { createFakeSupabase } from "../../test-support/fake-supabase";

const getUsersReadable: RpcHandler = (tables) => tables.users ?? [];
const createUserEncrypted: RpcHandler = (tables, args) => {
  const now = new Date().toISOString();
  const row: Row = {
    id: crypto.randomUUID(),
    auth_user_id: args.p_auth_user_id,
    role: args.p_role,
    active: true,
    deactivated_at: null,
    deactivated_by: null,
    created_at: now,
    updated_at: now,
  };
  tables.users = [...(tables.users ?? []), row];
  return [row];
};

const fake = createFakeSupabase({
  rpcHandlers: { get_users_readable: getUsersReadable, create_user_encrypted: createUserEncrypted },
});
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

const AUTH_USER_ID = "auth-1";

function seedUser(role: "driver" | "supervisor" | "admin" | "super_admin") {
  fake.tables.users = [
    {
      id: "user-1",
      auth_user_id: AUTH_USER_ID,
      role,
      active: true,
      deactivated_at: null,
      deactivated_by: null,
      created_at: "t",
      updated_at: "t",
    },
  ];
  fake.setAuthUser({ id: AUTH_USER_ID });
}

async function buildRouter() {
  const { registerUsersRoutes } = await import("./users.routes");
  const router = new Router();
  registerUsersRoutes(router);
  return router;
}

beforeEach(() => {
  fake.reset({ users: [], audit_logs: [] });
});

describe("users HTTP routes", () => {
  it("GET /users as driver returns 403 (not admin/supervisor/super_admin)", async () => {
    seedUser("driver");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users", { headers: { authorization: "Bearer t" } }),
    );
    expect(res.status).toBe(403);
  });

  it("POST /users as supervisor returns 403 (only admin/super_admin can create)", async () => {
    seedUser("supervisor");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users", {
        method: "POST",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({ authUserId: crypto.randomUUID(), name: "Nuevo", role: "driver" }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("POST /users as admin creates a user and logs user.created", async () => {
    seedUser("admin");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users", {
        method: "POST",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({
          authUserId: crypto.randomUUID(),
          name: "Nuevo Conductor",
          role: "driver",
        }),
      }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { name: string; role: string };
    expect(body).toMatchObject({ name: "Nuevo Conductor", role: "driver" });
    expect(fake.tables.audit_logs).toHaveLength(1);
    expect(fake.tables.audit_logs?.[0]).toMatchObject({ action: "user.created" });
  });

  it("DELETE /users/:id for a missing user returns 404 and does not log", async () => {
    seedUser("admin");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users/missing", {
        method: "DELETE",
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(res.status).toBe(404);
    expect(fake.tables.audit_logs ?? []).toHaveLength(0);
  });
});
