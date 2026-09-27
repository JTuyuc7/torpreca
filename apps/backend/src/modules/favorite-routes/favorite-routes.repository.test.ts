import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createFakeSupabase } from "../../test-support/fake-supabase";

// mock.module must run before the repository under test is imported — every
// test below uses a dynamic import() so it always sees the mock, regardless
// of ESM hoisting order. See TOR-75 plan.
const fake = createFakeSupabase();
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

beforeEach(() => {
  fake.reset({ favorite_routes: [] });
});

describe("favoriteRoutesRepository", () => {
  it("maps a created row from snake_case to camelCase", async () => {
    const { favoriteRoutesRepository } = await import("./favorite-routes.repository");

    const favorite = await favoriteRoutesRepository.create(
      {
        label: "Bodega Central → Zona 4",
        originLat: 14.6349,
        originLng: -90.5069,
        destinationLat: 14.6115,
        destinationLng: -90.5322,
        plannedKm: 12.5,
      },
      "user-1",
    );

    expect(favorite).toMatchObject({
      label: "Bodega Central → Zona 4",
      originLat: 14.6349,
      originLng: -90.5069,
      destinationLat: 14.6115,
      destinationLng: -90.5322,
      plannedKm: 12.5,
      createdBy: "user-1",
    });
    expect(typeof favorite.id).toBe("string");
    expect(typeof favorite.createdAt).toBe("string");
  });

  it("list() returns favorites ordered by label", async () => {
    const { favoriteRoutesRepository } = await import("./favorite-routes.repository");
    fake.reset({
      favorite_routes: [
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
        {
          id: "2",
          label: "Bodega Central",
          origin_lat: 14.6,
          origin_lng: -90.5,
          destination_lat: 14.6,
          destination_lng: -90.5,
          planned_km: 3,
          created_by: "user-1",
          created_at: "t",
          updated_at: "t",
        },
      ],
    });

    const favorites = await favoriteRoutesRepository.list();
    expect(favorites.map((f) => f.label)).toEqual(["Bodega Central", "Zona 4"]);
  });

  it("remove() deletes the row", async () => {
    const { favoriteRoutesRepository } = await import("./favorite-routes.repository");
    fake.reset({
      favorite_routes: [
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
      ],
    });

    await favoriteRoutesRepository.remove("1");
    expect(fake.tables.favorite_routes).toHaveLength(0);
  });
});
