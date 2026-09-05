import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Router } from "../../core/http/router";
import { createFakeSupabase } from "../../test-support/fake-supabase";

const fake = createFakeSupabase({ insertDefaults: { vehicles: { active: true } } });
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

const AUTH_USER_ID = "auth-1";

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
  const { registerVehiclesRoutes } = await import("./vehicles.routes");
  const router = new Router();
  registerVehiclesRoutes(router);
  return router;
}

beforeEach(() => {
  fake.reset({ vehicles: [], users: [], audit_logs: [] });
});

describe("vehicles HTTP routes", () => {
  it("GET /vehicles without a token returns 401", async () => {
    const router = await buildRouter();
    const res = await router.handle(new Request("http://x/vehicles"));
    expect(res.status).toBe(401);
  });

  it("POST /vehicles as driver returns 403 (requireRole)", async () => {
    seedUser("driver");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/vehicles", {
        method: "POST",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({ plate: "P123ABC", model: "Hilux", capacity: 2 }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("POST /vehicles with an invalid body returns 400", async () => {
    seedUser("admin");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/vehicles", {
        method: "POST",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({ plate: "" }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("POST /vehicles as admin creates a vehicle (201)", async () => {
    seedUser("admin");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/vehicles", {
        method: "POST",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({ plate: "P123ABC", model: "Hilux", capacity: 2 }),
      }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { plate: string; active: boolean };
    expect(body).toMatchObject({ plate: "P123ABC", active: true });
  });

  it("GET /vehicles/:id for a missing vehicle returns 404", async () => {
    seedUser("admin");
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/vehicles/missing", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(404);
  });

  it("DELETE /vehicles/:id deactivates it (204)", async () => {
    seedUser("admin");
    fake.tables.vehicles = [
      {
        id: "v1",
        plate: "P123ABC",
        model: "Hilux",
        capacity: 2,
        active: true,
        created_at: "t",
        updated_at: "t",
      },
    ];
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/vehicles/v1", {
        method: "DELETE",
        headers: { authorization: "Bearer t" },
      }),
    );

    expect(res.status).toBe(204);
    expect(fake.tables.vehicles?.[0]?.active).toBe(false);
  });

  it("deactivated user gets 403 and logs access.denied", async () => {
    seedUser("admin", false);
    const router = await buildRouter();

    const res = await router.handle(
      new Request("http://x/vehicles", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(403);
    expect(fake.tables.audit_logs).toHaveLength(1);
    expect(fake.tables.audit_logs?.[0]).toMatchObject({ action: "access.denied" });
  });
});
