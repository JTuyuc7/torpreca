import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Router } from "../../core/http/router";
import { createFakeSupabase } from "../../test-support/fake-supabase";

const fake = createFakeSupabase();
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

const AUTH_USER_ID = "auth-1";
// rateLimitGeneral keys its bucket by x-forwarded-for, defaulting to
// "unknown" — every test file across the whole suite that omits this header
// shares (and can exhaust) that one bucket. A dedicated IP isolates this
// file's requests from that shared state.
const IP = "203.0.113.41";

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
  const { registerFavoriteRoutesRoutes } = await import("./favorite-routes.routes");
  const router = new Router();
  registerFavoriteRoutesRoutes(router);
  return router;
}

const VALID_INPUT = {
  label: "Bodega Central → Zona 4",
  originLat: 14.6349,
  originLng: -90.5069,
  destinationLat: 14.6115,
  destinationLng: -90.5322,
  plannedKm: 12.5,
};

beforeEach(() => {
  fake.reset({ favorite_routes: [], users: [], audit_logs: [] });
});

describe("favorite-routes HTTP routes", () => {
  it("GET /favorite-routes without a token returns 401", async () => {
    const router = await buildRouter();
    const res = await router.handle(
      new Request("http://x/favorite-routes", { headers: { "x-forwarded-for": IP } }),
    );
    expect(res.status).toBe(401);
  });

  it("GET /favorite-routes as any dashboard role lists them", async () => {
    seedUser("supervisor");
    fake.tables.favorite_routes = [
      {
        id: "1",
        label: "Zona 4",
        origin_lat: 14.6,
        origin_lng: -90.5,
        destination_lat: 14.6,
        destination_lng: -90.5,
        planned_km: 5,
        created_by: "user-1",
        created_at: "t",
        updated_at: "t",
      },
    ];
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/favorite-routes", {
        headers: { authorization: "Bearer t", "x-forwarded-for": IP },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { label: string }[];
    expect(body).toHaveLength(1);
    expect(body[0]?.label).toBe("Zona 4");
  });

  it("POST /favorite-routes as driver returns 403 (requireRole)", async () => {
    seedUser("driver");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/favorite-routes", {
        method: "POST",
        headers: {
          authorization: "Bearer t",
          "content-type": "application/json",
          "x-forwarded-for": IP,
        },
        body: JSON.stringify(VALID_INPUT),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("POST /favorite-routes with an invalid body returns 400", async () => {
    seedUser("admin");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/favorite-routes", {
        method: "POST",
        headers: {
          authorization: "Bearer t",
          "content-type": "application/json",
          "x-forwarded-for": IP,
        },
        body: JSON.stringify({ label: "" }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("POST /favorite-routes as admin creates a favorite route (201)", async () => {
    seedUser("admin");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/favorite-routes", {
        method: "POST",
        headers: {
          authorization: "Bearer t",
          "content-type": "application/json",
          "x-forwarded-for": IP,
        },
        body: JSON.stringify(VALID_INPUT),
      }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { label: string; createdBy: string; plannedKm: number };
    expect(body).toMatchObject({
      label: VALID_INPUT.label,
      createdBy: "user-1",
      plannedKm: VALID_INPUT.plannedKm,
    });
  });

  it("DELETE /favorite-routes/:id as supervisor removes it (204)", async () => {
    seedUser("supervisor");
    fake.tables.favorite_routes = [
      {
        id: "1",
        label: "Zona 4",
        origin_lat: 14.6,
        origin_lng: -90.5,
        destination_lat: 14.6,
        destination_lng: -90.5,
        planned_km: 5,
        created_by: "user-1",
        created_at: "t",
        updated_at: "t",
      },
    ];
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/favorite-routes/1", {
        method: "DELETE",
        headers: { authorization: "Bearer t", "x-forwarded-for": IP },
      }),
    );

    expect(res.status).toBe(204);
    expect(fake.tables.favorite_routes).toHaveLength(0);
  });

  it("DELETE /favorite-routes/:id as driver returns 403", async () => {
    seedUser("driver");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/favorite-routes/1", {
        method: "DELETE",
        headers: { authorization: "Bearer t", "x-forwarded-for": IP },
      }),
    );

    expect(res.status).toBe(403);
  });
});
