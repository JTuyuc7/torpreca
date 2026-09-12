import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { RpcHandler } from "../../test-support/fake-supabase";
import { createFakeSupabase } from "../../test-support/fake-supabase";
import { Router } from "../http/router";

// Enough of create_user_encrypted to exercise the lazy-create branch — a real
// row appended to tables.users, mirroring the real RPC's shape.
const createUserEncrypted: RpcHandler = (tables, args) => {
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    auth_user_id: args.p_auth_user_id,
    role: args.p_role,
    status: args.p_status,
    created_at: now,
    updated_at: now,
  };
  tables.users = [...(tables.users ?? []), row];
  return [row];
};

const fake = createFakeSupabase({ rpcHandlers: { create_user_encrypted: createUserEncrypted } });
mock.module("../db/supabase", () => ({ supabaseAdmin: fake.client }));

async function buildRouter() {
  const { auth } = await import("./auth");
  const router = new Router();
  router.get("/whoami", auth, async (ctx) => Response.json(ctx.user));
  return router;
}

const AUTH_USER_ID = "auth-1";

beforeEach(() => {
  fake.reset({ users: [] });
});

describe("auth middleware", () => {
  it("attaches ctx.user for an existing active user", async () => {
    fake.tables.users = [
      { id: "user-1", auth_user_id: AUTH_USER_ID, role: "driver", status: "active" },
    ];
    fake.setAuthUser({ id: AUTH_USER_ID });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/whoami", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "user-1", status: "active" });
  });

  it.each(["pending", "rejected", "deactivated"] as const)(
    "returns 403 with code for an existing %s user, without touching the DB",
    async (status) => {
      fake.tables.users = [{ id: "user-1", auth_user_id: AUTH_USER_ID, role: "driver", status }];
      fake.setAuthUser({ id: AUTH_USER_ID });
      const router = await buildRouter();

      const res = await router.handle(
        new Request("http://x/whoami", { headers: { authorization: "Bearer t" } }),
      );

      expect(res.status).toBe(403);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe(
        status === "pending"
          ? "PENDING_APPROVAL"
          : status === "rejected"
            ? "REJECTED"
            : "DEACTIVATED",
      );
    },
  );

  it("without a matching `users` row and a confirmed email, lazily creates one as pending and returns 403 PENDING_APPROVAL", async () => {
    fake.setAuthUser({
      id: AUTH_USER_ID,
      email: "driver@example.com",
      email_confirmed_at: "2026-09-05T00:00:00Z",
      user_metadata: { name: "Driver Nuevo" },
    });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/whoami", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(403);
    expect((await res.json()) as { code: string }).toMatchObject({ code: "PENDING_APPROVAL" });
    expect(fake.tables.users).toHaveLength(1);
    expect(fake.tables.users?.[0]).toMatchObject({
      auth_user_id: AUTH_USER_ID,
      role: "driver",
      status: "pending",
    });
  });

  it("without a matching `users` row and an unconfirmed email, returns 401 and creates no row", async () => {
    fake.setAuthUser({
      id: AUTH_USER_ID,
      email: "driver@example.com",
      email_confirmed_at: null,
    });
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/whoami", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(401);
    expect(fake.tables.users ?? []).toHaveLength(0);
  });

  it("without a token returns 401", async () => {
    const router = await buildRouter();
    const res = await router.handle(new Request("http://x/whoami"));
    expect(res.status).toBe(401);
  });
});
