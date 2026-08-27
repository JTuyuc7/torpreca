import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Router } from "../../core/http/router";
import { createFakeSupabase } from "../../test-support/fake-supabase";

const fake = createFakeSupabase({});
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
  const { registerAuthRoutes } = await import("./auth.routes");
  const router = new Router();
  registerAuthRoutes(router);
  return router;
}

beforeEach(() => {
  fake.reset({ users: [], audit_logs: [] });
});

describe("auth HTTP routes", () => {
  it("POST /auth/session as driver returns 403 and does not log auth.login", async () => {
    seedUser("driver");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/auth/session", {
        method: "POST",
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(res.status).toBe(403);
    expect(fake.tables.audit_logs?.map((r) => r.action)).toEqual(["access.denied"]);
  });

  it.each(["supervisor", "admin", "super_admin"] as const)(
    "POST /auth/session as %s returns 200 with the AuthUser and logs auth.login",
    async (role) => {
      seedUser(role);
      const router = await buildRouter();

      const res = await router.handle(
        new Request("http://x/auth/session", {
          method: "POST",
          headers: { authorization: "Bearer t" },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { id: string; role: string; active: boolean };
      expect(body).toMatchObject({ id: "user-1", role, active: true });
      expect(fake.tables.audit_logs).toHaveLength(1);
      expect(fake.tables.audit_logs?.[0]).toMatchObject({
        action: "auth.login",
        user_id: "user-1",
      });
    },
  );

  it("POST /auth/logout logs auth.logout and returns 204", async () => {
    seedUser("admin");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/auth/logout", {
        method: "POST",
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(res.status).toBe(204);
    expect(fake.tables.audit_logs).toHaveLength(1);
    expect(fake.tables.audit_logs?.[0]).toMatchObject({ action: "auth.logout", user_id: "user-1" });
  });

  it("POST /auth/logout without a token returns 401", async () => {
    const router = await buildRouter();

    const res = await router.handle(new Request("http://x/auth/logout", { method: "POST" }));

    expect(res.status).toBe(401);
  });

  it("POST /auth/login-failed logs auth.login_failed with the email, no token required", async () => {
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/auth/login-failed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "someone@example.com" }),
      }),
    );

    expect(res.status).toBe(204);
    expect(fake.tables.audit_logs).toHaveLength(1);
    expect(fake.tables.audit_logs?.[0]).toMatchObject({
      action: "auth.login_failed",
      user_id: null,
      metadata: { email: "someone@example.com", reason: "invalid_credentials" },
    });
  });

  it("POST /auth/login-failed with an invalid email returns 400", async () => {
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/auth/login-failed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      }),
    );

    expect(res.status).toBe(400);
    expect(fake.tables.audit_logs ?? []).toHaveLength(0);
  });

  it("POST /auth/login-failed is rate limited after 5 requests per IP", async () => {
    const router = await buildRouter();

    const makeRequest = () =>
      router.handle(
        new Request("http://x/auth/login-failed", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9" },
          body: JSON.stringify({ email: "someone@example.com" }),
        }),
      );

    for (let i = 0; i < 5; i++) {
      const res = await makeRequest();
      expect(res.status).toBe(204);
    }

    const res = await makeRequest();
    expect(res.status).toBe(429);
  });
});
