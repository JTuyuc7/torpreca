import { describe, expect, it } from "bun:test";
import type { Vehicle } from "@torpreca/shared";
import type { VehiclesRepository } from "./vehicles.repository";
import { createVehiclesService } from "./vehicles.service";

// In-memory fake of the repository — this way the service is tested without
// real Supabase. Future modules copy this exact pattern (interface + fake).
function createFakeRepo(seed: Vehicle[] = []): VehiclesRepository {
  const vehicles = [...seed];

  return {
    async list(onlyActive = true) {
      return onlyActive ? vehicles.filter((v) => v.active) : vehicles;
    },
    async getById(id) {
      return vehicles.find((v) => v.id === id) ?? null;
    },
    async getByPlate(plate) {
      return vehicles.find((v) => v.plate === plate) ?? null;
    },
    async create(input) {
      const created: Vehicle = {
        id: crypto.randomUUID(),
        plate: input.plate,
        model: input.model,
        capacity: input.capacity,
        category: input.category,
        notes: input.notes,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      vehicles.push(created);
      return created;
    },
    async update(id, patch) {
      const vehicle = vehicles.find((v) => v.id === id);
      if (!vehicle) return null;
      Object.assign(vehicle, patch);
      return vehicle;
    },
    async deactivate(id) {
      const vehicle = vehicles.find((v) => v.id === id);
      if (vehicle) vehicle.active = false;
    },
  };
}

describe("vehicles.service", () => {
  it("creates a new vehicle", async () => {
    const service = createVehiclesService(createFakeRepo());
    const vehicle = await service.create({
      plate: "P123ABC",
      model: "Hilux",
      capacity: 2,
      category: "light_vehicle",
      notes: null,
    });

    expect(vehicle.plate).toBe("P123ABC");
    expect(vehicle.active).toBe(true);
  });

  it("rejects a duplicate plate", async () => {
    const repo = createFakeRepo([
      {
        id: "1",
        plate: "P123ABC",
        model: "Hilux",
        capacity: 2,
        category: "light_vehicle",
        notes: null,
        active: true,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
    const service = createVehiclesService(repo);

    await expect(
      service.create({
        plate: "P123ABC",
        model: "Otro",
        capacity: null,
        category: "light_vehicle",
        notes: null,
      }),
    ).rejects.toThrow("A vehicle with that plate already exists");
  });

  it("throws NotFoundError for a missing id", async () => {
    const service = createVehiclesService(createFakeRepo());
    await expect(service.getById("no-existe")).rejects.toThrow("Vehicle not found");
  });

  it("updates editable fields", async () => {
    const repo = createFakeRepo([
      {
        id: "1",
        plate: "P123ABC",
        model: "Hilux",
        capacity: 2,
        category: "light_vehicle",
        notes: null,
        active: true,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
    const service = createVehiclesService(repo);

    const updated = await service.update("1", { model: "Hilux 4x4", capacity: 4 });
    expect(updated).toMatchObject({ model: "Hilux 4x4", capacity: 4, plate: "P123ABC" });
  });

  it("reactivates a deactivated vehicle via active: true", async () => {
    const repo = createFakeRepo([
      {
        id: "1",
        plate: "P123ABC",
        model: "Hilux",
        capacity: 2,
        category: "light_vehicle",
        notes: null,
        active: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
    const service = createVehiclesService(repo);

    const updated = await service.update("1", { active: true });
    expect(updated.active).toBe(true);
  });

  it("rejects updating to a plate already used by another vehicle", async () => {
    const repo = createFakeRepo([
      {
        id: "1",
        plate: "P123ABC",
        model: "Hilux",
        capacity: 2,
        category: "light_vehicle",
        notes: null,
        active: true,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "2",
        plate: "Q999ZZZ",
        model: "Otro",
        capacity: null,
        category: "light_vehicle",
        notes: null,
        active: true,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
    const service = createVehiclesService(repo);

    await expect(service.update("2", { plate: "P123ABC" })).rejects.toThrow(
      "A vehicle with that plate already exists",
    );
  });

  it("allows updating a vehicle to keep its own plate unchanged", async () => {
    const repo = createFakeRepo([
      {
        id: "1",
        plate: "P123ABC",
        model: "Hilux",
        capacity: 2,
        category: "light_vehicle",
        notes: null,
        active: true,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
    const service = createVehiclesService(repo);

    const updated = await service.update("1", { plate: "P123ABC", model: "Hilux nueva" });
    expect(updated.model).toBe("Hilux nueva");
  });

  it("throws NotFoundError updating a missing vehicle", async () => {
    const service = createVehiclesService(createFakeRepo());
    await expect(service.update("no-existe", { model: "X" })).rejects.toThrow("Vehicle not found");
  });

  it("deactivate sets active to false", async () => {
    const repo = createFakeRepo([
      {
        id: "1",
        plate: "P123ABC",
        model: "Hilux",
        capacity: 2,
        category: "light_vehicle",
        notes: null,
        active: true,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
    const service = createVehiclesService(repo);

    await service.deactivate("1");
    const [vehicle] = await repo.list(false);
    expect(vehicle?.active).toBe(false);
  });
});
