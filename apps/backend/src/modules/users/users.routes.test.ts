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
    status: "active",
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

// rateLimitGeneral keys its bucket by x-forwarded-for, defaulting to
// "unknown" — every test file across the whole suite that omits this header
// shares (and can exhaust) that one bucket. Only the TOR-126 role tests below
// use it (added once this file's request count started tripping that shared
// bucket for later-running test files) — same fix as
// favorite-routes.routes.test.ts.
const IP = "203.0.113.55";

function seedUser(role: "driver" | "supervisor" | "admin" | "super_admin") {
  fake.tables.users = [
    {
      id: "user-1",
      auth_user_id: AUTH_USER_ID,
      role,
      status: "active",
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

  it("POST /users as supervisor returns 403 (only super_admin can create)", async () => {
    seedUser("supervisor");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users", {
        method: "POST",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({
          authUserId: crypto.randomUUID(),
          name: "Nuevo",
          email: "nuevo@torpreca.gt",
          role: "driver",
        }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("POST /users as admin returns 403 (only super_admin can create)", async () => {
    seedUser("admin");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users", {
        method: "POST",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({
          authUserId: crypto.randomUUID(),
          name: "Nuevo",
          email: "nuevo@torpreca.gt",
          role: "driver",
        }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("POST /users as super_admin creates a user and logs user.created", async () => {
    seedUser("super_admin");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users", {
        method: "POST",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({
          authUserId: crypto.randomUUID(),
          name: "Nuevo Conductor",
          email: "conductor@torpreca.gt",
          role: "driver",
        }),
      }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { name: string; email: string; role: string };
    expect(body).toMatchObject({
      name: "Nuevo Conductor",
      email: "conductor@torpreca.gt",
      role: "driver",
    });
    expect(fake.tables.audit_logs).toHaveLength(1);
    expect(fake.tables.audit_logs?.[0]).toMatchObject({ action: "user.created" });
  });

  it("POST /users/invite as admin returns 403 (only super_admin can invite)", async () => {
    seedUser("admin");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users/invite", {
        method: "POST",
        headers: {
          authorization: "Bearer t",
          "content-type": "application/json",
          "x-forwarded-for": IP,
        },
        body: JSON.stringify({
          name: "Nueva Supervisora",
          email: "supervisora@torpreca.gt",
          role: "supervisor",
        }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("POST /users/invite as super_admin invites the user and logs user.created", async () => {
    seedUser("super_admin");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users/invite", {
        method: "POST",
        headers: {
          authorization: "Bearer t",
          "content-type": "application/json",
          "x-forwarded-for": IP,
        },
        body: JSON.stringify({
          name: "Nueva Supervisora",
          email: "supervisora@torpreca.gt",
          role: "supervisor",
        }),
      }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { name: string; email: string; role: string };
    expect(body).toMatchObject({
      name: "Nueva Supervisora",
      email: "supervisora@torpreca.gt",
      role: "supervisor",
    });
    expect(fake.authAdmin.invitedUsers).toHaveLength(1);
    expect(fake.tables.audit_logs).toHaveLength(1);
    expect(fake.tables.audit_logs?.[0]).toMatchObject({ action: "user.created" });
  });

  it("POST /users/invite rejects role 'driver' (not invitable)", async () => {
    seedUser("super_admin");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users/invite", {
        method: "POST",
        headers: {
          authorization: "Bearer t",
          "content-type": "application/json",
          "x-forwarded-for": IP,
        },
        body: JSON.stringify({
          name: "Conductor",
          email: "conductor2@torpreca.gt",
          role: "driver",
        }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("POST /users/invite for an already-registered email returns 409", async () => {
    seedUser("super_admin");
    fake.authAdmin.inviteUserError = { message: "User already registered" };
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users/invite", {
        method: "POST",
        headers: {
          authorization: "Bearer t",
          "content-type": "application/json",
          "x-forwarded-for": IP,
        },
        body: JSON.stringify({
          name: "Duplicado",
          email: "existente@torpreca.gt",
          role: "admin",
        }),
      }),
    );

    expect(res.status).toBe(409);
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

  it("GET /users?status=pending returns only pending rows", async () => {
    seedUser("admin");
    fake.tables.users?.push({
      id: "user-2",
      auth_user_id: "auth-2",
      role: "driver",
      status: "pending",
      deactivated_at: null,
      deactivated_by: null,
      reviewed_at: null,
      reviewed_by: null,
      created_at: "t",
      updated_at: "t",
    });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users?status=pending", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string }[];
    expect(body.map((u) => u.id)).toEqual(["user-2"]);
  });

  it("PATCH /users/:id/review as driver returns 403", async () => {
    seedUser("driver");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users/user-1/review", {
        method: "PATCH",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({ decision: "approve" }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("PATCH /users/:id/review approve sets status=active and logs user.approved", async () => {
    seedUser("admin");
    fake.tables.users?.push({
      id: "user-2",
      auth_user_id: "auth-2",
      role: "driver",
      status: "pending",
      deactivated_at: null,
      deactivated_by: null,
      reviewed_at: null,
      reviewed_by: null,
      created_at: "t",
      updated_at: "t",
    });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users/user-2/review", {
        method: "PATCH",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({ decision: "approve" }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; reviewedBy: string };
    expect(body).toMatchObject({ status: "active", reviewedBy: "user-1" });
    expect(fake.tables.audit_logs).toHaveLength(1);
    expect(fake.tables.audit_logs?.[0]).toMatchObject({ action: "user.approved" });
  });

  it("PATCH /users/:id/review approve with a role promotes the user to it", async () => {
    seedUser("admin");
    fake.tables.users?.push({
      id: "user-2",
      auth_user_id: "auth-2",
      role: "driver",
      status: "pending",
      deactivated_at: null,
      deactivated_by: null,
      reviewed_at: null,
      reviewed_by: null,
      created_at: "t",
      updated_at: "t",
    });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users/user-2/review", {
        method: "PATCH",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({ decision: "approve", role: "supervisor" }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; role: string };
    expect(body).toMatchObject({ status: "active", role: "supervisor" });
  });

  it("PATCH /users/:id/review reject sets status=rejected and logs user.rejected", async () => {
    seedUser("admin");
    fake.tables.users?.push({
      id: "user-2",
      auth_user_id: "auth-2",
      role: "driver",
      status: "pending",
      deactivated_at: null,
      deactivated_by: null,
      reviewed_at: null,
      reviewed_by: null,
      created_at: "t",
      updated_at: "t",
    });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users/user-2/review", {
        method: "PATCH",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({ decision: "reject" }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("rejected");
    expect(fake.tables.audit_logs?.[0]).toMatchObject({ action: "user.rejected" });
  });

  it("PATCH /users/:id/role as admin returns 403 (only super_admin can promote)", async () => {
    seedUser("admin");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users/user-1/role", {
        method: "PATCH",
        headers: {
          authorization: "Bearer t",
          "content-type": "application/json",
          "x-forwarded-for": IP,
        },
        body: JSON.stringify({ role: "supervisor" }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("PATCH /users/:id/role as super_admin updates the role", async () => {
    seedUser("super_admin");
    fake.tables.users?.push({
      id: "user-2",
      auth_user_id: "auth-2",
      role: "driver",
      status: "active",
      deactivated_at: null,
      deactivated_by: null,
      reviewed_at: null,
      reviewed_by: null,
      created_at: "t",
      updated_at: "t",
    });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users/user-2/role", {
        method: "PATCH",
        headers: {
          authorization: "Bearer t",
          "content-type": "application/json",
          "x-forwarded-for": IP,
        },
        body: JSON.stringify({ role: "supervisor" }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { role: string };
    expect(body.role).toBe("supervisor");
  });

  it("PATCH /users/:id/role rejects super_admin as the target role", async () => {
    seedUser("super_admin");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users/user-1/role", {
        method: "PATCH",
        headers: {
          authorization: "Bearer t",
          "content-type": "application/json",
          "x-forwarded-for": IP,
        },
        body: JSON.stringify({ role: "super_admin" }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("PATCH /users/:id/role for a missing user returns 404", async () => {
    seedUser("super_admin");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users/missing/role", {
        method: "PATCH",
        headers: {
          authorization: "Bearer t",
          "content-type": "application/json",
          "x-forwarded-for": IP,
        },
        body: JSON.stringify({ role: "supervisor" }),
      }),
    );

    expect(res.status).toBe(404);
  });

  it("PATCH /users/:id/review on an already-active user returns 409", async () => {
    seedUser("admin");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users/user-1/review", {
        method: "PATCH",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({ decision: "approve" }),
      }),
    );

    expect(res.status).toBe(409);
  });
});
