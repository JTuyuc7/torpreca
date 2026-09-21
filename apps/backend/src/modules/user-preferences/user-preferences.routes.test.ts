import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Router } from "../../core/http/router";
import { createFakeSupabase } from "../../test-support/fake-supabase";

const fake = createFakeSupabase();
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

const AUTH_USER_ID = "auth-1";
const IP = "203.0.113.42";

function seedUser(role: "driver" | "supervisor" | "admin" | "super_admin", active = true) {
  fake.tables.users = [
    {
      id: "user-1",
      auth_user_id: AUTH_USER_ID,
      role,
      status: active ? "active" : "deactivated",
      created_at: "t",
      updated_at: "t",
    },
  ];
  fake.setAuthUser({ id: AUTH_USER_ID });
}

async function buildRouter() {
  const { registerMobileUserPreferencesRoutes, registerUserPreferencesRoutes } = await import(
    "./user-preferences.routes"
  );
  const router = new Router();
  registerUserPreferencesRoutes(router);
  registerMobileUserPreferencesRoutes(router);
  return router;
}

beforeEach(() => {
  fake.reset({ user_preferences: [], users: [], audit_logs: [] });
});

describe("user-preferences HTTP routes", () => {
  it("GET /users/me/preferences without a token returns 401", async () => {
    const router = await buildRouter();
    const res = await router.handle(
      new Request("http://x/users/me/preferences", { headers: { "x-forwarded-for": IP } }),
    );
    expect(res.status).toBe(401);
  });

  it("GET /users/me/preferences returns virtual defaults for a driver with no row yet", async () => {
    seedUser("driver");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users/me/preferences", {
        headers: { authorization: "Bearer t", "x-forwarded-for": IP },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { theme: string; language: string; defaultMapView: unknown };
    expect(body).toMatchObject({ theme: "system", language: "es", defaultMapView: null });
  });

  it("PATCH /users/me/preferences as driver updates its own theme", async () => {
    seedUser("driver");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users/me/preferences", {
        method: "PATCH",
        headers: {
          authorization: "Bearer t",
          "content-type": "application/json",
          "x-forwarded-for": IP,
        },
        body: JSON.stringify({ theme: "dark" }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { theme: string; userId: string };
    expect(body).toMatchObject({ theme: "dark", userId: "user-1" });
  });

  it("PATCH /users/me/preferences with an invalid theme returns 400", async () => {
    seedUser("admin");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users/me/preferences", {
        method: "PATCH",
        headers: {
          authorization: "Bearer t",
          "content-type": "application/json",
          "x-forwarded-for": IP,
        },
        body: JSON.stringify({ theme: "purple" }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("PATCH /users/me/preferences lets a supervisor set defaultMapView", async () => {
    seedUser("supervisor");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/users/me/preferences", {
        method: "PATCH",
        headers: {
          authorization: "Bearer t",
          "content-type": "application/json",
          "x-forwarded-for": IP,
        },
        body: JSON.stringify({ defaultMapView: { lat: 14.6349, lng: -90.5069, zoom: 12 } }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      defaultMapView: { lat: number; lng: number; zoom: number };
    };
    expect(body.defaultMapView).toEqual({ lat: 14.6349, lng: -90.5069, zoom: 12 });
  });

  it("PATCH /mobile/users/me/preferences works unsigned, same as the mobile app calling it", async () => {
    seedUser("driver");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/mobile/users/me/preferences", {
        method: "PATCH",
        headers: {
          authorization: "Bearer t",
          "content-type": "application/json",
          "x-forwarded-for": IP,
        },
        body: JSON.stringify({ theme: "dark" }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { theme: string };
    expect(body.theme).toBe("dark");
  });
});
