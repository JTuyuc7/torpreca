import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createFakeSupabase } from "../../test-support/fake-supabase";

// mock.module must run before the repository under test is imported — every
// test below uses a dynamic import() so it always sees the mock, regardless
// of ESM hoisting order. See TOR-75 plan.
const fake = createFakeSupabase({ insertDefaults: { vehicles: { active: true } } });
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

beforeEach(() => {
  fake.reset({ vehicles: [] });
});

describe("vehiclesRepository", () => {
  it("maps a created row from snake_case to camelCase", async () => {
    const { vehiclesRepository } = await import("./vehicles.repository");

    const vehicle = await vehiclesRepository.create({
      plate: "P123ABC",
      model: "Hilux",
      capacity: 2,
    });

    expect(vehicle).toMatchObject({ plate: "P123ABC", model: "Hilux", capacity: 2, active: true });
    expect(typeof vehicle.id).toBe("string");
    expect(typeof vehicle.createdAt).toBe("string");
  });

  it("list(true) returns only active vehicles, ordered by plate", async () => {
    const { vehiclesRepository } = await import("./vehicles.repository");
    fake.reset({
      vehicles: [
        {
          id: "1",
          plate: "Z999ZZZ",
          model: "A",
          capacity: null,
          active: true,
          created_at: "t",
          updated_at: "t",
        },
        {
          id: "2",
          plate: "A111AAA",
          model: "B",
          capacity: null,
          active: false,
          created_at: "t",
          updated_at: "t",
        },
      ],
    });

    const active = await vehiclesRepository.list(true);
    expect(active.map((v) => v.plate)).toEqual(["Z999ZZZ"]);

    const all = await vehiclesRepository.list(false);
    expect(all).toHaveLength(2);
  });

  it("getById returns null when no row matches", async () => {
    const { vehiclesRepository } = await import("./vehicles.repository");
    expect(await vehiclesRepository.getById("missing")).toBeNull();
  });

  it("getByPlate finds an existing vehicle", async () => {
    const { vehiclesRepository } = await import("./vehicles.repository");
    fake.reset({
      vehicles: [
        {
          id: "1",
          plate: "P123ABC",
          model: "Hilux",
          capacity: 2,
          active: true,
          created_at: "t",
          updated_at: "t",
        },
      ],
    });

    const vehicle = await vehiclesRepository.getByPlate("P123ABC");
    expect(vehicle?.id).toBe("1");
  });

  it("deactivate sets active to false in place", async () => {
    const { vehiclesRepository } = await import("./vehicles.repository");
    fake.reset({
      vehicles: [
        {
          id: "1",
          plate: "P123ABC",
          model: "Hilux",
          capacity: 2,
          active: true,
          created_at: "t",
          updated_at: "t",
        },
      ],
    });

    await vehiclesRepository.deactivate("1");
    expect(fake.tables.vehicles?.[0]?.active).toBe(false);
  });
});
