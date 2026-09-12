import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Router } from "../../core/http/router";
import { createFakeSupabase } from "../../test-support/fake-supabase";

const fake = createFakeSupabase();
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

const AUTH_USER_ID = "auth-driver";

function seedUser(role: "driver" | "supervisor" | "admin" | "super_admin") {
  fake.tables.users = [
    {
      id: "driver-1",
      auth_user_id: AUTH_USER_ID,
      role,
      status: "active",
      created_at: "t",
      updated_at: "t",
    },
  ];
  fake.setAuthUser({ id: AUTH_USER_ID });
}

function seedDriver() {
  seedUser("driver");
}

async function buildRouter() {
  const { registerWsTicketsRoutes } = await import("./ws-tickets.routes");
  const router = new Router();
  registerWsTicketsRoutes(router);
  return router;
}

async function buildMobileRouter() {
  const { registerMobileWsTicketsRoutes } = await import("./ws-tickets.routes");
  const router = new Router();
  registerMobileWsTicketsRoutes(router);
  return router;
}

beforeEach(() => {
  fake.reset({ users: [] });
});

describe("ws-tickets HTTP routes", () => {
  it("POST /ws-tickets without a token returns 401", async () => {
    const router = await buildRouter();
    const res = await router.handle(new Request("http://x/ws-tickets", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("POST /ws-tickets for an authenticated user returns a ticket and expiresAt", async () => {
    seedDriver();
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/ws-tickets", {
        method: "POST",
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ticket: string; expiresAt: string };
    expect(typeof body.ticket).toBe("string");
    expect(body.ticket.length).toBeGreaterThan(0);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

describe("mobile ws-tickets HTTP routes", () => {
  it("POST /mobile/ws-tickets without a token returns 401", async () => {
    const router = await buildMobileRouter();
    const res = await router.handle(new Request("http://x/mobile/ws-tickets", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("POST /mobile/ws-tickets as driver returns a ticket and expiresAt", async () => {
    seedDriver();
    const router = await buildMobileRouter();

    const res = await router.handle(
      new Request("http://x/mobile/ws-tickets", {
        method: "POST",
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ticket: string; expiresAt: string };
    expect(typeof body.ticket).toBe("string");
    expect(body.ticket.length).toBeGreaterThan(0);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it.each(["supervisor", "admin", "super_admin"] as const)(
    "POST /mobile/ws-tickets as %s returns 403",
    async (role) => {
      seedUser(role);
      const router = await buildMobileRouter();

      const res = await router.handle(
        new Request("http://x/mobile/ws-tickets", {
          method: "POST",
          headers: { authorization: "Bearer t" },
        }),
      );

      expect(res.status).toBe(403);
    },
  );
});
