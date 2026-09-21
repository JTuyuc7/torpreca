import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createFakeSupabase } from "../../test-support/fake-supabase";

const fake = createFakeSupabase();
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

beforeEach(() => {
  fake.reset({ user_preferences: [] });
});

describe("userPreferencesRepository", () => {
  it("getByUserId() returns null when no row exists yet", async () => {
    const { userPreferencesRepository } = await import("./user-preferences.repository");

    expect(await userPreferencesRepository.getByUserId("user-1")).toBeNull();
  });

  it("patch() creates a row on first write, only setting the given fields", async () => {
    const { userPreferencesRepository } = await import("./user-preferences.repository");

    const prefs = await userPreferencesRepository.patch("user-1", { theme: "dark" });

    expect(prefs).toMatchObject({ userId: "user-1", theme: "dark" });
    expect(prefs.defaultMapView).toBeNull();
    expect(fake.tables.user_preferences).toHaveLength(1);
  });

  it("patch() updates only the given fields on an existing row", async () => {
    fake.tables.user_preferences = [
      {
        user_id: "user-1",
        theme: "dark",
        language: "es",
        default_map_lat: null,
        default_map_lng: null,
        default_map_zoom: null,
        created_at: "t",
        updated_at: "t",
      },
    ];
    const { userPreferencesRepository } = await import("./user-preferences.repository");

    const prefs = await userPreferencesRepository.patch("user-1", { language: "en" });

    expect(prefs).toMatchObject({ userId: "user-1", theme: "dark", language: "en" });
  });

  it("patch() sets defaultMapView from lat/lng/zoom, and null clears it", async () => {
    const { userPreferencesRepository } = await import("./user-preferences.repository");

    const withView = await userPreferencesRepository.patch("user-1", {
      defaultMapView: { lat: 14.6349, lng: -90.5069, zoom: 12 },
    });
    expect(withView.defaultMapView).toEqual({ lat: 14.6349, lng: -90.5069, zoom: 12 });

    const cleared = await userPreferencesRepository.patch("user-1", { defaultMapView: null });
    expect(cleared.defaultMapView).toBeNull();
  });
});
