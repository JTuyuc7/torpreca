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
  const { registerMobileAuthRoutes } = await import("./mobile-auth.routes");
  const router = new Router();
  registerMobileAuthRoutes(router);
  return router;
}

beforeEach(() => {
  fake.reset({ users: [], audit_logs: [] });
});

describe("mobile-auth HTTP routes", () => {
  it("POST /mobile/auth/session as driver returns 200 with the AuthUser and logs auth.login", async () => {
    seedUser("driver");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/auth/session", {
        method: "POST",
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; role: string; status: string };
    expect(body).toMatchObject({ id: "user-1", role: "driver", status: "active" });
    expect(fake.tables.audit_logs).toHaveLength(1);
    expect(fake.tables.audit_logs?.[0]).toMatchObject({
      action: "auth.login",
      user_id: "user-1",
    });
  });

  it.each(["supervisor", "admin", "super_admin"] as const)(
    "POST /mobile/auth/session as %s returns 403 and does not log auth.login",
    async (role) => {
      seedUser(role);
      const router = await buildRouter();

      const res = await router.handle(
        new Request("http://x/mobile/auth/session", {
          method: "POST",
          headers: { authorization: "Bearer t" },
        }),
      );

      expect(res.status).toBe(403);
      expect(fake.tables.audit_logs?.map((r) => r.action)).toEqual(["access.denied"]);
    },
  );

  it("POST /mobile/auth/logout logs auth.logout and returns 204", async () => {
    seedUser("driver");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/auth/logout", {
        method: "POST",
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(res.status).toBe(204);
    expect(fake.tables.audit_logs).toHaveLength(1);
    expect(fake.tables.audit_logs?.[0]).toMatchObject({ action: "auth.logout", user_id: "user-1" });
  });

  it("POST /mobile/auth/logout without a token returns 401", async () => {
    const router = await buildRouter();

    const res = await router.handle(new Request("http://x/mobile/auth/logout", { method: "POST" }));

    expect(res.status).toBe(401);
  });

  it("POST /mobile/auth/login-failed logs auth.login_failed with the email, no token required", async () => {
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/auth/login-failed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "driver@example.com" }),
      }),
    );

    expect(res.status).toBe(204);
    expect(fake.tables.audit_logs).toHaveLength(1);
    expect(fake.tables.audit_logs?.[0]).toMatchObject({
      action: "auth.login_failed",
      user_id: null,
      metadata: { email: "driver@example.com", reason: "invalid_credentials" },
    });
  });

  it("POST /mobile/auth/login-failed with an invalid email returns 400", async () => {
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/auth/login-failed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      }),
    );

    expect(res.status).toBe(400);
    expect(fake.tables.audit_logs ?? []).toHaveLength(0);
  });

  it("POST /mobile/auth/register with a valid code creates the auth user and resends the confirmation email", async () => {
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.1" },
        body: JSON.stringify({
          email: "nuevo-driver@example.com",
          password: "hunter22222",
          name: "Nuevo Driver",
          signupCode: process.env.SIGNUP_CODE,
        }),
      }),
    );

    expect(res.status).toBe(204);
    expect(fake.authAdmin.createdUsers).toHaveLength(1);
    expect(fake.authAdmin.createdUsers[0]).toMatchObject({
      email: "nuevo-driver@example.com",
      user_metadata: { name: "Nuevo Driver" },
    });
    expect(fake.authAdmin.resendCalls).toHaveLength(1);
    // No `users` row yet — created lazily on first authenticated request (see auth.ts).
    expect(fake.tables.users ?? []).toHaveLength(0);
    expect(fake.tables.audit_logs?.[0]).toMatchObject({ action: "auth.registered" });
  });

  it("POST /mobile/auth/register with a wrong signup code returns 400 and doesn't call Supabase Auth", async () => {
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.2" },
        body: JSON.stringify({
          email: "nuevo-driver@example.com",
          password: "hunter22222",
          name: "Nuevo Driver",
          signupCode: "wrong-code",
        }),
      }),
    );

    expect(res.status).toBe(400);
    expect(fake.authAdmin.createdUsers).toHaveLength(0);
  });

  it("POST /mobile/auth/register with an invalid body (short password) returns 400", async () => {
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.3" },
        body: JSON.stringify({
          email: "nuevo-driver@example.com",
          password: "short",
          name: "Nuevo Driver",
          signupCode: process.env.SIGNUP_CODE,
        }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("POST /mobile/auth/register is rate limited after 5 requests per IP", async () => {
    const router = await buildRouter();

    const makeRequest = () =>
      router.handle(
        new Request("http://x/mobile/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.7" },
          body: JSON.stringify({
            email: "nuevo-driver@example.com",
            password: "hunter22222",
            name: "Nuevo Driver",
            signupCode: process.env.SIGNUP_CODE,
          }),
        }),
      );

    for (let i = 0; i < 5; i++) {
      const res = await makeRequest();
      expect(res.status).toBe(204);
    }

    const res = await makeRequest();
    expect(res.status).toBe(429);
  });

  it("POST /mobile/auth/login-failed is rate limited after 5 requests per IP", async () => {
    const router = await buildRouter();

    const makeRequest = () =>
      router.handle(
        new Request("http://x/mobile/auth/login-failed", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.8" },
          body: JSON.stringify({ email: "driver@example.com" }),
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
